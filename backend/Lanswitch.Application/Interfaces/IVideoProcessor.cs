namespace Lanswitch.Application.Interfaces;

public interface IVideoProcessor
{
    Task<string> ExtractAudioAsync(string videoFilePath);
}
