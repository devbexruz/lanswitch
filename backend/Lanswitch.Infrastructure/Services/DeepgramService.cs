using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Deepgram;
using Deepgram.Models.Listen.v1.REST;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Infrastructure.Services;

public class DeepgramService : IDeepgramService
{
    private readonly string _apiKey;

    public DeepgramService(IConfiguration configuration)
    {
        _apiKey = configuration["Deepgram:ApiKey"] ?? string.Empty;
    }

    public async Task<DeepgramResult> TranscribeAudioAsync(string fullAudioPath, long mediaId, string langCode = "en")
    {
        var result = new DeepgramResult();

        var logFile = "deepgram_debug.txt";
        File.AppendAllText(logFile, $"[{DateTime.UtcNow}] TranscribeAudioAsync called for {fullAudioPath}, langCode: {langCode}\n");
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow}] API Key is missing!\n");
            Console.WriteLine("DeepgramService: API Key is missing!");
            return result;
        }
        if (!File.Exists(fullAudioPath))
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow}] File does not exist: {fullAudioPath}\n");
            Console.WriteLine("DeepgramService: File does not exist!");
            return result;
        }

        File.AppendAllText(logFile, $"[{DateTime.UtcNow}] File exists and API key is present. Sending request to Deepgram...\n");
        Console.WriteLine("DeepgramService: File exists and API key is present. Sending request...");

        try
        {
            using var client = new System.Net.Http.HttpClient();
            client.Timeout = TimeSpan.FromHours(1); // Kutish vaqtini 1 soatgacha uzaytiramiz
            client.DefaultRequestHeaders.Add("Authorization", $"Token {_apiKey}");

            var url = $"https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language={langCode}&utterances=true&punctuate=true";
            using var content = new System.Net.Http.StreamContent(File.OpenRead(fullAudioPath));
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/mpeg");

            var response = await client.PostAsync(url, content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                File.AppendAllText(logFile, $"[{DateTime.UtcNow}] Deepgram Error {response.StatusCode}: {errorBody}\n");
                Console.WriteLine($"DeepgramService: Error {response.StatusCode} - {errorBody}");
                throw new Exception($"Deepgram status xatosi: {response.StatusCode}, Detal: {errorBody}");
            }

            File.AppendAllText(logFile, $"[{DateTime.UtcNow}] Received 200 OK from Deepgram\n");
            Console.WriteLine("DeepgramService: Received 200 OK from Deepgram");
            var jsonResponse = await response.Content.ReadAsStringAsync();
            var parsed = System.Text.Json.JsonDocument.Parse(jsonResponse);
            
            if (parsed.RootElement.TryGetProperty("results", out var resultsProp) && 
                resultsProp.TryGetProperty("utterances", out var utterancesProp) && 
                utterancesProp.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                File.AppendAllText(logFile, $"[{DateTime.UtcNow}] Found {utterancesProp.GetArrayLength()} utterances in Deepgram response\n");
                int index = 1;
                foreach (var utterance in utterancesProp.EnumerateArray())
                {
                    result.Subtitles.Add(new Subtitle
                    {
                        MediaId = mediaId,
                        Index = index++,
                        StartTime = TimeSpan.FromSeconds(utterance.GetProperty("start").GetDouble()),
                        EndTime = TimeSpan.FromSeconds(utterance.GetProperty("end").GetDouble()),
                        Text = utterance.GetProperty("transcript").GetString() ?? string.Empty
                    });
                }
            }
            else
            {
                File.AppendAllText(logFile, $"[{DateTime.UtcNow}] No utterances found in Deepgram response. JSON: {jsonResponse}\n");
            }

            return result;
        }
        catch (Exception ex)
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow}] Deepgram Exception: {ex.Message}\n{ex.StackTrace}\n");
            Console.WriteLine($"Deepgram Error: {ex.Message}");
            throw new Exception($"Deepgram API xatosi: {ex.Message}", ex);
        }
    }
}
