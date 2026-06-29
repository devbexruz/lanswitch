namespace Lanswitch.Application.Interfaces;

public interface IVideoProcessor
{
    Task<List<string>> ExtractAudioSegmentsAsync(string videoFilePath, int segmentTimeSeconds = 900);
    Task<string> ExtractFullAudioAsync(string videoFilePath);
}
