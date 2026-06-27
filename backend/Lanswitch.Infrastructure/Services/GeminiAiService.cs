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

namespace Lanswitch.Infrastructure.Services;

public class GeminiAiService : IGeminiAiService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly IFileStorageService _fileStorage;

    public GeminiAiService(HttpClient httpClient, IConfiguration configuration, IFileStorageService fileStorage)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Gemini:ApiKey"] ?? throw new ArgumentNullException("Gemini ApiKey is missing");
        _fileStorage = fileStorage;
        _httpClient.Timeout = TimeSpan.FromMinutes(10);
    }

    private class GeminiSubtitleDto
    {
        public int Index { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string? Text { get; set; }
    }

    public async Task<List<Subtitle>> TranscribeAudioAsync(string audioFilePath, long mediaId)
    {
        var subtitles = new List<Subtitle>();
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return subtitles;
        var uploadUrl = $"https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key={_apiKey}";
        var audioBytes = await _fileStorage.ReadAsync(audioFilePath);
        using var uploadContent = new ByteArrayContent(audioBytes);
        uploadContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mp3");
        uploadContent.Headers.Add("X-Goog-Upload-Mime-Type", "audio/mp3");
        var uploadResponse = await _httpClient.PostAsync(uploadUrl, uploadContent);
        if (!uploadResponse.IsSuccessStatusCode)
        {
            var err = await uploadResponse.Content.ReadAsStringAsync();
            Console.WriteLine($"Gemini Upload Error: {err}");
            return subtitles;
        }
        var uploadJson = await uploadResponse.Content.ReadAsStringAsync();
        var uploadDoc = JsonDocument.Parse(uploadJson);
        var fileUri = uploadDoc.RootElement.GetProperty("file").GetProperty("uri").GetString();
        if (string.IsNullOrEmpty(fileUri)) return subtitles;
        var generateUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key={_apiKey}";
        var prompt = "Listen to this audio. Generate full subtitles for it. Return ONLY a JSON array of objects. Each object must have exactly these keys: 'Index' (integer starting from 1), 'StartTime' (string format 'hh:mm:ss,fff'), 'EndTime' (string format 'hh:mm:ss,fff'), and 'Text' (string containing the exact spoken English sentence). Do not include any markdown formatting or extra text, just the raw JSON array.";
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
            Console.WriteLine($"Gemini Transcription Error: {err}");
            return subtitles;
        }
        var responseJson = await response.Content.ReadAsStringAsync();
        var jsonDoc = JsonDocument.Parse(responseJson);
        var textResult = jsonDoc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text").GetString();
        if (string.IsNullOrWhiteSpace(textResult)) return subtitles;
        var cleanJson = textResult.Trim();
        if (cleanJson.StartsWith("```json"))
        {
            cleanJson = cleanJson.Substring(7);
            if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
        }
        else if (cleanJson.StartsWith("```"))
        {
            cleanJson = cleanJson.Substring(3);
            if (cleanJson.EndsWith("```")) cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
        }
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var dtoList = JsonSerializer.Deserialize<List<GeminiSubtitleDto>>(cleanJson.Trim(), options);
            if (dtoList != null)
            {
                foreach (var dto in dtoList)
                {
                    TimeSpan.TryParse(dto.StartTime?.Replace(',', '.'), out var st);
                    TimeSpan.TryParse(dto.EndTime?.Replace(',', '.'), out var et);
                    subtitles.Add(new Subtitle
                    {
                        MediaId = mediaId,
                        Index = dto.Index,
                        StartTime = st,
                        EndTime = et,
                        Text = dto.Text ?? ""
                    });
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parsing Gemini transcription: {ex.Message}");
        }
        return subtitles;
    }

    public async Task<GeminiAnalysisResult?> AnalyzeGrammarAsync(string subtitleText, List<GrammarContext> existingContexts)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            return null;
        var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={_apiKey}";
        var existingRulesContext = JsonSerializer.Serialize(existingContexts.Select(c => new { c.Id, c.Name, c.Description }));
        var prompt = $@"You are an expert English linguist. Analyze this sentence: ""{subtitleText}""\n\nExisting grammar rules (JSON format):\n{existingRulesContext}\n\nTASK:\n1. Identify the most important grammar rule or idiom in the sentence.\n2. If it matches an existing rule, set 'isNewRule' to false and provide 'matchedRuleId'.\n3. If it's a new rule, set 'isNewRule' to true and provide 'newRuleName', 'newRuleDescription', and 'newRuleContent'.\n4. 'gapWord' must be the exact substring from the sentence.\n\nCRITICAL: If 'isNewRule' is true, you MUST write 'newRuleName', 'newRuleDescription', and 'newRuleContent' in UZBEK language (O'zbek tilida). Explain simply for beginners.\n\nThe output MUST be a valid JSON object matching the requested structure.";
        var requestBody = new
        {
            contents = new[] {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new { temperature = 0.2, response_mime_type = "application/json" }
        };
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
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
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    return JsonSerializer.Deserialize<GeminiAnalysisResult>(textResult, options);
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
}
