using Lanswitch.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using TL;

namespace Lanswitch.Infrastructure.Services;

public class MTProtoClientService : IMTProtoClient
{
    private readonly WTelegram.Client _client;
    private readonly string _botToken;

    public MTProtoClientService(WTelegram.Client client, IConfiguration config)
    {
        _client = client;
        _botToken = config["BotConfiguration:BotToken"] ?? throw new Exception("BotToken missing");

        // 🔥 MANA SHU QATORNI QO'SHING: 
        // Linux tizimida vaqtinchalik papkani RAM dan asosiy diskdagi /home papkasiga ko'chiradi
        Environment.SetEnvironmentVariable("TMPDIR", "/home/ubuntu/mytemp");
        Directory.CreateDirectory("/home/ubuntu/mytemp"); // Papka mavjud bo'lmasa, yaratadi
    }

    public async Task LoginBotIfNeededAsync()
    {
        await _client.LoginBotIfNeeded(_botToken);
    }

    public async Task DownloadMessageMediaAsync(int messageId, Stream destinationStream)
    {
        var messagesRes = await _client.Messages_GetMessages(new[] { new TL.InputMessageID { id = messageId } });
        
        if (messagesRes.Messages.Length == 0 || messagesRes.Messages[0] is not TL.Message mtMessage)
        {
            throw new Exception("MTProto orqali xabarni topib bo'lmadi.");
        }

        if (mtMessage.media is not TL.MessageMediaDocument mediaDoc || mediaDoc.document is not TL.Document document)
        {
            throw new Exception("MTProto xabaridan videoni ajratib bo'lmadi.");
        }

        await _client.DownloadFileAsync(document, destinationStream);
    }
}