namespace Lanswitch.Application.Interfaces;

public interface ICloudStorageService
{
    Task<string> UploadVideoAsync(string fileName, Stream fileStream);
    Task<string> UploadSubtitleAsync(string fileName, Stream fileStream);
    Task<string> UploadImageAsync(string fileName, Stream fileStream, string contentType);
}
