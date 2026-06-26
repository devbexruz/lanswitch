using Lanswitch.Application.Interfaces;
using System.Diagnostics;

namespace Lanswitch.Infrastructure.Services;

public class VideoProcessor : IVideoProcessor
{
    public async Task<string> GenerateSubtitleSrtAsync(string videoFilePath)
    {
        var tempDir = Path.GetDirectoryName(videoFilePath) ?? Path.GetTempPath();
        var baseName = Path.GetFileNameWithoutExtension(videoFilePath);
        var srtPath = Path.Combine(tempDir, baseName + ".srt");

        try
        {
            var processInfo = new ProcessStartInfo
            {
                FileName = "python",
                Arguments = $"-m whisper \"{videoFilePath}\" --model small --language en --output_format srt --output_dir \"{tempDir}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8,
                StandardErrorEncoding = System.Text.Encoding.UTF8
            };
            
            var wingetPath = Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Microsoft\WinGet\Links");
            if (!processInfo.EnvironmentVariables["PATH"].Contains(wingetPath, StringComparison.OrdinalIgnoreCase))
            {
                processInfo.EnvironmentVariables["PATH"] = wingetPath + ";" + processInfo.EnvironmentVariables["PATH"];
            }

            using var process = Process.Start(processInfo);
            if (process != null)
            {
                var outputTask = process.StandardOutput.ReadToEndAsync();
                var errorTask = process.StandardError.ReadToEndAsync();
                
                await Task.WhenAll(process.WaitForExitAsync(), outputTask, errorTask);
                
                if (!string.IsNullOrEmpty(errorTask.Result))
                {
                    Console.WriteLine($"Whisper info/error: {errorTask.Result}");
                }
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"Whisper xatosi: {e.Message}");
        }

        return srtPath;
    }
}
