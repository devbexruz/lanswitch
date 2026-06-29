using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Whisper.net;

namespace Lanswitch.Infrastructure.Services;

public class WhisperLocalService : IWhisperLocalService
{
    private readonly string _modelPath;
    private readonly HttpClient _httpClient;

    public WhisperLocalService(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _modelPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ggml-tiny.en.bin");
    }

    private async Task DownloadModelIfNotExistsAsync()
    {
        if (File.Exists(_modelPath))
        {
            var info = new FileInfo(_modelPath);
            if (info.Length > 70_000_000) // ggml-tiny.en.bin is ~77MB
                return; // Valid file exists
            else
                File.Delete(_modelPath); // Delete invalid/partial file
        }

        var tempPath = _modelPath + ".tmp";
        var modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
        
        _httpClient.Timeout = TimeSpan.FromMinutes(10); // Increase timeout for slow connections
        
        using var response = await _httpClient.GetAsync(modelUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        
        using (var fs = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await response.Content.CopyToAsync(fs);
        }
        
        File.Move(tempPath, _modelPath);
    }

    public async Task<List<Subtitle>> TranscribeAudioAsync(List<string> audioFilePaths, long mediaId)
    {
        await DownloadModelIfNotExistsAsync();

        var subtitles = new List<Subtitle>();
        int currentIndex = 1;
        int chunkIndex = 0;

        using var whisperFactory = WhisperFactory.FromPath(_modelPath);
        using var processor = whisperFactory.CreateBuilder()
            .WithLanguage("en")
            .Build();

        foreach (var chunkPath in audioFilePaths)
        {
            try
            {
                if (!File.Exists(chunkPath)) continue;

                TimeSpan chunkOffset = TimeSpan.FromMinutes(chunkIndex * 15);

                using var fileStream = File.OpenRead(chunkPath);
                
                await foreach (var segment in processor.ProcessAsync(fileStream))
                {
                    subtitles.Add(new Subtitle
                    {
                        MediaId = mediaId,
                        Index = currentIndex++,
                        StartTime = segment.Start.Add(chunkOffset),
                        EndTime = segment.End.Add(chunkOffset),
                        Text = segment.Text.Trim()
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Whisper xatosi (chunk {chunkIndex}): {ex.Message}");
            }
            finally
            {
                chunkIndex++;
                try { if (File.Exists(chunkPath)) File.Delete(chunkPath); } catch { }
            }
        }

        return subtitles;
    }
}
