namespace Lanswitch.Application.Interfaces;

public interface IVideoProcessor
{
    Task<string> GenerateSubtitleSrtAsync(string videoFilePath);
}
