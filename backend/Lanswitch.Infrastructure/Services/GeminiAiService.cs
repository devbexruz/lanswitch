using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Lanswitch.Application.Interfaces;
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
                    generationConfig = new { temperature = 0.1 }
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
    3. Har bir gap uchun uning ma'nosini va eng muhim grammatik qoidasini sodda, tushunarli qilib O'ZBEK tilida Markdown formatida yozing.
    4. Har bir gapdan asosiy o'zak so'zlarni (Root words) va ularning o'zbek tilidagi aniq tarjimasini ajratib oling.
    5. GRAMMATIK QOIDALAR da berilgan qoidalardan tashqari boshqa qoidalarni ishlating shart emas, faqat berilgan qoidalardan foydalaning.
    6. Har bir gap Aynan qaysi qoidaga mos kelsa yoki bir nechtasining aralashmasiga mos kelsa, o'sha qoidalarning ID'larini [1,2..] ko'rsating. Odatda eng mos bittasi bo'ladi. agar biror bir qoidaga mos kelmasa, [] deb ko'rsating.
    7. Har bir gap analiz resultda grammatik qoida nomi ishlatilishi mumkin ammo uning id si ishlatilmasligi lozim.
    Natijalar FAKAT JSON array formatida bo'lishi shart. Har bir obyekt quyidagi formatda bo'lsin:
    - ""subtitleId"": (raqam) Ushbu gap qaysi subtitrga tegishli ekanligi.
    - ""sentenceText"": (string) Ajratib olingan inglizcha gap.
    - ""aiAnalysis"": (string) Shu gapning tarjimasi va grammatik tahlili (Markdown formatida, misollar bilan).
    - ""rootWords"": (array) Obyektlar ro'yxati, har bir obyektda ""word"" (inglizcha o'zak so'z) va ""translation"" (o'zbekcha tarjimasi).
    - ""grammarContextIds"": (array of integers) Obyektlar ro'yxati, har bir obyektda ""grammarContextId"" (inglizcha grammatik qoida ID'si) va ""translation"" (o'zbekcha tarjimasi).
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
                responseMimeType = "application/json" // gemini-1.5-flash buni v1 da qo'llab-quvvatlaydi
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
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "Gemini API kaliti kiritilmagan.";

        var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        var contents = new List<object>();
        
        // System context + Subtitles
        var sb = new StringBuilder();
        sb.AppendLine($"Siz foydalanuvchiga videodagi iboralar va grammatikani tushunishga yordam beradigan ustozsiz. Foydalanuvchi {targetLanguage} tilini o'rganmoqda.");
        sb.AppendLine("Quyida foydalanuvchi tanlagan va undan oldingi subtitrlar konteksti keltirilgan:");
        foreach (var sub in contextSubtitles)
        {
            if (currentSubtitleId.HasValue && sub.Id == currentSubtitleId.Value)
            {
                sb.AppendLine($"[Vaqt: {sub.StartTime} - {sub.EndTime}] (BU HOZIRGI TANLANGAN SUBTITR): {sub.Text}");
            }
            else
            {
                sb.AppendLine($"[Vaqt: {sub.StartTime} - {sub.EndTime}]: {sub.Text}");
            }
        }
        sb.AppendLine("\nUshbu kontekst asosida foydalanuvchining savoliga Markdown formatida, juda qisqa (maksimal 2-3 ta gap), aniq va lo'nda javob bering. Javobingiz faqat 'HOZIRGI TANLANGAN SUBTITR' dagi ma'noga qaratilsin, ortiqcha ma'lumot yozmang.");
        
        contents.Add(new {
            role = "user",
            parts = new[] { new { text = sb.ToString() } }
        });
        contents.Add(new {
            role = "model",
            parts = new[] { new { text = "Tushundim, tayyorman!" } }
        });

        // Chat History
        foreach (var msg in history)
        {
            contents.Add(new {
                role = msg.Role == "User" ? "user" : "model",
                parts = new[] { new { text = msg.Content } }
            });
        }
        
        // Current Message
        contents.Add(new {
            role = "user",
            parts = new[] { new { text = userMessage } }
        });

        var requestBody = new { contents = contents };
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
    public async Task<string> ChatWithContextAsync(string userMessage, List<MediaChatMessage> history, List<Subtitle> contextSubtitles, long? currentSubtitleId = null, string targetLanguage = "Ingliz")
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return "Gemini API kaliti kiritilmagan.";

        var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        var contents = new List<object>();
        
        // System context + Subtitles
        var sb = new StringBuilder();
        sb.AppendLine($"Siz foydalanuvchiga videodagi iboralar va grammatikani tushunishga yordam beradigan ustozsiz. Foydalanuvchi {targetLanguage} tilini o'rganmoqda.");
        sb.AppendLine("Quyida foydalanuvchi tanlagan va undan oldingi subtitrlar konteksti keltirilgan:");
        foreach (var sub in contextSubtitles)
        {
            if (currentSubtitleId.HasValue && sub.Id == currentSubtitleId.Value)
            {
                sb.AppendLine($"[Vaqt: {sub.StartTime} - {sub.EndTime}] (BU HOZIRGI TANLANGAN SUBTITR): {sub.Text}");
            }
            else
            {
                sb.AppendLine($"[Vaqt: {sub.StartTime} - {sub.EndTime}]: {sub.Text}");
            }
        }
        sb.AppendLine("\nUshbu kontekst asosida foydalanuvchining savoliga Markdown formatida, juda qisqa (maksimal 2-3 ta gap), aniq va lo'nda javob bering. Javobingiz faqat 'HOZIRGI TANLANGAN SUBTITR' dagi ma'noga qaratilsin, ortiqcha ma'lumot yozmang.");
        
        contents.Add(new {
            role = "user",
            parts = new[] { new { text = sb.ToString() } }
        });
        contents.Add(new {
            role = "model",
            parts = new[] { new { text = "Tushundim, tayyorman!" } }
        });

        // Chat History
        foreach (var msg in history)
        {
            contents.Add(new {
                role = msg.Role == "User" ? "user" : "model",
                parts = new[] { new { text = msg.Content } }
            });
        }
        
        // Current Message
        contents.Add(new {
            role = "user",
            parts = new[] { new { text = userMessage } }
        });

        var requestBody = new { contents = contents };
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

        var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        
        var requestBody = new
        {
            contents = new[] {
                new { parts = new[] { new { text = $"Faqatgina ushbu inglizcha so'zning o'zbekcha tarjimasini qaytaring. Ortiqcha gap, belgi va tushuntirish kerak emas. So'z: {word}" } } }
            },
            generationConfig = new { temperature = 0.1 }
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
}
