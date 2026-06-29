using Lanswitch.Application.Interfaces;
using System.Diagnostics;

namespace Lanswitch.Infrastructure.Services;

public class VideoProcessor : IVideoProcessor
{
    public async Task<List<string>> ExtractAudioSegmentsAsync(string videoFilePath, int segmentTimeSeconds = 900)
    {
        var tempDir = Path.GetDirectoryName(videoFilePath) ?? Path.GetTempPath();
        var baseName = Path.GetFileNameWithoutExtension(videoFilePath);
        var outputPattern = Path.Combine(tempDir, baseName + "_chunk_%03d.wav");

        try
        {
            var processInfo = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -i \"{videoFilePath}\" -vn -acodec pcm_s16le -ar 16000 -ac 1 -f segment -segment_time {segmentTimeSeconds} \"{outputPattern}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            
            using var process = Process.Start(processInfo);
            if (process != null)
            {
                var outTask = process.StandardOutput.ReadToEndAsync();
                var errTask = process.StandardError.ReadToEndAsync();
                await Task.WhenAll(process.WaitForExitAsync(), outTask, errTask);
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"FFmpeg xatosi: {e.Message}");
        }

        var segments = System.IO.Directory.GetFiles(tempDir, baseName + "_chunk_*.wav")
                                          .OrderBy(f => f)
                                          .ToList();
        return segments;
    }

    public async Task<string> ExtractFullAudioAsync(string videoFilePath)
    {
        var tempDir = Path.GetDirectoryName(videoFilePath) ?? Path.GetTempPath();
        var baseName = Path.GetFileNameWithoutExtension(videoFilePath);
        var outputPath = Path.Combine(tempDir, baseName + "_full.mp3");

        try
        {
            var processInfo = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -i \"{videoFilePath}\" -vn -c:a libmp3lame -q:a 4 \"{outputPath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            
            using var process = Process.Start(processInfo);
            if (process != null)
            {
                var outTask = process.StandardOutput.ReadToEndAsync();
                var errTask = process.StandardError.ReadToEndAsync();
                await Task.WhenAll(process.WaitForExitAsync(), outTask, errTask);
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"FFmpeg xatosi (Full Audio): {e.Message}");
        }

        return System.IO.File.Exists(outputPath) ? outputPath : string.Empty;
    }
}
