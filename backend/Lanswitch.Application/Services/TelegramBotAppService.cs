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

namespace Lanswitch.Application.Services;

public class TelegramBotAppService : ITelegramBotAppService
{
    private readonly ITelegramBotClient _botClient;
    private readonly IMTProtoClient _mtClient;
    private readonly ICloudStorageService _storageService;
    private readonly IVideoProcessor _videoProcessor;
    private readonly IUserRepository _userRepository;
    private readonly IGenericRepository<Media> _mediaRepository;
    private readonly IGenericRepository<Season> _seasonRepository;
    private readonly IGenericRepository<Episode> _episodeRepository;
    private readonly IBotStateManager _stateManager;
    private readonly IServiceScopeFactory _scopeFactory;

    public TelegramBotAppService(
        ITelegramBotClient botClient,
        IMTProtoClient mtClient,
        ICloudStorageService storageService,
        IVideoProcessor videoProcessor,
        IUserRepository userRepository,
        IGenericRepository<Media> mediaRepository,
        IGenericRepository<Season> seasonRepository,
        IGenericRepository<Episode> episodeRepository,
        IBotStateManager stateManager,
        IServiceScopeFactory scopeFactory)
    {
        _botClient = botClient;
        _mtClient = mtClient;
        _storageService = storageService;
        _videoProcessor = videoProcessor;
        _userRepository = userRepository;
        _mediaRepository = mediaRepository;
        _seasonRepository = seasonRepository;
        _episodeRepository = episodeRepository;
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
                await HandleStartAsync(chatId, user);
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

    private async Task HandleStartAsync(long chatId, Lanswitch.Domain.Entities.User user)
    {
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
            var state = new AdminState { CurrentStep = AdminStep.AddEpisodeToSeason_SeasonNum };
            state.Data["MediaId"] = seriesId;
            _stateManager.SetState(chatId, state);
            await _botClient.EditMessageText(chatId, callbackQuery.Message.MessageId, "Nechinchi faslga (Season) qo'shamiz? Faqat raqam kiriting (Masalan: 1):");
        }
        else if (data == "admin_add_word")
        {
            await _botClient.AnswerCallbackQuery(callbackQuery.Id, "Tez orada qo'shiladi!", showAlert: true);
        }

        await _botClient.AnswerCallbackQuery(callbackQuery.Id);
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
                state.CurrentStep = AdminStep.AddMovie_Video;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "4. Kino videosini yuboring (MP4 formatda).");
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
                state.CurrentStep = AdminStep.AddSeries_SeasonNum;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "3. Nechinchi fasl (Season)? Raqam yozing (masalan: 1):");
                break;
            case AdminStep.AddSeries_SeasonNum:
                if (!int.TryParse(message.Text, out var sn)) { await _botClient.SendMessage(chatId, "Faqat raqam kiriting!"); return; }
                state.Data["SeasonNum"] = sn;
                state.CurrentStep = AdminStep.AddSeries_EpisodeNum;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "4. Nechinchi qism (Episode)? Raqam yozing:");
                break;
            case AdminStep.AddSeries_EpisodeNum:
                if (!int.TryParse(message.Text, out var en)) { await _botClient.SendMessage(chatId, "Faqat raqam kiriting!"); return; }
                state.Data["EpisodeNum"] = en;
                state.CurrentStep = AdminStep.AddSeries_EpisodeTitle;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "5. Qism nomi (masalan 'Pilot'):");
                break;
            case AdminStep.AddSeries_EpisodeTitle:
                state.Data["EpisodeTitle"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_EpisodeLevel;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "6. Qism til darajasi (masalan A2):");
                break;
            case AdminStep.AddSeries_EpisodeLevel:
                state.Data["Level"] = message.Text!;
                state.CurrentStep = AdminStep.AddSeries_Video;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "7. Endi ushbu qism videosini yuboring:");
                break;
            case AdminStep.AddSeries_Video:
                if (message.Type != MessageType.Video) return;
                _stateManager.ClearState(chatId);
                await ProcessVideoUploadAsync(chatId, message.Video!, message.MessageId, state, "NewSeries");
                break;

            // ================== EXISTING SERIES EPISODE FLOW ==================
            case AdminStep.AddEpisodeToSeason_SeasonNum:
                if (!int.TryParse(message.Text, out var sn_ex)) { await _botClient.SendMessage(chatId, "Faqat raqam kiriting!"); return; }
                state.Data["SeasonNum"] = sn_ex;
                state.CurrentStep = AdminStep.AddEpisodeToSeason_EpisodeNum;
                _stateManager.SetState(chatId, state);
                await _botClient.SendMessage(chatId, "Nechinchi qism (Episode)? Raqam yozing:");
                break;
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

            await _botClient.EditMessageText(chatId, statusMsg.MessageId, "Video olingach, Whisper orqali subtitr yaratilmoqda... ⏳");
            var srtPath = await _videoProcessor.GenerateSubtitleSrtAsync(tempPath);

            await _botClient.EditMessageText(chatId, statusMsg.MessageId, "Subtitr tayyor! R2 ga yuklanmoqda... 🚀");
            string videoUrl;
            using (var uploadStream = new FileStream(tempPath, FileMode.Open, FileAccess.Read))
            {
                videoUrl = await _storageService.UploadVideoAsync(fileName, uploadStream);
            }

            string srtFileUrl = "";
            string srtContentForAi = "";
            if (!string.IsNullOrEmpty(srtPath) && System.IO.File.Exists(srtPath))
            {
                srtContentForAi = await System.IO.File.ReadAllTextAsync(srtPath);
                using (var srtStream = new FileStream(srtPath, FileMode.Open, FileAccess.Read))
                {
                    srtFileUrl = await _storageService.UploadSubtitleAsync(Path.GetFileName(srtPath), srtStream);
                }
                System.IO.File.Delete(srtPath);
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
                    LanguageId = 2, CategoryId = 1, VideoUrl = videoUrl,
                    ThumbnailUrl = "https://ui-avatars.com/api/?name=Movie",
                    IsFilm = true
                };
                await _mediaRepository.AddAsync(media);
                mediaIdToPass = media.Id;
                await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"✅ Kino bazaga qo'shildi!\n🎬 {media.Title}\n🔗 Video: {videoUrl}");
            }
            else if (flowType == "NewSeries")
            {
                var media = new Media
                {
                    Title = state.Data["Title"].ToString()!,
                    Description = state.Data["Description"].ToString()!,
                    Level = "", LanguageId = 2, CategoryId = 1, VideoUrl = "",
                    ThumbnailUrl = "https://ui-avatars.com/api/?name=Series",
                    IsFilm = false
                };
                await _mediaRepository.AddAsync(media);
                
                var season = new Season { MediaId = media.Id, SeasonNumber = (int)state.Data["SeasonNum"], ThumbnailUrl = "" };
                await _seasonRepository.AddAsync(season);

                var ep = new Episode
                {
                    SeasonId = season.Id, EpisodeNumber = (int)state.Data["EpisodeNum"],
                    Title = state.Data["EpisodeTitle"].ToString()!,
                    Description = "", Level = state.Data["Level"].ToString()!,
                    VideoUrl = videoUrl, ThumbnailUrl = "https://ui-avatars.com/api/?name=Episode"
                };
                await _episodeRepository.AddAsync(ep);

                mediaIdToPass = media.Id;
                episodeIdToPass = ep.Id;
                await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"✅ Serial bazaga qo'shildi!\n📺 {media.Title} - S{season.SeasonNumber} E{ep.EpisodeNumber}\n🔗 Video: {videoUrl}");
            }
            else if (flowType == "ExistingSeries")
            {
                var mId = (long)state.Data["MediaId"];
                var sNum = (int)state.Data["SeasonNum"];
                
                var allSeasons = await _seasonRepository.GetAllAsync();
                var season = allSeasons.FirstOrDefault(s => s.MediaId == mId && s.SeasonNumber == sNum);
                if (season == null)
                {
                    season = new Season { MediaId = mId, SeasonNumber = sNum, ThumbnailUrl = "" };
                    await _seasonRepository.AddAsync(season);
                }

                var ep = new Episode
                {
                    SeasonId = season.Id, EpisodeNumber = (int)state.Data["EpisodeNum"],
                    Title = state.Data["EpisodeTitle"].ToString()!,
                    Description = "", Level = state.Data["Level"].ToString()!,
                    VideoUrl = videoUrl, ThumbnailUrl = "https://ui-avatars.com/api/?name=Episode"
                };
                await _episodeRepository.AddAsync(ep);

                mediaIdToPass = mId;
                episodeIdToPass = ep.Id;
                await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"✅ Qism mavjud serialga qo'shildi!\n📺 S{season.SeasonNumber} E{ep.EpisodeNumber}\n🔗 Video: {videoUrl}");
            }

            // Start AI Background Task
            if (!string.IsNullOrEmpty(srtContentForAi))
            {
                _ = Task.Run(() => AnalyzeSubtitlesInBackgroundAsync(mediaIdToPass, episodeIdToPass, srtContentForAi, chatId));
                await _botClient.SendMessage(chatId, "🤖 Subtitrlar orqa fonda Gemini AI orqali grammatik qoidalarga tekshirilmoqda.");
            }
        }
        catch (System.Exception ex)
        {
            await _botClient.EditMessageText(chatId, statusMsg.MessageId, $"❌ Xatolik yuz berdi: {ex.Message}");
        }
    }

    private async Task AnalyzeSubtitlesInBackgroundAsync(long mediaId, long? episodeId, string srtContent, long chatId)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var parser = scope.ServiceProvider.GetRequiredService<ISubtitleParserService>();
            var gemini = scope.ServiceProvider.GetRequiredService<IGeminiAiService>();
            var botClient = scope.ServiceProvider.GetRequiredService<ITelegramBotClient>();
            var contextRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<GrammarContext>>();
            var gapRepo = scope.ServiceProvider.GetRequiredService<IGenericRepository<Gap>>();

            var subtitles = parser.ParseSrt(srtContent, mediaId);
            
            await botClient.SendMessage(chatId, $"🔍 AI Tahlil boshlandi: {subtitles.Count} ta gap topildi.");

            var existingContexts = (await contextRepo.GetAllAsync()).ToList();

            int processed = 0;
            int newRulesFound = 0;

            foreach (var sub in subtitles)
            {
                sub.EpisodeId = episodeId; // Map to episode if it's a series

                await Task.Delay(2000); 

                var result = await gemini.AnalyzeGrammarAsync(sub.Text, existingContexts);
                if (result != null)
                {
                    long contextId = 0;
                    if (result.IsNewRule && !string.IsNullOrEmpty(result.NewRuleName))
                    {
                        var newContext = new GrammarContext
                        {
                            Name = result.NewRuleName,
                            Description = result.NewRuleDescription ?? "",
                            Content = result.NewRuleContent ?? "",
                            LanguageId = 2 
                        };
                        await contextRepo.AddAsync(newContext);
                        
                        existingContexts.Add(newContext); 
                        contextId = newContext.Id;
                        newRulesFound++;
                        
                        await botClient.SendMessage(chatId, $"✨ Yangi grammatika: *{newContext.Name}*\nGap: _{sub.Text}_", parseMode: ParseMode.Markdown);
                    }
                    else if (result.MatchedRuleId.HasValue && result.MatchedRuleId.Value > 0)
                    {
                        contextId = result.MatchedRuleId.Value;
                    }

                    if (contextId > 0)
                    {
                        var gap = new Gap
                        {
                            Text = result.GapWord ?? "___",
                            GrammarContextId = contextId,
                            Subtitle = sub,
                            Index = 0
                        };
                        await gapRepo.AddAsync(gap);
                    }
                }
                
                processed++;
                if (processed % 20 == 0)
                {
                    await botClient.SendMessage(chatId, $"⏳ Tahlil qilinmoqda: {processed}/{subtitles.Count}");
                }
            }
            
            await botClient.SendMessage(chatId, $"✅ AI tahlili yakunlandi!\nJami gaplar: {subtitles.Count}\nYangi aniqlangan qoidalar: {newRulesFound}");
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"AI Background Error: {ex}");
        }
    }
}
