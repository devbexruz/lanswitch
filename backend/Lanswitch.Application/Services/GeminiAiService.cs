using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Services;

public class GeminiAiService : IGeminiAiService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public GeminiAiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Gemini:ApiKey"] ?? throw new ArgumentNullException("Gemini ApiKey is missing");
    }

    public async Task<GeminiAnalysisResult?> AnalyzeGrammarAsync(string subtitleText, List<GrammarContext> existingContexts)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
        {
            // Fallback for missing API Key (return null or mock)
            return null;
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key={_apiKey}";

        var existingRulesContext = JsonSerializer.Serialize(existingContexts.Select(c => new { c.Id, c.Name, c.Description }));

        var prompt = $@"You are an expert English linguist. Analyze the following sentence:
""{subtitleText}""

Here are the existing grammar rules in our database (JSON):
{existingRulesContext}

Identify the most prominent grammatical structure or idiom used in this sentence.
If it matches one of the existing grammar rules perfectly, return JSON with 'isNewRule': false, 'matchedRuleId': <id>, and 'gapWord': <the exact substring from the sentence that represents this rule>.
If it introduces a significant new grammar rule not present in the list, formulate a new rule and return JSON with 'isNewRule': true, 'newRuleName': <short name>, 'newRuleDescription': <short description>, 'newRuleContent': <detailed explanation in Markdown>, and 'gapWord': <the exact substring>.

Respond ONLY with valid JSON and nothing else, without markdown code blocks formatting.
Example output format:
{{
  ""isNewRule"": false,
  ""matchedRuleId"": 1,
  ""gapWord"": ""have been""
}}
OR
{{
  ""isNewRule"": true,
  ""newRuleName"": ""Present Perfect Continuous"",
  ""newRuleDescription"": ""Indicates an action that started in the past and continues to the present."",
  ""newRuleContent"": ""# Present Perfect Continuous\nUsed for continuous actions..."",
  ""gapWord"": ""have been working""
}}";

        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new
            {
                temperature = 0.2, // Low temperature for consistent JSON output
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        try
        {
            var response = await _httpClient.PostAsync(url, content);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Gemini API Error: {err}");
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(responseJson);
            var textResult = jsonDoc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            if (textResult == null) return null;

            // Sometimes the model wraps the response in ```json ... ```
            var cleanJson = textResult.Trim();
            if (cleanJson.StartsWith("```json"))
            {
                cleanJson = cleanJson.Substring(7);
                if (cleanJson.EndsWith("```"))
                {
                    cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                }
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            return JsonSerializer.Deserialize<GeminiAnalysisResult>(cleanJson, options);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error calling Gemini: {ex.Message}");
            return null;
        }
    }
}
