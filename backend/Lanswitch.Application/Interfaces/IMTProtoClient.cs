namespace Lanswitch.Application.Interfaces;

public interface IMTProtoClient
{
    Task LoginBotIfNeededAsync();
    Task DownloadMessageMediaAsync(int messageId, Stream destinationStream);
}
