using Lanswitch.Application.Interfaces;
using System.Diagnostics;

namespace Lanswitch.Infrastructure.Services;

public class VideoProcessor : IVideoProcessor
{
    public async Task<string> ExtractAudioAsync(string videoFilePath)
    {
        var tempDir = Path.GetDirectoryName(videoFilePath) ?? Path.GetTempPath();
        var baseName = Path.GetFileNameWithoutExtension(videoFilePath);
        var audioPath = Path.Combine(tempDir, baseName + ".mp3");

        try
        {
            var processInfo = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -i \"{videoFilePath}\" -vn -acodec libmp3lame -b:a 32k -ac 1 \"{audioPath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            
            using var process = Process.Start(processInfo);
            if (process != null)
            {
                await process.WaitForExitAsync();
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"FFmpeg xatosi: {e.Message}");
        }

        return audioPath;
    }
}
