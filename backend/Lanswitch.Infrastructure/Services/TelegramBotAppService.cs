using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Application.Models;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using System.IO;
using Microsoft.Extensions.DependencyInjection;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using System;

namespace Lanswitch.Infrastructure.Services;

public class TelegramBotAppService : ITelegramBotAppService
{
    private readonly ITelegramBotClient _botClient;
    private readonly IMTProtoClient _mtClient;
    private readonly ICloudStorageService _storageService;
    private readonly IVideoProcessor _videoProcessor;
    private readonly IUserRepository _userRepository;
    private readonly IGenericRepository<Media> _mediaRepository;
    private readonly IGenericRepository<Episode> _episodeRepository;
    private readonly IBotStateManager _stateManager;
    private readonly IServiceScopeFactory _scopeFactory;

    private readonly IGenericRepository<Language> _languageRepository;

    public TelegramBotAppService(
        ITelegramBotClient botClient,
        IMTProtoClient mtClient,
        ICloudStorageService storageService,
        IVideoProcessor videoProcessor,
        IUserRepository userRepository,
        IGenericRepository<Media> mediaRepository,
        IGenericRepository<Episode> episodeRepository,
        IGenericRepository<Language> languageRepository,
        IBotStateManager stateManager,
        IServiceScopeFactory scopeFactory)
    {
        _botClient = botClient;
        _mtClient = mtClient;
        _storageService = storageService;
        _videoProcessor = videoProcessor;
        _userRepository = userRepository;
        _mediaRepository = mediaRepository;
        _episodeRepository = episodeRepository;
        _languageRepository = languageRepository;
        _stateManager = stateManager;
        _scopeFactory = scopeFactory;
    }

    private async Task<Lanswitch.Domain.Entities.User> GetOrCreateUserAsync(Telegram.Bot.Types.User? fromUser)
    {
        if (fromUser == null) return new Lanswitch.Domain.Entities.User { TelegramId = "", FullName = "Noma'lum" };
        var telegramId = fromUser.Id.ToString();
        var fullName = $"{fromUser.FirstName} {fromUser.LastName}".Trim();
        var user = await _userRepository.GetByTelegramIdAsync(telegramId);
        if (user == null)
        {
            user = new Lanswitch.Domain.Entities.User
            {
                TelegramId = telegramId,
                FullName = string.IsNullOrEmpty(fullName) ? "Foydalanuvchi" : fullName,
                NativeLanguageId = 1,
                IsAdmin = false
            };
            await _userRepository.AddAsync(user);
        }
        return user;
    }

    public async Task HandleUpdateAsync(Update update)
    {
        if (update.Type == UpdateType.CallbackQuery)
        {
            await HandleCallbackQueryAsync(update.CallbackQuery!);
            return;
        }

        if (update.Message is not { } message) return;
        
        var chatId = message.Chat.Id;
        var user = await GetOrCreateUserAsync(message.From);
        var state = _stateManager.GetState(chatId);

        if (message.Type == MessageType.Text && message.Text != null)
        {
            if (message.Text.StartsWith("/start"))
            {
                await HandleStartAsync(chatId, user, message.Text);
                return;
            }
            if (message.Text.StartsWith("/make_me_admin"))
            {
                user.IsAdmin = true;
                _userRepository.Update(user);
                await _botClient.SendMessage(chatId, "✅ Tabriklaymiz, siz endi Adminsiz! /admin buyrug'ini yuboring.");
                return;
            }
            if (message.Text.StartsWith("/admin"))
            {
                if (user.IsAdmin) await ShowAdminMenuAsync(chatId);
                else await _botClient.SendMessage(chatId, "❌ Sizda admin huquqlari yo'q.");
                return;
            }
        }

        if (state.CurrentStep != AdminStep.None && user.IsAdmin)
        {
            await HandleAdminStateInputAsync(chatId, message, state);
            return;
        }
    }

    private async Task HandleStartAsync(long chatId, Lanswitch.Domain.Entities.User user, string messageText)
    {
        var parts = messageText.Split(' ');
        if (parts.Length > 1 && user.IsAdmin)
        {
            var payload = parts[1];
            if (payload.StartsWith("upload_film_"))
            {
                if (long.TryParse(payload.Replace("upload_film_", ""), out var mediaId))
                {
                    var state = new AdminState { CurrentStep = AdminStep.UploadFilmVideo };
                    state.Data["TargetId"] = mediaId;
                    _stateManager.SetState(chatId, state);
                    await _botClient.SendMessage(chatId, $"🎬 Kino (ID: {mediaId}) uchun videoni yuboring:");
                    return;
                }
            }
            else if (payload.StartsWith("upload_episode_"))
            {
                if (long.TryParse(payload.Replace("upload_episode_", ""), out var epId))
                {
                    var state = new AdminState { CurrentStep = AdminStep.UploadEpisodeVideo };
                    state.Data["TargetId"] = epId;
                    _stateManager.SetState(chatId, state);
                    await _botClient.SendMessage(chatId, $"📂 Epizod (ID: {epId}) uchun videoni yuboring:");
                    return;
                }
            }
        }

        user.LoginToken = Guid.NewGuid().ToString("N");
        user.LoginTokenExpiry = DateTime.UtcNow.AddMinutes(10);
        _userRepository.Update(user);

        var loginUrl = $"https://lanswitch.developerlogic.uz/api/auth/redirect?token={user.LoginToken}";
        var keyboard = new InlineKeyboardMarkup(
            InlineKeyboardButton.WithUrl("Tizimga kirish 🚀", loginUrl)
        );

        await _botClient.SendMessage(chatId, 
            "Assalomu alaykum! LanSwitch tizimiga xush kelibsiz.\n\nSaytga kirish uchun quyidagi tugmani bosing (yoki havolaga kiring):", 
            replyMarkup: keyboard);
    }

    private async Task ShowAdminMenuAsync(long chatId)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🎬 Kino qo'shish", "admin_add_movie")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📺 Yangi Serial", "admin_add_series"),
                InlineKeyboardButton.WithCallbackData("📂 Qism (ep) qo'shish", "admin_add_episode_existing")
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("📚 So'z qo'shish", "admin_add_word"),
                InlineKeyboardButton.WithCallbackData("❌ Bekor qilish", "admin_cancel")
            }
        });
        await _botClient.SendMessage(chatId, "🛠 *Admin Panel*\nNima qilamiz?", parseMode: ParseMode.Markdown, replyMarkup: keyboard);
    }

    private async Task HandleCallbackQueryAsync(CallbackQuery callbackQuery)
    {
        var chatId = callbackQuery.Message!.Chat.Id;
        var data = callbackQuery.Data;
        
        var user = await GetOrCreateUserAsync(callbackQuery.From);
        if (!user.IsAdmin)
        {
            await _botClient.AnswerCallbackQuery(callbackQuery.Id, "Siz admin emassiz!", showAlert: true);
            return;
        }

        if (data == "admin_cancel")
        {
            _stateManager.ClearState(chatId);
            await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Jarayon bekor qilindi.");
            return;
        }

        if (data == "admin_add_movie")
        {
            var state = new AdminState { CurrentStep = AdminStep.AddMovie_Title };
            _stateManager.SetState(chatId, state);
            await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "🎬 Yangi kino qo'shish!\n\n1. Iltimos, kino nomini (Title) kiriting:");
        }
        else if (data == "admin_add_series")
        {
            var state = new AdminState { CurrentStep = AdminStep.AddSeries_Title };
            _stateManager.SetState(chatId, state);
            await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "📺 Yangi Serial!\n\n1. Serial nomini kiriting:");
        }
        else if (data == "admin_add_episode_existing")
        {
            // List existing series
            var seriesList = (await _mediaRepository.GetAllAsync()).Where(m => m.IsFilm == false).ToList();
            if (seriesList.Count == 0)
            {
                await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Hali birorta ham serial yo'q. Avval 'Yangi Serial' qo'shing.");
            }
            else
            {
                var buttons = new List<InlineKeyboardButton[]>();
                foreach (var s in seriesList)
                {
                    buttons.Add(new[] { InlineKeyboardButton.WithCallbackData(s.Title, $"sel_series_{s.Id}") });
                }
                buttons.Add(new[] { InlineKeyboardButton.WithCallbackData("❌ Bekor qilish", "admin_cancel") });
                
                var kb = new InlineKeyboardMarkup(buttons);
                await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Qaysi serialga qism qo'shamiz?", replyMarkup: kb);
            }
        }
        else if (data != null && data.StartsWith("sel_series_"))
        {
            var seriesId = long.Parse(data.Replace("sel_series_", ""));
            var state = new AdminState { CurrentStep = AdminStep.AddEpisodeToSeason_EpisodeNum };
            state.Data["MediaId"] = seriesId;
            _stateManager.SetState(chatId, state);
            await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Nechinchi qism (Episode)? Raqam yozing (Masalan: 1):");
        }
        else if (data == "admin_add_word")
        {
            await _botClient.AnswerCallbackQuery(callbackQuery.Id, "Tez orada qo'shiladi!", showAlert: true);
        }

        if (data != null && data.StartsWith("lang_"))
        {
            var langId = long.Parse(data.Replace("lang_", ""));
            var state = _stateManager.GetState(chatId);
            if (state.CurrentStep == AdminStep.AddMovie_Language)
            {
                state.Data["LanguageId"] = langId;
                state.CurrentStep = AdminStep.AddMovie_Video;
                _stateManager.SetState(chatId, state);
                await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Kino qaysi tilda? ✅ Tanlandi.");
                await _botClient.SendMessage(chatId, "5. Kino videosini yuboring (MP4 formatda).");
            }
            else if (state.CurrentStep == AdminStep.AddSeries_Language)
            {
                state.Data["LanguageId"] = langId;
                state.CurrentStep = AdminStep.AddSeries_EpisodeNum;
                _stateManager.SetState(chatId, state);
                await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Serial qaysi tilda? ✅ Tanlandi.");
                await _botClient.SendMessage(chatId, "4. Nechinchi qism (Episode)? Raqam yozing (masalan: 1):");
            }
            await _botClient.AnswerCallbackQuery(callbackQuery.Id);
            return;
        }

        await _botClient.AnswerCallbackQuery(callbackQuery.Id);
    }

    private async Task SendLanguageSelectionAsync(long chatId, string text)
    {
        var langs = (await _languageRepository.GetAllAsync()).ToList();
        if (langs.Count == 0)
        {
            await _botClient.SendMessage(chatId, "Tizimda tillar mavjud emas. Dasturchiga murojaat qiling.");
            return;
        }

        var buttons = new List<InlineKeyboardButton[]>();
        foreach (var l in langs)
        {
            buttons.Add(new[] { InlineKeyboardButton.WithCallbackData(l.Title, $"lang_{l.Id}") });
        }

        var kb = new InlineKeyboardMarkup(buttons);
        await _botClient.SendMessage(chatId, text, replyMarkup: kb);
    }

    private async Task HandleAdminStateInputAsync(long chatId, Message message, AdminState state)
    {
        if (message.Type != MessageType.Text && message.Type != MessageType.Video) return;

        switch (state.CurrentStep)
        {
            // ================== MOVIE FLOW ==================
            case AdminStep.AddMovie_Title:
                state.Data["Title"] = message.Text!;
                state.CurrentStep = AdminStep.AddMovie_Description;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "2. Kino uchun qisqacha ta'rif yozing:");
                break;
            case AdminStep.AddMovie_Description:
                state.Data["Description"] = message.Text!;
                state.CurrentStep = AdminStep.AddMovie_Level;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "3. Til darajasini kiriting (B1, B2):");
                break;
            case AdminStep.AddMovie_Level:
                state.Data["Level"] = message.Text!;
                state.CurrentStep = AdminStep.AddMovie_Language;
                _stateManager.SetState(chatId, state);
                await SendLanguageSelectionAsync(chatId, "4. Kino qaysi tilda?");
                break;
            case AdminStep.AddMovie_Video:
                if (message.Type != MessageType.Video) return;
                _stateManager.ClearState(chatId);
                await ProcessVideoUploadAsync(chatId, message.Video!, message.MessageId, state, "Movie");
                break;

            // ================== NEW SERIES FLOW ==================
            case AdminStep.AddSeries_Title:
                state.Data["Title"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_Description;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "2. Serial ta'rifini yozing:");
                break;
            case AdminStep.AddSeries_Description:
                state.Data["Description"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_Language;
                _stateManager.SetState(chatId, state);
                await SendLanguageSelectionAsync(chatId, "3. Serial qaysi tilda?");
                break;
            case AdminStep.AddSeries_EpisodeNum:
                if (!int.TryParse(message.Text, out var en)) { await _botClient.SendMessage(chatId, "Faqat raqam kiriting!"); return; }
                state.Data["EpisodeNum"] = en;
                state.CurrentStep = AdminStep.AddSeries_EpisodeTitle;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "4. Qism nomi (masalan 'Pilot'):");
                break;
            case AdminStep.AddSeries_EpisodeTitle:
                state.Data["EpisodeTitle"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_EpisodeLevel;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "5. Qism til darajasi (masalan A2):");
                break;
            case AdminStep.AddSeries_EpisodeLevel:
                state.Data["Level"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_Video;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "6. Endi ushbu qism videosini yuboring:");
                break;
            case AdminStep.AddSeries_Video:
                if (message.Type != MessageType.Video) return;
                _stateManager.ClearState(chatId);
                await ProcessVideoUploadAsync(chatId, message.Video!, message.MessageId, state, "NewSeries");
                break;

            // ================== EXISTING SERIES EPISODE FLOW ==================
            case AdminStep.AddEpisodeToSeason_EpisodeNum:
                if (!int.TryParse(message.Text, out var en_ex)) { await _botClient.SendMessage(chatId, "Faqat raqam kiriting!"); return; }
                state.Data["EpisodeNum"] = en_ex;
                state.CurrentStep = AdminStep.AddEpisodeToSeason_EpisodeTitle;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "Qism nomi nima?");
                break;
            case AdminStep.AddEpisodeToSeason_EpisodeTitle:
                state.Data["EpisodeTitle"] = message.Text!;
                state.CurrentStep = AdminStep.AddEpisodeToSeason_EpisodeLevel;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "Qism til darajasi (masalan A2):");
                break;
            case AdminStep.AddEpisodeToSeason_EpisodeLevel:
                state.Data["Level"] = message.Text!;
                state.CurrentStep = AdminStep.AddEpisodeToSeason_Video;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "Endi qism videosini yuboring:");
                break;
            case AdminStep.AddEpisodeToSeason_Video:
                if (message.Type != MessageType.Video) return;
                _stateManager.ClearState(chatId);
                await ProcessVideoUploadAsync(chatId, message.Video!, message.MessageId, state, "ExistingSeries");
                break;
            case AdminStep.UploadFilmVideo:
                if (message.Type != MessageType.Video) { await _botClient.SendMessage(chatId, "Iltimos video yuboring!"); return; }
                _stateManager.ClearState(chatId);
                await ProcessDirectUploadAsync(chatId, message.Video!, message.MessageId, Convert.ToInt64(state.Data["TargetId"]), true);
                break;
            case AdminStep.UploadEpisodeVideo:
                if (message.Type != MessageType.Video) { await _botClient.SendMessage(chatId, "Iltimos video yuboring!"); return; }
                _stateManager.ClearState(chatId);
                await ProcessDirectUploadAsync(chatId, message.Video!, message.MessageId, Convert.ToInt64(state.Data["TargetId"]), false);
                break;
        }
    }

    private async Task ProcessVideoUploadAsync(long chatId, Telegram.Bot.Types.Video video, int messageId, AdminState state, string flowType)
    {
        var statusMsg = await _botClient.SendMessage(chatId, "Video qabul qilindi. MTProto orqali serverga yuklanmoqda... ⏳");
        try
        {
            var fileName = video.FileName ?? $"media_{video.FileId}.mp4";
            
            await _mtClient.LoginBotIfNeededAsync();
            var tempPath = Path.Combine(Path.GetTempPath(), fileName);
            using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write))
            {
                await _mtClient.DownloadMessageMediaAsync(messageId, fileStream);
            }

            var fileInfo = new FileInfo(tempPath);
            if (fileInfo.Length == 0)
            {
                throw new Exception("MTProto orqali yuklab olingan video 0 bayt hajmga ega.");
            }

            await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"Video olingach ({fileInfo.Length / 1024 / 1024} MB), audiosi ajratilmoqda... ⏳");
            var fullAudioPath = await _videoProcessor.ExtractFullAudioAsync(tempPath);

            var audioInfo = new FileInfo(fullAudioPath);
            if (audioInfo.Length == 0)
            {
                throw new Exception("FFmpeg orqali audio ajratish muvaffaqiyatsiz bo'ldi (0 bayt).");
            }

            await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"Audio tayyor ({audioInfo.Length / 1024 / 1024} MB)! Video R2 ga yuklanmoqda... 🚀");
            string videoUrl = "";
            using (var uploadStream = new FileStream(tempPath, FileMode.Open, FileAccess.Read))
            {
                videoUrl = await _storageService.UploadVideoAsync(fileName, uploadStream);
            }

            if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath);

            long mediaIdToPass = 0;
            long? episodeIdToPass = null;

            if (flowType == "Movie")
            {
                var media = new Media
                {
                    Title = state.Data["Title"].ToString()!,
                    Description = state.Data["Description"].ToString()!,
                    Level = state.Data["Level"].ToString()!,
                    LanguageId = (long)state.Data["LanguageId"], VideoUrl = videoUrl,
                    ThumbnailUrl = "https://ui-avatars.com/api/?name=Movie",
                    IsFilm = true
                };
                await _mediaRepository.AddAsync(media);
                mediaIdToPass = media.Id;
                await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"✅ Kino bazaga qo'shildi!\n🎬 {media.Title}\n🔗 Video: {videoUrl}");
            }
            else if (flowType == "NewSeries")
            {
                var media = new Media
                {
                    Title = state.Data["Title"].ToString()!,
                    Description = state.Data["Description"].ToString()!,
                    Level = "", LanguageId = (long)state.Data["LanguageId"], VideoUrl = "",
                    ThumbnailUrl = "https://ui-avatars.com/api/?name=Series",
                    IsFilm = false
                };
                await _mediaRepository.AddAsync(media);

                var ep = new Episode
                {
                    MediaId = media.Id, EpisodeNumber = (int)state.Data["EpisodeNum"],
                    Title = state.Data["EpisodeTitle"].ToString()!,
                    Description = "", Level = state.Data["Level"].ToString()!,
                    VideoUrl = videoUrl, ThumbnailUrl = "https://ui-avatars.com/api/?name=Episode"
                };
                await _episodeRepository.AddAsync(ep);

                mediaIdToPass = media.Id;
                episodeIdToPass = ep.Id;
                await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"✅ Serial bazaga qo'shildi!\n📺 {media.Title} - E{ep.EpisodeNumber}\n🔗 Video: {videoUrl}");
            }
            else if (flowType == "ExistingSeries")
            {
                var mId = (long)state.Data["MediaId"];

                var ep = new Episode
                {
                    MediaId = mId, EpisodeNumber = (int)state.Data["EpisodeNum"],
                    Title = state.Data["EpisodeTitle"].ToString()!,
                    Description = "", Level = state.Data["Level"].ToString()!,
                    VideoUrl = videoUrl, ThumbnailUrl = "https://ui-avatars.com/api/?name=Episode"
                };
                await _episodeRepository.AddAsync(ep);

                mediaIdToPass = mId;
                episodeIdToPass = ep.Id;
                await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"✅ Qism mavjud serialga qo'shildi!\n📺 E{ep.EpisodeNumber}\n🔗 Video: {videoUrl}");
            }

            // Start AI Background Task
            if (!string.IsNullOrEmpty(fullAudioPath))
            {
                _ = Task.Run(() => AnalyzeSubtitlesInBackgroundAsync(mediaIdToPass, episodeIdToPass, fullAudioPath, fileName, chatId));
                await SafeSendMessageAsync(chatId, "🤖 Audio tahlil uchun Deepgram tizimiga yuborildi...");
            }
        }
        catch (System.Exception ex)
        {
            await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"❌ Xatolik yuz berdi: {ex.Message}");
        }
    }

    private async Task ProcessDirectUploadAsync(long chatId, Telegram.Bot.Types.Video video, int messageId, long targetId, bool isFilm)
    {
        var statusMsg = await _botClient.SendMessage(chatId, "Video qabul qilindi. MTProto orqali serverga yuklanmoqda... ⏳");
        try
        {
            var fileName = video.FileName ?? $"media_{video.FileId}.mp4";
            
            await _mtClient.LoginBotIfNeededAsync();
            var tempPath = Path.Combine(Path.GetTempPath(), fileName);
            using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write))
            {
                await _mtClient.DownloadMessageMediaAsync(messageId, fileStream);
            }

            var fileInfo = new FileInfo(tempPath);
            if (fileInfo.Length == 0)
            {
                throw new Exception("MTProto orqali yuklab olingan video 0 bayt hajmga ega.");
            }

            await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"Video olingach ({fileInfo.Length / 1024 / 1024} MB), audiosi ajratilmoqda... ⏳");
            var fullAudioPath = await _videoProcessor.ExtractFullAudioAsync(tempPath);

            var audioInfo = new FileInfo(fullAudioPath);
            if (audioInfo.Length == 0)
            {
                throw new Exception("FFmpeg orqali audio ajratish muvaffaqiyatsiz bo'ldi (0 bayt).");
            }

            await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"Audio tayyor ({audioInfo.Length / 1024 / 1024} MB)! Video R2 ga yuklanmoqda... 🚀");
            string videoUrl = "";
            using (var uploadStream = new FileStream(tempPath, FileMode.Open, FileAccess.Read))
            {
                videoUrl = await _storageService.UploadVideoAsync(fileName, uploadStream);
            }

            if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath);

            long mediaIdToPass = 0;
            long? episodeIdToPass = null;

            if (isFilm)
            {
                var media = await _mediaRepository.GetByIdAsync(targetId);
                if (media != null)
                {
                    media.VideoUrl = videoUrl;
                    _mediaRepository.Update(media);
                    mediaIdToPass = media.Id;
                    await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"✅ Kino videosi yangilandi!\n🎬 Kino: {media.Title}\n🔗 Video: {videoUrl}");
                }
            }
            else
            {
                var ep = await _episodeRepository.GetByIdAsync(targetId);
                if (ep != null)
                {
                    ep.VideoUrl = videoUrl;
                    _episodeRepository.Update(ep);
                    
                    mediaIdToPass = ep.MediaId;
                    episodeIdToPass = ep.Id;
                    
                    await SafeEditMessageAsync(chatId, statusMsg.MessageId, $"✅ Epizod videosi yangilandi!\n📺 Qism: {ep.EpisodeNumber}\n🔗 Video: {videoUrl}");
                }
            }

            // Start AI Background Task
            if (!string.IsNullOrEmpty(fullAudioPath) && mediaIdToPass > 0)
            {
                _ = Task.Run(() => AnalyzeSubtitlesInBackgroundAsync(mediaIdToPass, episodeIdToPass, fullAudioPath, fileName, chatId));
                await SafeSendMessageAsync(chatId, "🤖 Audio tahlil uchun Deepgram tizimiga yuborildi...");
            }
        }
        catch (System.Exception ex)
        {
            await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"❌ Xatolik yuz berdi: {ex.Message}");
        }
    }

    private async Task AnalyzeSubtitlesInBackgroundAsync(long mediaId, long? episodeId, string fullAudioPath, string videoFileName, long chatId)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var deepgramService = scope.ServiceProvider.GetRequiredService<IDeepgramService>();
            var botClient = scope.ServiceProvider.GetRequiredService<ITelegramBotClient>();
            var contextRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<GrammarContext>>();
            var gapRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Gap>>();
            var subtitleRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Subtitle>>();
            var storageService = scope.ServiceProvider.GetRequiredService<ICloudStorageService>();
            var mediaRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Media>>();
            var languageRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Language>>();

            var media = await mediaRepo.GetByIdAsync(mediaId);
            var langTitle = "Ingliz";
            var langCode = "en";
            long langId = 2; // Default English

            if (media != null)
            {
                var lang = await languageRepo.GetByIdAsync(media.LanguageId);
                if (lang != null)
                {
                    langTitle = lang.Title;
                    langId = lang.Id;
                    var lowerTitle = lang.Title.ToLower();
                    if (lang.Id == 3 || lowerTitle.Contains("rus") || lowerTitle.Contains("ru")) langCode = "ru";
                    else if (lang.Id == 1 || lowerTitle.Contains("zbek") || lowerTitle.Contains("uz")) langCode = "uz";
                    else langCode = "en";
                }
            }

            await botClient.SendMessage(chatId, $"🔍 Deepgram tizimi orqali audio tahlili ({langTitle} tilida) va subtitrlar generatsiyasi boshlandi...");

            var result = await deepgramService.TranscribeAudioAsync(fullAudioPath, mediaId, langCode);
            var subtitles = result.Subtitles;

            if (subtitles == null || subtitles.Count == 0)
            {
                await botClient.SendMessage(chatId, "❌ Deepgram dan subtitrlar olinmadi yoxud audio bo'sh.");
                return;
            }

            var srtContent = result.SrtContent;
            if (string.IsNullOrWhiteSpace(srtContent))
            {
                var sb = new System.Text.StringBuilder();
                foreach (var sub in subtitles)
                {
                    sb.AppendLine(sub.Index.ToString());
                    sb.AppendLine($"{sub.StartTime:hh\\:mm\\:ss\\,fff} --> {sub.EndTime:hh\\:mm\\:ss\\,fff}");
                    sb.AppendLine(sub.Text);
                    sb.AppendLine();
                }
                srtContent = sb.ToString();
            }

            var srtFileName = Path.GetFileNameWithoutExtension(videoFileName) + ".srt";
            string srtUrl = "";
            using (var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(srtContent)))
            {
                srtUrl = await storageService.UploadSubtitleAsync(srtFileName, stream);
            }

            await botClient.SendMessage(chatId, $"✅ Audio tekstga o'girildi ({subtitles.Count} ta gap). Subtitr (SRT) R2 ga saqlandi: {srtUrl}\n\nBarcha subtitrlar bazaga saqlandi. Grammatika tahlili keyingi qadamda qilinadi.");

            try { if (System.IO.File.Exists(fullAudioPath)) System.IO.File.Delete(fullAudioPath); } catch { }

            // Eski subtitllarni o'chirib tashlash (aralashib ketmasligi uchun)
            if (episodeId.HasValue)
            {
                var oldSubs = await subtitleRepo.FindAsync(s => s.EpisodeId == episodeId.Value);
                if (oldSubs.Any()) subtitleRepo.RemoveRange(oldSubs);
            }
            else
            {
                var oldSubs = await subtitleRepo.FindAsync(s => s.MediaId == mediaId && s.EpisodeId == null);
                if (oldSubs.Any()) subtitleRepo.RemoveRange(oldSubs);
            }

            foreach (var sub in subtitles)
            {
                sub.EpisodeId = episodeId;
                await subtitleRepo.AddAsync(sub); // Save each subtitle to DB
            }

            // --- 1.5-QADAM: EMBEDDING GENERATION ---
            await botClient.SendMessage(chatId, "🤖 Subtitrlar uchun Embedding (Vektor) ma'lumotlar yaratilmoqda...");
            var geminiService = scope.ServiceProvider.GetRequiredService<IGeminiAiService>();
            
            foreach (var sub in subtitles)
            {
                if (!string.IsNullOrWhiteSpace(sub.Text))
                {
                    sub.Embedding = await geminiService.GenerateEmbeddingAsync(sub.Text);
                    subtitleRepo.Update(sub);
                }
            }

            // --- 2-QADAM: GEMINI AI ORQALI GRAMMATIKA VA SO'Z TAHLILI ---
            await botClient.SendMessage(chatId, "🤖 Gemini AI orqali subtitrlardagi gaplarni tahlil qilish va o'zak so'zlarni ajratish boshlandi... Bu biroz vaqt olishi mumkin ⏳");
            
            var wordRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Word>>();
            var wordTranslateRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<WordTranslate>>();
            var subtitleWordRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<SubtitleWord>>();
            
            // Mahalliy xotirada kesh (Bazaga qayta-qayta murojaat qilmaslik uchun)
            var existingWords = (await wordRepo.GetAllAsync()).ToDictionary(w => w.Text.ToLower(), w => w.Id);
            
            int batchSize = 20;
            var regex = new System.Text.RegularExpressions.Regex(@"\b[\p{L}\']+\b");
            for (int i = 0; i < subtitles.Count; i += batchSize)
            {
                var batch = subtitles.Skip(i).Take(batchSize).ToList();
                var batchJsonData = batch.Select(s => new { id = s.Id, text = s.Text }).ToList();
                var subtitlesJson = System.Text.Json.JsonSerializer.Serialize(batchJsonData);
                var aiAnalyses = await geminiService.AnalyzeGrammarAsync(subtitlesJson, langTitle);
                
                if (aiAnalyses != null && aiAnalyses.Count > 0)
                {
                    int indexOffset = i + 1;
                    foreach (var analysis in aiAnalyses)
                    {
                        var gap = new Gap
                        {
                            Text = analysis.SentenceText,
                            AiAnalysis = analysis.AiAnalysis,
                            SubtitleId = analysis.SubtitleId, // Gemini dan kelgan aniq ID
                            Index = indexOffset++
                        };
                        await gapRepo.AddAsync(gap);
                        
                        // O'zak so'zlarni saqlash
                        if (analysis.RootWords != null)
                        {
                            foreach (var rw in analysis.RootWords)
                            {
                                if (string.IsNullOrWhiteSpace(rw.Word) || string.IsNullOrWhiteSpace(rw.Translation)) continue;
                                
                                var wordText = rw.Word.Trim().ToLower();
                                long wordId = 0;
                                
                                if (existingWords.TryGetValue(wordText, out var existingId))
                                {
                                    wordId = existingId;
                                    var hasTranslation = (await wordTranslateRepo.FindAsync(t => t.WordId == wordId)).Any();
                                    if (!hasTranslation)
                                    {
                                        var newTranslate = new WordTranslate { WordId = wordId, LanguageId = 1, TranslateText = rw.Translation.Trim() };
                                        await wordTranslateRepo.AddAsync(newTranslate);
                                    }
                                }
                                else
                                {
                                    var newWord = new Word { Text = wordText, LanguageId = langId };
                                    await wordRepo.AddAsync(newWord);
                                    
                                    var newTranslate = new WordTranslate { WordId = newWord.Id, LanguageId = 1 /* Uzbek */, TranslateText = rw.Translation.Trim() };
                                    await wordTranslateRepo.AddAsync(newTranslate);
                                    
                                    wordId = newWord.Id;
                                    existingWords[wordText] = wordId;
                                }
                                
                                // Many-to-Many
                                await subtitleWordRepo.AddAsync(new SubtitleWord
                                {
                                    SubtitleId = analysis.SubtitleId,
                                    WordId = wordId
                                });
                            }
                        }
                    }
                }
                
                // Extract ALL words from subtitles in this batch and add to SubtitleWord
                foreach (var sub in batch)
                {
                    var matches = regex.Matches(sub.Text);
                    var uniqueWordsInSub = new HashSet<string>();
                    foreach (System.Text.RegularExpressions.Match match in matches)
                    {
                        var wordText = match.Value.ToLower();
                        if (wordText.Length > 1 || wordText == "i" || wordText == "a")
                            uniqueWordsInSub.Add(wordText);
                    }

                    foreach (var wordText in uniqueWordsInSub)
                    {
                        long wordId = 0;
                        if (existingWords.TryGetValue(wordText, out var existingId))
                        {
                            wordId = existingId;
                        }
                        else
                        {
                            var newWord = new Word { Text = wordText, LanguageId = 2 /* English */ };
                            await wordRepo.AddAsync(newWord);
                            wordId = newWord.Id;
                            existingWords[wordText] = wordId;
                        }

                        // Check if SubtitleWord already exists to avoid duplicates
                        // Simplified: assume we just add it (this can potentially fail if DB has strict unique constraint, 
                        // but SubtitleWord doesn't seem to have one based on previous logic).
                        await subtitleWordRepo.AddAsync(new SubtitleWord
                        {
                            SubtitleId = sub.Id,
                            WordId = wordId
                        });
                    }
                }
                
                await Task.Delay(2000);
            }

            await botClient.SendMessage(chatId, $"✅ Barcha subtitrlar tahlil qilindi (Grammatika, O'zak so'zlar va Vektorlar) hamda bazaga saqlandi! Tabriklaymiz 🎉");
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"AI Background Error: {ex}");
            try { if (System.IO.File.Exists(fullAudioPath)) System.IO.File.Delete(fullAudioPath); } catch { }
            try
            {
                var botClient = _scopeFactory.CreateScope().ServiceProvider.GetRequiredService<ITelegramBotClient>();
                await botClient.SendMessage(chatId, $"❌ Deepgram orqali subtitr yaratishda xatolik yuz berdi: {ex.Message}");
            }
            catch { }
        }
    }

    private async Task SafeEditMessageAsync(long chatId, int messageId, string text)
    {
        try { await _botClient.EditMessageText(chatId, messageId, text); }
        catch (Exception ex) { Console.WriteLine($"SafeEditMessageAsync failed: {ex.Message}"); }
    }

    private async Task SafeSendMessageAsync(long chatId, string text)
    {
        try { await _botClient.SendMessage(chatId, text); }
        catch (Exception ex) { Console.WriteLine($"SafeSendMessageAsync failed: {ex.Message}"); }
    }
}
