using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Lanswitch.Domain.Interfaces;

namespace Lanswitch.Infrastructure.Services;

public class GeminiAiService : IGeminiAiService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly IFileStorageService _fileStorage;
    
    private readonly IGenericRepository<GrammarContext> _grammarContextRepo;

    public GeminiAiService(
        HttpClient httpClient, 
        IConfiguration configuration, 
        IFileStorageService fileStorage,
        IGenericRepository<GrammarContext> grammarContextRepo)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Gemini:ApiKey"] ?? throw new ArgumentNullException("Gemini ApiKey is missing");
        _fileStorage = fileStorage;
        _httpClient.Timeout = TimeSpan.FromMinutes(10);
        _grammarContextRepo = grammarContextRepo;
    }

    private class GeminiSubtitleDto
    {
        public int Index { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string? Text { get; set; }
    }

    public async Task<List<Subtitle>> TranscribeAudioAsync(List<string> audioFilePaths, long mediaId, int chunkMinutes = 11, int overlapMinutes = 1)
    {
        var allSubtitles = new List<Subtitle>();
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return allSubtitles;
        
        var uploadUrl = $"https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key={_apiKey}";
        var generateUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        int chunkIndex = 0;
        var chunkSubtitlesList = new List<List<Subtitle>>();

        foreach (var chunkPath in audioFilePaths)
        {
            var chunkSubtitles = new List<Subtitle>();
            try
            {
                var audioBytes = await System.IO.File.ReadAllBytesAsync(chunkPath);
                using var uploadContent = new ByteArrayContent(audioBytes);
                uploadContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mp3");
                uploadContent.Headers.Add("X-Goog-Upload-Mime-Type", "audio/mp3");
                
                var uploadResponse = await _httpClient.PostAsync(uploadUrl, uploadContent);
                if (!uploadResponse.IsSuccessStatusCode)
                {
                    var err = await uploadResponse.Content.ReadAsStringAsync();
                    throw new Exception($"Gemini Upload Error for chunk {chunkIndex}: {err}");
                }
                var uploadJson = await uploadResponse.Content.ReadAsStringAsync();
                var uploadDoc = JsonDocument.Parse(uploadJson);
                var fileUri = uploadDoc.RootElement.GetProperty("file").GetProperty("uri").GetString();
                if (string.IsNullOrEmpty(fileUri)) continue;

                var prompt = "Listen to this audio chunk. Generate full subtitles for it. Return ONLY a JSON array of objects. Each object must have exactly these keys: 'Index', 'StartTime' (string format 'hh:mm:ss,fff'), 'EndTime' (string format 'hh:mm:ss,fff'), and 'Text' (string containing the exact spoken English sentence). Do not include any markdown formatting or extra text, just the raw JSON array. If there is absolutely no speech, return an empty array [].";

                var requestBody = new
                {
                    contents = new[] {
                        new {
                            parts = new object[] {
                                new { fileData = new { fileUri = fileUri, mimeType = "audio/mp3" } },
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new { 
                        temperature = 0.1,
                        thinkingConfig = new { thinkingBudget = 0 }
                    }
                };
                
                var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(generateUrl, content);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Gemini Transcription Error for chunk {chunkIndex}: {err}");
                }
                
                var responseJson = await response.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(responseJson);
                
                string? textResult = null;
                try
                {
                    textResult = jsonDoc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text").GetString();
                }
                catch { }
                
                if (string.IsNullOrWhiteSpace(textResult)) continue;
                
                var cleanJson = textResult.Trim();
                if (cleanJson.StartsWith("```json")) cleanJson = cleanJson.Substring(7);
                else if (cleanJson.StartsWith("```")) cleanJson = cleanJson.Substring(3);
                if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                cleanJson = cleanJson.Trim();

                if (cleanJson == "[]") continue;

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var dtoList = JsonSerializer.Deserialize<List<GeminiSubtitleDto>>(cleanJson, options);
                
                if (dtoList != null)
                {
                    TimeSpan chunkOffset = TimeSpan.FromMinutes(chunkIndex * (chunkMinutes - overlapMinutes));
                    foreach (var dto in dtoList)
                    {
                        TimeSpan.TryParse(dto.StartTime?.Replace(',', '.'), out var st);
                        TimeSpan.TryParse(dto.EndTime?.Replace(',', '.'), out var et);
                        chunkSubtitles.Add(new Subtitle
                        {
                            MediaId = mediaId,
                            StartTime = st.Add(chunkOffset),
                            EndTime = et.Add(chunkOffset),
                            Text = dto.Text ?? ""
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing chunk {chunkIndex}: {ex.Message}");
            }
            finally
            {
                if (chunkSubtitles.Any()) chunkSubtitlesList.Add(chunkSubtitles);
                chunkIndex++;
                try { if (System.IO.File.Exists(chunkPath)) System.IO.File.Delete(chunkPath); } catch { }
            }
        }

        if (chunkSubtitlesList.Count == 0) return allSubtitles;

        var mergedSubtitles = new List<Subtitle>();
        mergedSubtitles.AddRange(chunkSubtitlesList[0]);

        for (int i = 1; i < chunkSubtitlesList.Count; i++)
        {
            var previousChunk = mergedSubtitles;
            var currentChunk = chunkSubtitlesList[i];

            TimeSpan overlapStart = TimeSpan.FromMinutes(i * (chunkMinutes - overlapMinutes));
            TimeSpan overlapEnd = overlapStart.Add(TimeSpan.FromMinutes(overlapMinutes));

            var overlapFromPrev = previousChunk.Where(s => s.EndTime >= overlapStart && s.StartTime <= overlapEnd).ToList();
            var overlapFromCurr = currentChunk.Where(s => s.EndTime >= overlapStart && s.StartTime <= overlapEnd).ToList();

            if (overlapFromPrev.Any() && overlapFromCurr.Any())
            {
                var mergedOverlap = await MergeOverlappingSubtitlesAsync(overlapFromPrev, overlapFromCurr, overlapStart, overlapEnd);
                
                previousChunk.RemoveAll(s => overlapFromPrev.Contains(s));
                currentChunk.RemoveAll(s => overlapFromCurr.Contains(s));

                mergedSubtitles.AddRange(mergedOverlap);
            }

            mergedSubtitles.AddRange(currentChunk);
        }

        mergedSubtitles = mergedSubtitles.OrderBy(s => s.StartTime).ToList();
        for (int i = 0; i < mergedSubtitles.Count; i++)
        {
            mergedSubtitles[i].Index = i + 1;
        }

        return mergedSubtitles;
    }

    public async Task<List<Subtitle>> MergeOverlappingSubtitlesAsync(List<Subtitle> firstPart, List<Subtitle> secondPart, TimeSpan overlapStart, TimeSpan overlapEnd)
    {
        if (!firstPart.Any() && !secondPart.Any()) return new List<Subtitle>();

        var firstJson = JsonSerializer.Serialize(firstPart.Select(s => new { StartTime = s.StartTime.ToString(@"hh\:mm\:ss\.fff"), EndTime = s.EndTime.ToString(@"hh\:mm\:ss\.fff"), s.Text }));
        var secondJson = JsonSerializer.Serialize(secondPart.Select(s => new { StartTime = s.StartTime.ToString(@"hh\:mm\:ss\.fff"), EndTime = s.EndTime.ToString(@"hh\:mm\:ss\.fff"), s.Text }));

        var prompt = $@"You are a subtitle synchronization expert. I have two sets of overlapping subtitles for the same timeframe ({overlapStart} to {overlapEnd}). 
They may contain duplicate sentences or slight misalignments. 
Merge them into a single, coherent, perfectly synchronized timeline. Remove duplicates and fix broken sentences.

Set 1 (from previous chunk):
{firstJson}

Set 2 (from current chunk):
{secondJson}

Return ONLY a JSON array of objects. Each object must have: 'StartTime' (string format 'hh:mm:ss.fff'), 'EndTime' (string format 'hh:mm:ss.fff'), and 'Text'. No markdown, no extra text.";

        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.1 }
        };
        
        var generateUrl = $"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={_apiKey}";
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        
        try
        {
            var response = await _httpClient.PostAsync(generateUrl, content);
            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                var jsonDoc = JsonDocument.Parse(responseJson);
                var textResult = jsonDoc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                
                if (!string.IsNullOrWhiteSpace(textResult))
                {
                    var cleanJson = textResult.Trim();
                    if (cleanJson.StartsWith("```json")) cleanJson = cleanJson.Substring(7);
                    else if (cleanJson.StartsWith("```")) cleanJson = cleanJson.Substring(3);
                    if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                    
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var dtoList = JsonSerializer.Deserialize<List<GeminiSubtitleDto>>(cleanJson.Trim(), options);
                    
                    if (dtoList != null)
                    {
                        var merged = new List<Subtitle>();
                        foreach (var dto in dtoList)
                        {
                            TimeSpan.TryParse(dto.StartTime?.Replace(',', '.'), out var st);
                            TimeSpan.TryParse(dto.EndTime?.Replace(',', '.'), out var et);
                            merged.Add(new Subtitle { StartTime = st, EndTime = et, Text = dto.Text ?? "", MediaId = firstPart.FirstOrDefault()?.MediaId ?? 0 });
                        }
                        return merged;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error merging subtitles: {ex.Message}");
        }

        return firstPart;
    }

    public async Task<List<SentenceAnalysisResult>?> AnalyzeGrammarAsync(string subtitlesJson, string targetLanguage = "Ingliz")
    {
        var grammatik_qoidalar = "";
        var grammarContexts = await _grammarContextRepo.GetAllAsync();
        foreach (var grammarContext in grammarContexts)
        {
            grammatik_qoidalar += "Qoida - (ID:" + grammarContext.Id + "): "+ grammarContext.Name + " -> " + grammarContext.Content + "\n";
        }

        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return null;
            
        // REAL ISHLAB TURGAN V1 ENDPOINT VA 1.5-FLASH MODELI
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        var prompt = $@"Siz {targetLanguage} tilini o'rgatuvchi tajribali ustozsiz. Quyida sizga JSON array ko'rinishida subtitrlar ro'yxati (ID va Text) beriladi:
    {subtitlesJson}

    GRAMMATIK QOIDALAR:
    {grammatik_qoidalar}

    VAZIFA:
    1. Ushbu matnni to'liq o'qing va uni mantiqiy tugallangan gaplarga ajrating (bir nechta subtitr bitta gap bo'lishi mumkin, bitta subtitleda bir nechta gap bo'lishi mumkin).
    2. Har bir ajratilgan to'liq gap qaysi Subtitle ID'ga eng ko'p mos kelsa, o'sha Subtitle ID ni ko'rsating.
    3. Har bir gap uchun uning tabiiy ma'nosi, SO'ZMA-SO'Z arxitekturasi (har bir qismning qat'iy ma'nosi va sintaktik roli) va eng muhim grammatik qoidasini sodda, tushunarli qilib O'ZBEK tilida Markdown formatida yozing.
    4. Har bir gapdan asosiy o'zak so'zlarni (Root words) va ularning o'zbek tilidagi aniq tarjimasini ajratib oling.
    5. GRAMMATIK QOIDALAR da berilgan qoidalardan tashqari boshqa qoidalarni ishlating shart emas, faqat berilgan qoidalardan foydalaning.
    6. Har bir gap Aynan qaysi qoidaga mos kelsa yoki bir nechtasining aralashmasiga mos kelsa, o'sha qoidalarning ID'larini [1,2..] ko'rsating. Odatda eng mos bittasi bo'ladi. agar biror bir qoidaga mos kelmasa, [] deb ko'rsating.
    7. Har bir gap analiz resultda grammatik qoida nomi ishlatilishi mumkin ammo uning id si ishlatilmasligi lozim.
    Natijalar FAKAT JSON array formatida bo'lishi shart. Har bir obyekt quyidagi formatda bo'lsin:
    - ""subtitleId"": (raqam) Ushbu gap qaysi subtitrga tegishli ekanligi.
    - ""sentenceText"": (string) Ajratib olingan inglizcha gap.
    - ""aiAnalysis"": (string) Shu gapning tabiiy tarjimasi, so'zma-so'z arxitekturasi va grammatik tahlili (Markdown formatida).
    - ""rootWords"": (array) Obyektlar ro'yxati, har bir obyektda ""word"" (inglizcha o'zak so'z) va ""translation"" (o'zbekcha tarjimasi).
    - ""grammarContextIds"": (array of integers) Gap mos keladigan qoidalarning faqat ID raqamlari massivi. Masalan: [1, 2]. Agar to'g'ri kelmasa [] yozing. Ichiga string yoki obyekt yozmang!
    Hech qanday qo'shimcha matn qo'shmang, faqat toza JSON array qaytaring.";

            // v1 endpointi uchun camelCase formatidagi toza JSON konfiguratsiyasi
        var requestBody = new
        {
            contents = new[] {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new { 
                temperature = 0.2,
                responseMimeType = "application/json",
                thinkingConfig = new { thinkingBudget = 0 }
            }
        };

        // System.Text.Json so'rovni camelCase formatida yuborishi uchun sozlama
        var serializeOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        
        Console.WriteLine("Grammar Promt Payload: "+JsonSerializer.Serialize(requestBody, serializeOptions));

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody, serializeOptions), 
            Encoding.UTF8, 
            "application/json"
        );
        int maxRetries = 5;
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                var response = await _httpClient.PostAsync(url, content);
                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    using var jsonDoc = JsonDocument.Parse(responseJson);
                    var textResult = jsonDoc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text").GetString();
                    if (string.IsNullOrEmpty(textResult)) return null;
                    
                    var cleanJson = textResult.Trim();
                    if (cleanJson.StartsWith("```json")) cleanJson = cleanJson.Substring(7);
                    else if (cleanJson.StartsWith("```")) cleanJson = cleanJson.Substring(3);
                    if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                    cleanJson = cleanJson.Trim();

                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    return JsonSerializer.Deserialize<List<SentenceAnalysisResult>>(cleanJson, options);
                }
                if ((int)response.StatusCode == 429 || (int)response.StatusCode == 503)
                {
                    int waitTime = 3000 * (i + 1);
                    Console.WriteLine($"Gemini band (Status: {response.StatusCode}). {waitTime/1000} seconds wait before retry...");
                    await Task.Delay(waitTime);
                    continue;
                }
                var errorDetails = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Gemini API Error: {response.StatusCode} - {errorDetails}");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Unexpected error: {ex.Message}");
                await Task.Delay(2000);
            }
        }
        return null;
    }

public async Task<float[]> GenerateEmbeddingAsync(string text)
{
    // 1. API kalit va matnni tekshirish
    if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey.Contains("YOUR_GEMINI") || string.IsNullOrWhiteSpace(text))
    {
        return Array.Empty<float>();
    }

    // 2. Model nomini eng oxirgi v1 versiyasiga moslashtiramiz
    var modelName = "gemini-embedding-2"; 
    var url = $"https://generativelanguage.googleapis.com/v1/models/{modelName}:embedContent?key={_apiKey}";

    // Request body
    var requestBody = new
    {
        // Google v1/v1beta API ba'zan model nomini tananing ichida ham to'liq so'raydi
        model = $"models/{modelName}", 
        content = new
        {
            parts = new[] { new { text = text } }
        }
    };

    // JSON serializer sozlamalari (PascalCase -> camelCase o'girish uchun)
    var options = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    try
    {
        var jsonPayload = JsonSerializer.Serialize(requestBody, options);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(url, content);
        
        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            
            // Google API javobida "embedding" -> "values" ichida float massiv keladi
            if (jsonDoc.RootElement.TryGetProperty("embedding", out var embedding) &&
                embedding.TryGetProperty("values", out var values))
            {
                var result = new float[values.GetArrayLength()];
                int index = 0;
                foreach (var val in values.EnumerateArray())
                {
                    result[index++] = (float)val.GetDouble();
                }
                return result;
            }
        }
        else
        {
            var error = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"Embedding API Error: {response.StatusCode} - {error}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Xatolik yuz berdi: {ex.Message}");
    }

    return Array.Empty<float>();
}

    public async Task<string> ChatWithContextAsync(string userMessage, List<EpisodeChatMessage> history, List<Subtitle> contextSubtitles, long? currentSubtitleId = null, string targetLanguage = "Ingliz")
    {
        var historyPairs = history?.Select(m => (m.Role, m.Content)) ?? Enumerable.Empty<(string Role, string Content)>();
        return await ExecuteChatWithContextAsync(userMessage, historyPairs, contextSubtitles, currentSubtitleId, targetLanguage);
    }

    public async Task<string> ChatWithContextAsync(string userMessage, List<MediaChatMessage> history, List<Subtitle> contextSubtitles, long? currentSubtitleId = null, string targetLanguage = "Ingliz")
    {
        var historyPairs = history?.Select(m => (m.Role, m.Content)) ?? Enumerable.Empty<(string Role, string Content)>();
        return await ExecuteChatWithContextAsync(userMessage, historyPairs, contextSubtitles, currentSubtitleId, targetLanguage);
    }

    private async Task<string> ExecuteChatWithContextAsync(string userMessage, IEnumerable<(string Role, string Content)> history, List<Subtitle> contextSubtitles, long? currentSubtitleId, string targetLanguage)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "Gemini API kaliti kiritilmagan.";

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        var systemInstruction = $@"Siz ingliz tili arxitekturasi va grammatikasi bo'yicha aniq, chuqur va o'ta ixcham AI ustozsiz. Foydalanuvchi {targetLanguage} tilini o'rganmoqda.
ASOSIY TALABLAR (TOKEN TEJASH VA ANIQLIK):
1. Kam token sarflash: Ortiqcha salom-alik, umumiy kirish yoki xulosalarsiz, to'g'ridan-to'g'ri, lo'nda va ixcham javob bering.
2. So'zma-so'z arxitektura: Faqat umumiy ma'no bilan cheklanmang! Foydalanuvchiga ingliz tili sintaktik arxitekturasini tushunishga yordam berish uchun gapning SO'ZMA-SO'Z (literal) ma'nosi va strukturaviy tuzilishini aniq ko'rsating.
3. Javob strukturasi:
   - 🎯 **Tabiiy ma'nosi**: Gapning kontekstdagi erkin, tabiiy tarjimasi.
   - 🧩 **So'zma-so'z arxitekturasi**: Gapdagi har bir so'z/birikmaning qat'iy so'zma-so'z ma'nosi va ularning bir-biriga bog'lanishi (fe'l shakli, predlog, zamon).
   - 💡 **Arxitektura mantiqi**: Nega ingliz tilida aynan shu konstruksiya ishlatilgani haqida 1-2 qisqa jumla.";

        var contents = new List<object>();

        // Past conversation history (truncated to recent messages by controller)
        foreach (var (role, content) in history)
        {
            contents.Add(new {
                role = role == "User" ? "user" : "model",
                parts = new[] { new { text = content } }
            });
        }

        // Current message with context
        var sb = new StringBuilder();
        if (contextSubtitles != null && contextSubtitles.Count > 0)
        {
            sb.AppendLine("KONTEKST (Subtitrlar):");
            foreach (var sub in contextSubtitles)
            {
                if (currentSubtitleId.HasValue && sub.Id == currentSubtitleId.Value)
                {
                    sb.AppendLine($"📍 [TANLANGAN GAP]: \"{sub.Text}\"");
                }
                else
                {
                    sb.AppendLine($"   \"{sub.Text}\"");
                }
            }
            sb.AppendLine();
        }
        sb.AppendLine($"Foydalanuvchi savoli: {userMessage}");

        contents.Add(new {
            role = "user",
            parts = new[] { new { text = sb.ToString() } }
        });

        var requestBody = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = systemInstruction } }
            },
            contents = contents,
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.2,
                maxOutputTokens = 450
            }
        };

        var requestContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync(url, requestContent);
        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();
                
            return textResult ?? "Kechirasiz, javobni shakllantirib bo'lmadi.";
        }
        
        var error = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"Chat API Error: {error}");
        return "Xatolik yuz berdi, iltimos qayta urinib ko'ring.";
    }

    public async Task<string> TranslateWordAsync(string word)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE" || string.IsNullOrWhiteSpace(word))
            return word;

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        var requestBody = new
        {
            contents = new[] {
                new { parts = new[] { new { text = $"Ushbu inglizcha so'zning o'zbekcha eng asosiy aniq tarjimasini qaytaring. Faqat tarjimaning o'zini yozing, hech qanday qo'shimcha so'z yoki belgi bo'lmasin. So'z: {word}" } } }
            },
            generationConfig = new { 
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.1,
                maxOutputTokens = 30
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            return textResult?.Trim() ?? word;
        }

        return word;
    }

    public async Task<string> TranscribeVoiceAudioAsync(byte[] audioBytes, string mimeType = "audio/ogg")
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE" || audioBytes == null || audioBytes.Length == 0)
            return "";

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        var base64Data = Convert.ToBase64String(audioBytes);

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { inlineData = new { mimeType = mimeType, data = base64Data } },
                        new { text = "Transcribe this audio precisely into plain text. Return ONLY the spoken words in their original language (Uzbek, Russian or English) without any explanations, formatting, markdown or preamble." }
                    }
                }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.1,
                maxOutputTokens = 400
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            return textResult?.Trim() ?? "";
        }

        var err = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"TranscribeVoiceAudioAsync error: {err}");
        return "";
    }

    public async Task<AiHomeworkAnalysisResult> AnalyzeAndGenerateHomeworkAsync(string text, string? teacherContext)
    {
        var result = new AiHomeworkAnalysisResult();
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE" || string.IsNullOrWhiteSpace(text))
            return result;

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var systemInstruction = @"Siz ingliz tili o'qituvchisiga guruh uchun uyga vazifani tahlil qilib beruvchi AI yordamchisiz.
Platformada QAT'IY 3 ta topshiriq turi mavjud:
1. 'Vocabulary': FAQAT va FAQAT o'qituvchi 'lug'at', 'dictionary', 'vocabulary', 'so'z' yoki 'Essential' (masalan: 'Essential Unit 1') deb aniq aytgandagina va u unit platforma bazasida mavjud bo'lgandagina ishlatiladi!
2. 'MediaSubmission': FAQAT va FAQAT o'qituvchi 'audio', 'voice', 'ovozli', 'video', 'rasm', 'photo' yoki 'yuklash' deb aniq talab qilgandagina ishlatiladi. Agar o'qituvchi 'mashqni bajaring' desa, lekin rasm/audio so'ramasa, bu MediaSubmission EMAS!
3. 'TextReminder': Darslik mashqlari (masalan: Murphy, Reading Explorer, Workbook, Grammatika), o'qish, takrorlash va platforma bazasida interaktiv testi bo'lmagan darslik unitlari uchun oddiy eslatma.

PLATFORMA BAZASIDAGI MAVJUD INTERAKTIV DARSLIKLAR VA UNITLAR:
1. '4000 Essential English Words 1': Hozirda FAQAT Part 1 dagi Unit 1 mavjud! (Boshqa unitlar, masalan Unit 2..30 bazada mavjud emas!).
2. 'Destination B1: Grammar & Vocabulary': Part 1 (Unit 1, Unit 2), Part 2 (Unit 3, Unit 4).
3. 'Oxford Word Skills (Basic)': Part 1 (Unit 1).

QAT'IY QOIDALAR (O'ZINGIZDAN ORTIQCHA AQLLILIK QILMANG):
- 'Essential' so'zi har doim Lug'at (Vocabulary) darsligini bildiradi.
- Agar o'qituvchi bazada MAVJUD BO'LMAGAN unitni aytsa (masalan: 'Essential Unit 9'): uni QAT'IY ravishda 'TextReminder' (eslatma) turida yarating! Chunki bazada yo'q unit uchun o'quvchiga so'zlarni yodlash yoki test tugmasi chiqmasligi, shunchaki eslatma bo'lib ko'rinishi shart!
- Faqat bazada real mavjud bo'lgan unitlar uchungina (masalan: Essential Unit 1) 'Vocabulary' turi beriladi.
- Agar matnda audio, video yoki rasm so'ralmagan bo'lsa, uni MediaSubmission qilmang! Qat'iy TextReminder qiling!
- Agar matnda lug'at, dictionary, so'z yoki essential bo'lmasa, uni Vocabulary qilmang!
- Har bir item uchun 'bookHint', 'partNumber' va 'unitNumber' maydonlarini aniqlab bering.

Faqat toza JSON qaytaring, hech qanday markdown yoki tashqi so'zlarsiz. Format:
{
  ""isHomework"": true,
  ""title"": ""Unit ..."",
  ""deadlineDays"": 2,
  ""deadlineTime"": ""20:00"",
  ""explanation"": ""Qisqa tavsiya"",
  ""unsupportedRequests"": null,
  ""items"": [
    {
      ""itemType"": ""TextReminder"" | ""Vocabulary"" | ""MediaSubmission"",
      ""title"": ""Qism nomi"",
      ""instructions"": ""O'quvchiga aniq vazifa yo'riqnomasi"",
      ""bookHint"": ""essential"" | ""destination"" | ""oxford"" | null,
      ""partNumber"": 1 | null,
      ""unitNumber"": 1 | null
    }
  ]
}";

        var userPrompt = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(teacherContext))
        {
            userPrompt.AppendLine($"O'qituvchining oldingi odatiy uslubi va shabloni:\n{teacherContext}\n");
        }
        userPrompt.AppendLine($"O'qituvchi yuborgan topshiriq matni:\n\"{text}\"");

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = userPrompt.ToString() } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.1,
                maxOutputTokens = 650
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString()?.Trim();

            if (!string.IsNullOrWhiteSpace(textResult))
            {
                var cleanJson = CleanJsonText(textResult);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsed = JsonSerializer.Deserialize<AiHomeworkAnalysisResult>(cleanJson, options);
                if (parsed != null) return parsed;
            }
        }

        // Fallback default
        result.Items.Add(new AiHomeworkAnalysisItem
        {
            ItemType = "TextReminder",
            Title = "Dars topshiriqlari",
            Instructions = text
        });
        return result;
    }

    public async Task<AiHomeworkAnalysisResult> RefineHomeworkDraftAsync(AiHomeworkAnalysisResult currentDraft, string modificationPrompt, string? teacherContext = null)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return currentDraft;

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var systemInstruction = @"Siz mavjud uyga vazifa loyihasini o'qituvchining ko'rsatmasiga binoan qat'iy va aniq tahrirlovchi AI mutaxassissiz.

PLATFORMA BAZASIDAGI MAVJUD INTERAKTIV DARSLIKLAR VA UNITLAR:
1. '4000 Essential English Words 1': Hozirda FAQAT Part 1 dagi Unit 1 mavjud! (Boshqa unitlar, masalan Unit 2..30 bazada mavjud emas!).
2. 'Destination B1: Grammar & Vocabulary': Part 1 (Unit 1, Unit 2), Part 2 (Unit 3, Unit 4).
3. 'Oxford Word Skills (Basic)': Part 1 (Unit 1).

O'QITUVCHINING O'ZGARTIRISH MATNINI TO'G'RI TUSHUNISH VA TO'LDIRISH QOIDALARI:
1. QO'SHISH ('qo'shimcha qil', 'qo'sh', 'yana', 'add'):
   - Agar 'dictionary', 'lug'at', 'vocabulary', 'so'z' yoki 'Essential' (masalan: 'essential unit 1 ni qo'sh', 'qo'shimcha qil dictionary unit 1') deb yozilgan bo'lsa:
     * Agar unit platforma bazasida MAVJUD bo'lsa (masalan: Essential Unit 1, Destination Unit 1..4): -> QAT'IY 'Vocabulary' turida topshiriq qo'shing!
     * Agar unit platforma bazasida MAVJUD BO'LMASA (masalan: Essential Unit 9): -> QAT'IY 'TextReminder' (eslatma) turida topshiriq qo'shing (chunki bazada yo'q unit uchun test/yodlash tugmasi chiqmasligi, shunchaki eslatma bo'lib ko'rinishi shart!).
   - Agar 'video', 'rasm', 'audio', 'voice', 'ovozli', 'speaking' deb yozilgan bo'lsa -> QAT'IY 'MediaSubmission' turida yangi topshiriq qo'shing!
   - Boshqa barcha mashqlar (masalan: '4-mashqni qo'sh', 'Workbook 15-betni qo'sh') uchun -> QAT'IY 'TextReminder' turida qo'shing!
   - O'zingizdan aqllilik qilib so'ralmagan topshiriqlarni qo'shmang!
2. OLIB TASHLASH / O'CHIRISH ('olib tashla', 'o'chir', 'kerak emas', 'remove', 'delete'):
   - Ko'rsatilgan topshiriqni ro'yxatdan olib tashlang.
3. MUDDAT VA SARLAVHA:
   - Muddat haqida yozilsa (masalan: 'muddatini ertaga 21:00 qil') -> deadlineDays va deadlineTime ni o'zgartiring.
   - Sarlavha haqida yozilsa (masalan: 'sarlavhani Unit 5 qil') -> title ni o'zgartiring.

ATAMALAR:
- 'Essential' har doim Lug'at (Vocabulary) darsligini bildiradi.
- Har bir item uchun 'bookHint', 'partNumber' va 'unitNumber' maydonlarini aniqlab bering.

Faqat toza JSON qaytaring, hech qanday markdown yoki tashqi so'zlarsiz. Format:
{
  ""isHomework"": true,
  ""title"": ""..."",
  ""deadlineDays"": 2,
  ""deadlineTime"": ""20:00"",
  ""explanation"": ""Qanday o'zgartirish kiritilgani haqida qisqa"",
  ""unsupportedRequests"": null,
  ""items"": [
    {
      ""itemType"": ""TextReminder"" | ""Vocabulary"" | ""MediaSubmission"",
      ""title"": ""..."",
      ""instructions"": ""..."",
      ""bookHint"": ""essential"" | ""destination"" | ""oxford"" | null,
      ""partNumber"": 1 | null,
      ""unitNumber"": 1 | null
    }
  ]
}";

        if (!string.IsNullOrWhiteSpace(teacherContext))
        {
            systemInstruction += $"\n\nO'QITUVCHI VA GURUH KONTEKSTI (Database qoidalari):\n{teacherContext}\nUshbu kontekst qoidalariga (atamalar, qisqartmalar, darsliklar) qat'iy rioya qiling!";
        }

        var draftJson = JsonSerializer.Serialize(currentDraft);
        var userPrompt = $"Joriy vazifa loyihasi (Draft):\n{draftJson}\n\nO'qituvchining o'zgartirish ko'rsatmasi:\n\"{modificationPrompt}\"";

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = userPrompt } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.1,
                maxOutputTokens = 650
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString()?.Trim();

            if (!string.IsNullOrWhiteSpace(textResult))
            {
                var cleanJson = CleanJsonText(textResult);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsed = JsonSerializer.Deserialize<AiHomeworkAnalysisResult>(cleanJson, options);
                if (parsed != null) return parsed;
            }
        }

        return currentDraft;
    }

    public async Task<string> LearnAndUpdateTeacherContextAsync(string currentContext, string publishedHomeworkSummary)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return currentContext;

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var prompt = $@"O'qituvchining yangi e'lon qilingan uyga vazifasi asosida uning shablon va odatlarini yangilang.
Mavjud kontekst: {currentContext}
Yangi e'lon qilingan vazifa: {publishedHomeworkSummary}
Qat'iy qoidalar:
- 'Essential' har doim Lug'at (Vocabulary) bo'yicha Unitlarni bildiradi.
- Faqat aniq aytilgandagina Vocabulary yoki MediaSubmission ishlatilishini inobatga oling.
Talab: O'qituvchining odatiy topshiriq turlari, muddatlari va uslubi haqida 2-3 ta ixcham jumla yozing (maksimal 70-100 so'z).";

        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.1,
                maxOutputTokens = 200
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            return textResult?.Trim() ?? currentContext;
        }

        return currentContext;
    }

    public async Task<string> AnswerStudentProQuestionAsync(string question, string groupTitle)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "Kechirasiz, AI xizmati vaqtincha mavjud emas.";

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var systemInstruction = $@"Siz '{groupTitle}' ta'lim guruhida ingliz tili bo'yicha insondek samimiy, lo'nda va tez javob beruvchi AI ustozsiz.
QAT'IY QOIDALAR:
1. SAVOLLARDAN KELIB CHIQIB JAVOB BERING:
   - Oddiy savollarga insondek ILOJI BORICHA QISQA, LO'NDA va aniq javob bering (ko'pincha 1-3 ta qisqa jumla yoki bitta aniq misol yetarli!).
   - Ortiqcha kirish so'zlarsiz, to'g'ridan-to'g'ri savolning javobini va qisqa misolini bering.
   - FAQAT va FAQAT talaba 'batafsil tushuntir', 'kengroq aytib ber' deb so'ragandagina yoki mavzu chuqur tahlilni talab qilsagina batafsilroq yozing.
2. FORMATLASH: Telegram HTML formatida javob bering. Hech qachon markdown formatidagi yulduzchalar (**matn**) ishlatmang! Qalin matn uchun <b>matn</b>, kursiv uchun <i>matn</i> teglaridan foydalaning.";

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = question } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.2,
                maxOutputTokens = 350
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            if (!string.IsNullOrWhiteSpace(textResult))
                return ConvertMarkdownToTelegramHtml(textResult.Trim());

            return "Savolingizga javob tayyorlashda xatolik yuz berdi.";
        }

        return "Kechirasiz, javob olishda xatolik yuz berdi.";
    }

    public async Task<string> AnswerStudentWithGroupContextAsync(string studentMessage, string groupTitle, string groupContext, string studentName)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "Kechirasiz, AI xizmati vaqtincha mavjud emas.";

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var systemInstruction = $@"Siz '{groupTitle}' ta'lim guruhida ingliz tili bo'yicha insondek samimiy, dono va professional AI ustoz/tyutorsiz.
Talaba '{studentName}' sizga murojaat qildi.

Guruh bo'yicha o'rganilayotgan dars va topshiriqlar konteksti:
{groupContext}

QAT'IY VAZIFALAR VA TALABLAR:
1. ASOSIY MAQSAD - YORDAM BERISH VA TIL O'RGATISH:
   - Talabaning ingliz tili bo'yicha har qanday savollariga insondek lo'nda, aniq va to'g'ri javob bering.
   - Agar talaba essey yoki matn yozgan bo'lsa: Uni diqqat bilan tahlil qiling, xatolarini (grammatika, imlo, so'z tanlash) ko'rsatib, to'g'ri variantini va tavsiyalarni <blockquote expandable>...</blockquote> ichida bering!
   - Agar talaba ingliz tilida erkin suhbat boshlasa: Samimiy tarzda ingliz tilida javob qaytarib suhbatlashing, kerak bo'lsa kichik grammatik tavsiyalarni <blockquote expandable> ichida bering.
2. QAT'IY CHEKLOV: FAQAT INGLIZ TILI VA TA'LIM:
   - Ingliz tili va til o'rganishdan mutlaqo chetga chiqmang! Agar talaba siyosat, begona sohalar yoki shaxsiy noo'rin mavzularda yozsa, xushmuomalalik bilan ingliz tiliga qaytaring.
3. FORMATLASH VA IQTIBOSLAR (BLOCKQUOTE):
   - Telegram HTML formatida javob bering. Hech qachon markdown formatidagi yulduzchalar (**matn**) ishlatmang!
   - Qalin matn uchun <b>matn</b>, kursiv uchun <i>matn</i> teglari.
   - Katta tushuntirishlar, grammatik qoidalar, essey tahlillari va misollarni QAT'IY ravishda <blockquote expandable>...</blockquote> ichida bering, shunda guruh chatida ko'p joy egallamaydi va o'quvchi xohlasa iqtibosni ochib to'liq o'qiydi.
   - Oddiy savol yoki qisqa gapga insondek ILOJI BORICHA QISQA javob bering (1-2 ta jumla).";

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = studentMessage } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.25,
                maxOutputTokens = 500
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.IsSuccessStatusCode)
        {
            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            if (!string.IsNullOrWhiteSpace(textResult))
                return ConvertMarkdownToTelegramHtml(textResult.Trim());

            return "Savolingizga javob tayyorlashda xatolik yuz berdi.";
        }

        return "Kechirasiz, javob olishda xatolik yuz berdi.";
    }

    public async Task<GroupMessageIntentResult> ClassifyGroupMessageIntentAsync(string text, bool isTeacher)
    {
        var result = new GroupMessageIntentResult();
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE" || string.IsNullOrWhiteSpace(text))
            return result;

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var systemInstruction = $@"Siz ta'lim guruhidagi Telegram xabarlarini tahlil qiluvchi AI intellektsiz.
Xabar yuboruvchi shaxs o'qituvchimi: {(isTeacher ? "HA (Ustoz/Admin)" : "YO'Q (O'quvchi)")}.

Xabarni quyidagi 4 ta toifadan faqat bittasiga ajrating:
1. 'AssignHomework': FAQAT o'qituvchi o'quvchilarga yangi uyga vazifa yoki yangi topshiriq topshirayotgan bo'lsa (masalan: 'Bolalar uyga vazifa: 5-mashq', 'Yangi so'zlarni yodlang va audio yuboring'). O'quvchi hech qachon vazifa bera olmaydi!
2. 'AskHomework': Foydalanuvchi (o'quvchi yoki boshqa a'zo) mavjud uyga vazifani so'rayotgan bo'lsa, vazifa nimaligini, muddati qachonligini yoki topshiriq haqida ma'lumot so'rayotgan bo'lsa (masalan: 'Uyga vazifa nima?', 'Bugun vazifa bormi?', 'Topshiriqni tashlang', 'What is the homework?').
3. 'AskEnglishQuestion': Foydalanuvchi ingliz tili qoidalari, grammatika, so'z tarjimasi yoki dars yuzasidan bevosita savol so'rayotgan bo'lsa.
4. 'CasualChat': Shunchaki salomlashish, minnatdorchilik, darsga oid bo'lmagan oddiy gaplar yoki guruh a'zolari o'rtasidagi erkin suhbat (masalan: 'Salom hammaga', 'Rahmat ustoz', 'Ha tushundim', 'OK').

Javobni FAQAT toza JSON formatida bering, markdown (` ```json `) siz:
{{
  ""intent"": ""AssignHomework"" | ""AskHomework"" | ""AskEnglishQuestion"" | ""CasualChat""
}}";

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = text } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.0,
                maxOutputTokens = 35
            }
        };

        try
        {
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseJson);
                var textResult = jsonDoc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString()?.Trim();

                if (!string.IsNullOrWhiteSpace(textResult))
                {
                    var cleanJson = CleanJsonText(textResult);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var parsed = JsonSerializer.Deserialize<GroupMessageIntentResult>(cleanJson, options);
                    if (parsed != null && !string.IsNullOrWhiteSpace(parsed.Intent))
                        return parsed;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ClassifyGroupMessageIntentAsync error: {ex.Message}");
        }

        return result;
    }

    public async Task<string> ExplainHomeworkToStudentAsync(
        string assignmentTitle,
        DateTime deadline,
        List<AssignmentItem> items,
        string studentQuestion,
        string studentName,
        string groupTitle)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
        {
            return $"Salom, {studentName}! 😊 Guruhimizdagi joriy uyga vazifa: <b>{assignmentTitle}</b>.\nTopshirish muddati: <b>{deadline:dd.MM.yyyy HH:mm}</b> gacha.";
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var itemsSb = new StringBuilder();
        int idx = 1;
        foreach (var it in items)
        {
            itemsSb.AppendLine($"{idx++}. {it.Title} ({it.ItemType}): {it.Instructions}");
        }

        var systemInstruction = $@"Siz '{groupTitle}' ta'lim guruhida ingliz tili o'qituvchisining do'stona, samimiy va jonli yordamchisisiz.
Talaba '{studentName}' uyga vazifa haqida so'radi.

Guruhdagi joriy uyga vazifa ma'lumotlari:
- Mavzu: {assignmentTitle}
- Topshirish muddati: {deadline:dd.MM.yyyy HH:mm} gacha
- Topshiriqlar tarkibi:
{itemsSb}

QAT'IY TALABLAR:
1. Insondek samimiy, ILOJI BORICHA QISQA va lo'nda tushuntiring (ko'pi bilan 2-3 ta ixcham jumla kifoya!). Masalan: 'Salom, {studentName}! 😊 Joriy vazifamiz: <b>{assignmentTitle}</b>. Unda yangi so'zlarni yodlab, topshiriqlarni bajarishingiz kerak. Muddati: <b>{deadline:dd.MM.yyyy HH:mm}</b> gacha.'
2. FAQAT talaba 'batafsil tushuntir' deb so'ragandagina har bir topshiriqni alohida kengroq yoriting.
3. FORMATLASH: Telegram HTML formatida yozing. Hech qachon markdown formatidagi yulduzchalar (**so'z**) ishlatmang! Qalin matn uchun <b>matn</b>, kursiv uchun <i>matn</i> teglaridan foydalaning.";

        var requestBody = new
        {
            systemInstruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = studentQuestion } } }
            },
            generationConfig = new
            {
                thinkingConfig = new { thinkingBudget = 0 },
                temperature = 0.3,
                maxOutputTokens = 350
            }
        };

        try
        {
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseJson);
                var textResult = jsonDoc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString()?.Trim();

                if (!string.IsNullOrWhiteSpace(textResult))
                    return ConvertMarkdownToTelegramHtml(textResult);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ExplainHomeworkToStudentAsync error: {ex.Message}");
        }

        return $"Salom, {studentName}! 😊 Guruhimizdagi joriy uyga vazifa: <b>{assignmentTitle}</b>.\nTopshirish muddati: <b>{deadline:dd.MM.yyyy HH:mm}</b> gacha.";
    }

    public static string ConvertMarkdownToTelegramHtml(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";

        // 1. Kod bloklari: ```code``` -> <pre>code</pre>, `code` -> <code>code</code>
        input = System.Text.RegularExpressions.Regex.Replace(input, @"```(?:[a-zA-Z0-9_-]+)?\n?(.*?)```", "<pre>$1</pre>", System.Text.RegularExpressions.RegexOptions.Singleline);
        input = System.Text.RegularExpressions.Regex.Replace(input, @"`([^`\n]+)`", "<code>$1</code>");

        // 2. Ro'yxatlar (bullet points): qator boshidagi * yoki - larni • ga aylantiramiz (kursivdan oldin bajarilishi shart!)
        input = System.Text.RegularExpressions.Regex.Replace(input, @"(?m)^\s*[\*\-]\s+", "• ");

        // 3. Sarlavhalar: ### Header -> <b>Header</b>
        input = System.Text.RegularExpressions.Regex.Replace(input, @"(?m)^#{1,6}\s*(.+)$", "<b>$1</b>");

        // 4. Qalin matn: **matn** yoki __matn__ -> <b>matn</b>
        input = System.Text.RegularExpressions.Regex.Replace(input, @"\*\*(.+?)\*\*", "<b>$1</b>", System.Text.RegularExpressions.RegexOptions.Singleline);
        input = System.Text.RegularExpressions.Regex.Replace(input, @"__(.+?)__", "<b>$1</b>", System.Text.RegularExpressions.RegexOptions.Singleline);

        // 5. Qiya matn: *matn* yoki _matn_ -> <i>matn</i> (bir qatorda, yangi qatorga o'tmagan holda)
        input = System.Text.RegularExpressions.Regex.Replace(input, @"(?<![a-zA-Z0-9*])\*([^\n*]+?)\*(?![a-zA-Z0-9*])", "<i>$1</i>");
        input = System.Text.RegularExpressions.Regex.Replace(input, @"(?<![a-zA-Z0-9_])_([^\n_]+?)_(?![a-zA-Z0-9_])", "<i>$1</i>");

        // 6. Markdown iqtiboslar: > matn -> <blockquote expandable>matn</blockquote>
        input = System.Text.RegularExpressions.Regex.Replace(
            input,
            @"(?m)(?:^>[ \t]*[^\n]*\r?\n?)+",
            match =>
            {
                var lines = match.Value.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
                    .Where(l => l.TrimStart().StartsWith(">"))
                    .Select(l =>
                    {
                        var trimmed = l.TrimStart();
                        return trimmed.Length > 1 && trimmed[1] == ' ' ? trimmed.Substring(2) : trimmed.Substring(1);
                    });
                var joined = string.Join("\n", lines).Trim();
                return string.IsNullOrWhiteSpace(joined) ? "" : $"<blockquote expandable>{joined}</blockquote>\n";
            });

        return input.Trim();
    }

    private static string CleanJsonText(string raw)
    {
        var clean = raw.Trim();
        if (clean.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            clean = clean.Substring(7);
        else if (clean.StartsWith("```"))
            clean = clean.Substring(3);

        if (clean.EndsWith("```"))
            clean = clean.Substring(0, clean.Length - 3);

        return clean.Trim();
    }
}
