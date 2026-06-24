using Amazon.S3;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Configuration;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using TL;
using WTelegram;

namespace Lanswitch.Infrastructure.Services;

public class TelegramBotHandler
{
    private readonly ITelegramBotClient _botClient;
    private readonly IConfiguration _config;
    private readonly AmazonS3Client _s3Client;
    private readonly WTelegram.Client _mtClient;

    public TelegramBotHandler(ITelegramBotClient botClient, IConfiguration config, WTelegram.Client mtClient)
    {
        _botClient = botClient;
        _config = config;
        _mtClient = mtClient;

        // Cloudflare R2 klientini sozlash
        var accountId = _config["CloudflareR2:AccountId"];
        var s3Config = new AmazonS3Config 
        { 
            ServiceURL = $"https://{accountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true
        };
        
        _s3Client = new AmazonS3Client(
            _config["CloudflareR2:AccessKey"],
            _config["CloudflareR2:SecretKey"],
            s3Config
        );
    }

    public async Task HandleUpdateAsync(Telegram.Bot.Types.Update update)
    {
        // Faqat video xabarlarni ushlab qolamiz
        if (update.Message is not { } message) return;
        
        var chatId = message.Chat.Id;

        if (message.Type != MessageType.Video)
        {
            await _botClient.SendTextMessageAsync(chatId, "Iltimos, menga faqat anime videolarini yuboring! 🎥");
            return;
        }

        var video = message.Video;
        var statusMsg = await _botClient.SendTextMessageAsync(chatId, "Video qabul qilindi. Serverga yuklanmoqda... ⏳");

        try
        {
            var fileId = video!.FileId;
            var fileName = video.FileName ?? $"anime_{fileId}.mp4";
            
            var bucketName = _config["CloudflareR2:BucketName"];
            var s3Key = $"anime_videos/{fileName}"; // Papka nomi lanswitch uchun maxsus
            var botToken = _config["BotConfiguration:BotToken"];

            await _botClient.EditMessageTextAsync(chatId, statusMsg.MessageId, "Telegramdan MTProto orqali videoni yuklab olish boshlandi (Limit 2GB)... ⏳");

            // 1. WTelegramClient orqali botga ulanish (faqat birinchi marta keshlanadi)
            await _mtClient.LoginBotIfNeeded(botToken);

            // 2. HTTP Webhook dagi MessageId orqali MTProto dagi asl xabarni qidirish
            var messagesRes = await _mtClient.Messages_GetMessages(new[] { new TL.InputMessageID { id = message.MessageId } });
            
            if (messagesRes.Messages.Length == 0 || messagesRes.Messages[0] is not TL.Message mtMessage)
            {
                throw new Exception("MTProto orqali xabarni topib bo'lmadi.");
            }

            if (mtMessage.media is not TL.MessageMediaDocument mediaDoc || mediaDoc.document is not TL.Document document)
            {
                throw new Exception("MTProto xabaridan videoni ajratib bo'lmadi.");
            }

            // 3. Videoni vaqtinchalik serverga yuklash (S3 ga stream qilish murakkab bo'lgani uchun)
            var tempPath = Path.Combine(Path.GetTempPath(), fileName);
            using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write))
            {
                await _mtClient.DownloadFileAsync(document, fileStream);
            }

            await _botClient.EditMessageTextAsync(chatId, statusMsg.MessageId, "Video olingach, Whisper orqali subtitr yaratilmoqda... ⏳ (Bu biroz vaqt olishi mumkin)");

            // 4. Whisper orqali subtitr (.srt) yaratish
            var tempDir = Path.GetDirectoryName(tempPath);
            var baseName = Path.GetFileNameWithoutExtension(fileName);
            var srtPath = Path.Combine(tempDir!, baseName + ".srt");

            try
            {
                var processInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "python",
                    Arguments = $"-m whisper \"{tempPath}\" --model small --language en --output_format srt --output_dir \"{tempDir}\"",
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

                using var process = System.Diagnostics.Process.Start(processInfo);
                if (process != null)
                {
                    // OS bufferi to'lib qolib, jarayon qotib qolmasligi uchun o'qib tashlaymiz
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

            await _botClient.EditMessageTextAsync(chatId, statusMsg.MessageId, "Subtitr tayyor! R2 ga yuklanmoqda... 🚀");

            // 5. Cloudflare R2 ga yuklash (Video)
            using (var uploadStream = new FileStream(tempPath, FileMode.Open, FileAccess.Read))
            {
                var putRequest = new Amazon.S3.Model.PutObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Key,
                    InputStream = uploadStream,
                    ContentType = "video/mp4",
                    DisablePayloadSigning = true
                };

                await _s3Client.PutObjectAsync(putRequest);
            }

            // 5.1 Cloudflare R2 ga yuklash (Subtitr)
            string srtFileUrl = "";
            var publicUrl = _config["CloudflareR2:PublicUrl"];
            
            if (System.IO.File.Exists(srtPath))
            {
                var srtKey = $"anime_videos/{baseName}.srt";
                using (var srtStream = new FileStream(srtPath, FileMode.Open, FileAccess.Read))
                {
                    var putRequestSrt = new Amazon.S3.Model.PutObjectRequest
                    {
                        BucketName = bucketName,
                        Key = srtKey,
                        InputStream = srtStream,
                        ContentType = "application/x-subrip",
                        DisablePayloadSigning = true
                    };
                    await _s3Client.PutObjectAsync(putRequestSrt);
                }
                srtFileUrl = $"{publicUrl}/{srtKey}";
                System.IO.File.Delete(srtPath);
            }

            // Serverdan vaqtinchalik faylni o'chirish
            if (System.IO.File.Exists(tempPath)) 
            {
                System.IO.File.Delete(tempPath);
            }

            // 6. Foydalanuvchiga ssilka berish
            var videoUrl = $"{publicUrl}/{s3Key}";
            
            string responseMsg = $"✅ Muvaffaqiyatli yuklandi!\n\n🎬 Video: {videoUrl}";
            if (!string.IsNullOrEmpty(srtFileUrl))
            {
                responseMsg += $"\n📝 Subtitr: {srtFileUrl}";
            }
            else
            {
                responseMsg += $"\n⚠️ Subtitr yaratilmadi (yoki Whisper xatosi)";
            }
            
            await _botClient.EditMessageTextAsync(chatId, statusMsg.MessageId, responseMsg);
        }
        catch (Exception ex)
        {
            await _botClient.EditMessageTextAsync(chatId, statusMsg.MessageId, $"❌ Xatolik yuz berdi: {ex.Message}");
        }
    }
}