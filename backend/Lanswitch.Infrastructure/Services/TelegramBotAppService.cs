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
using Microsoft.Extensions.Configuration;
using System.Linq;
using System;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

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
    private readonly IConfiguration _configuration;

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
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration)
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
        _configuration = configuration;
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
                IsAdmin = false,
                Balance = 0m,
                HasReceivedInitialBonus = false
            };
            await _userRepository.AddAsync(user);
        }
        return user;
    }

    public async Task HandleUpdateAsync(Update update)
    {
        if (update.Type == UpdateType.MyChatMember && update.MyChatMember != null)
        {
            await HandleMyChatMemberAsync(update.MyChatMember);
            return;
        }

        if (update.Type == UpdateType.CallbackQuery)
        {
            await HandleCallbackQueryAsync(update.CallbackQuery!);
            return;
        }

        if (update.Message is not { } message) return;
        
        var chatId = message.Chat.Id;
        var user = await GetOrCreateUserAsync(message.From);
        var state = _stateManager.GetState(chatId);

        // O'quvchi 3-tur multimedia topshiriq yuborganda
        if (state.CurrentStep == AdminStep.WaitingMediaSubmission && state.Data.TryGetValue("ItemId", out var rawItemId))
        {
            long submissionItemId = Convert.ToInt64(rawItemId);
            string fileId = "";
            string fileType = "";
            long fileSize = 0;

            if (message.Voice != null)
            {
                fileId = message.Voice.FileId;
                fileType = "voice";
                fileSize = message.Voice.FileSize ?? 0;
            }
            else if (message.Video != null)
            {
                fileId = message.Video.FileId;
                fileType = "video";
                fileSize = message.Video.FileSize ?? 0;
            }
            else if (message.Audio != null)
            {
                fileId = message.Audio.FileId;
                fileType = "audio";
                fileSize = message.Audio.FileSize ?? 0;
            }
            else if (message.Photo != null && message.Photo.Length > 0)
            {
                var largest = message.Photo.OrderByDescending(p => p.FileSize).First();
                fileId = largest.FileId;
                fileType = "photo";
                fileSize = largest.FileSize ?? 0;
            }

            if (!string.IsNullOrEmpty(fileId))
            {
                // Vaqtincha holatda saqlash
                state.Data["PendingFileId"] = fileId;
                state.Data["PendingFileType"] = fileType;
                state.Data["PendingFileSize"] = fileSize.ToString();
                _stateManager.SetState(chatId, state);

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var item = await db.AssignmentItems.FindAsync(submissionItemId);
                var itemTitle = item?.Title ?? "Topshiriq";

                string typeIcon = fileType switch
                {
                    "video" => "🎬 Video",
                    "voice" => "🎙️ Ovozli xabar",
                    "audio" => "🎵 Audio fayl",
                    _ => "🖼️ Fotosurat"
                };

                double sizeMb = fileSize / 1024.0 / 1024.0;
                string sizeStr = sizeMb >= 1.0 ? $"{sizeMb:0.1} MB" : $"{fileSize / 1024} KB";

                var confirmKeyboard = new InlineKeyboardMarkup(new[]
                {
                    new[]
                    {
                        InlineKeyboardButton.WithCallbackData("🚀 Yuklash va topshirish", $"confirm_sub_{submissionItemId}"),
                        InlineKeyboardButton.WithCallbackData("🗑️ O'chirish / Bekor qilish", $"cancel_sub_{submissionItemId}")
                    }
                });

                await _botClient.SendMessage(
                    chatId,
                    $"📥 <b>Fayl qabul qilindi!</b>\n\n" +
                    $"📌 <b>Topshiriq:</b> {itemTitle}\n" +
                    $"📁 <b>Turi:</b> {typeIcon}\n" +
                    $"📊 <b>Hajmi:</b> {sizeStr}\n\n" +
                    $"<i>Topshiriqni o'qituvchiga tekshirish uchun yuklaysizmi?</i>",
                    parseMode: ParseMode.Html,
                    replyMarkup: confirmKeyboard);
                return;
            }
        }

        // Foydalanuvchi to'lov cheki screenshotini botga yuborganda (Private chat)
        if (message.Photo != null && message.Photo.Length > 0 && message.Chat.Type == ChatType.Private)
        {
            var largest = message.Photo.OrderByDescending(p => p.FileSize).First();

            decimal amount = 0m;
            if (!string.IsNullOrWhiteSpace(message.Caption))
            {
                var digits = new string(message.Caption.Where(char.IsDigit).ToArray());
                if (decimal.TryParse(digits, out var parsed) && parsed >= 1000)
                {
                    amount = parsed;
                }
            }

            try
            {
                var file = await _botClient.GetFile(largest.FileId);
                var botToken = _configuration["BotConfiguration:BotToken"];
                var downloadUrl = $"https://api.telegram.org/file/bot{botToken}/{file.FilePath}";

                var receiptsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "receipts");
                if (!Directory.Exists(receiptsDir)) Directory.CreateDirectory(receiptsDir);

                var ext = Path.GetExtension(file.FilePath);
                if (string.IsNullOrEmpty(ext)) ext = ".jpg";
                var fileName = $"receipt_bot_{user.Id}_{DateTime.UtcNow.Ticks}{ext}";
                var localPath = Path.Combine(receiptsDir, fileName);

                using (var httpClient = new System.Net.Http.HttpClient())
                {
                    var bytes = await httpClient.GetByteArrayAsync(downloadUrl);
                    await File.WriteAllBytesAsync(localPath, bytes);
                }

                var receiptUrl = $"/uploads/receipts/{fileName}";

                using var scope = _scopeFactory.CreateScope();
                var subService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var activeSub = await db.UserSubscriptions
                    .Where(s => s.UserId == user.Id && (s.Status == "Active" || s.IsActive))
                    .OrderByDescending(s => s.Id)
                    .FirstOrDefaultAsync();

                var planId = activeSub?.PlanId ?? "student_monthly";

                var req = await subService.SubmitReceiptAsync(user.Id, planId, amount, receiptUrl);

                var amountText = amount > 0 
                    ? $"💰 <b>Ko'rsatilgan summa:</b> {amount:N0} so'm\n\n" 
                    : "💰 <b>Summa:</b> Chek asosida admin tomonidan belgilanadi\n\n";

                await _botClient.SendMessage(chatId,
                    $"✅ <b>To'lov chekingiz qabul qilindi!</b>\n\n" +
                    $"📸 Chek adminga tekshirish uchun yuborildi.\n" +
                    amountText +
                    $"⏳ <i>Admin chekni ko'rib tasdiqlashi bilan hisob balansingiz to'ldiriladi va WebApp'da real vaqtda sarflanib boradi!</i>",
                    parseMode: ParseMode.Html);
                return;
            }
            catch (Exception ex)
            {
                await _botClient.SendMessage(chatId, $"❌ To'lov chekini qabul qilishda xatolik yuz berdi: {ex.Message}");
                return;
            }
        }

        if (message.Type == MessageType.Text && message.Text != null)
        {
            if (message.Text.StartsWith("/start"))
            {
                if (message.Chat.Type == ChatType.Group || message.Chat.Type == ChatType.Supergroup)
                {
                    await HandleGroupStartAsync(chatId, message.Chat.Title ?? "Telegram Group", user, message.From);
                    return;
                }

                await HandleStartAsync(chatId, user, message.Text, message.From);
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

    private async Task HandleStartAsync(long chatId, Lanswitch.Domain.Entities.User user, string messageText, Telegram.Bot.Types.User? fromUser)
    {
        var parts = messageText.Split(' ');
        if (parts.Length > 1)
        {
            var payload = parts[1];

            // 3-tur: O'quvchi "Yuborish" tugmasini bosib kelganda
            if (payload.StartsWith("item_"))
            {
                if (long.TryParse(payload.Replace("item_", ""), out var itemId))
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var item = await db.AssignmentItems.Include(i => i.Assignment).FirstOrDefaultAsync(i => i.Id == itemId);
                    if (item != null)
                    {
                        var state = new AdminState { CurrentStep = AdminStep.WaitingMediaSubmission };
                        state.Data["ItemId"] = itemId;
                        _stateManager.SetState(chatId, state);

                        var text = $"📌 <b>Topshiriq:</b> {item.Title}\n" +
                                   $"📝 <b>Yo'riqnoma:</b> {item.Instructions ?? "Javobingizni audio, video yoki rasm sifatida yuboring"}\n\n" +
                                   $"👇 <i>Iltimos, ushbu topshiriq uchun javobingizni (voice, video yoki rasm) shu yerga yuboring:</i>";

                        await _botClient.SendMessage(chatId, text, parseMode: ParseMode.Html);
                        return;
                    }
                }
            }

            // Topshiriq media faylini botda ko'rish
            if (payload.StartsWith("view_att_"))
            {
                if (long.TryParse(payload.Replace("view_att_", ""), out var attId))
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var att = await db.ItemSubmissionAttachments
                        .Include(a => a.ItemSubmission).ThenInclude(s => s.AssignmentItem)
                        .Include(a => a.ItemSubmission).ThenInclude(s => s.Student)
                        .FirstOrDefaultAsync(a => a.Id == attId);

                    if (att != null)
                    {
                        var sub = att.ItemSubmission;
                        var item = sub.AssignmentItem;
                        var caption = $"📌 <b>Topshiriq:</b> {item.Title}\n👤 <b>Talaba:</b> {sub.Student.FullName}";

                        var keyboardList = new List<InlineKeyboardButton[]>();
                        if (user.IsAdmin)
                        {
                            keyboardList.Add(new[]
                            {
                                InlineKeyboardButton.WithCallbackData("✅ 1 Bajarildi", $"grade_sub_{sub.Id}_1"),
                                InlineKeyboardButton.WithCallbackData("❌ 0 Jarima", $"grade_sub_{sub.Id}_0"),
                                InlineKeyboardButton.WithCallbackData("⚠️ 2 Jarima", $"grade_sub_{sub.Id}_2")
                            });
                        }

                        string frontendHost = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
                        var attUrl = (user.Role == "Teacher" || user.IsAdmin)
                            ? $"https://{frontendHost}/teacher?role=teacher&user_id={user.Id}&telegram_id={user.TelegramId}"
                            : $"https://{frontendHost}/student?role=student&user_id={user.Id}&telegram_id={user.TelegramId}";
                        keyboardList.Add(new[]
                        {
                            InlineKeyboardButton.WithWebApp("📱 Mini App da ochish", new WebAppInfo { Url = attUrl })
                        });

                        var replyKb = new InlineKeyboardMarkup(keyboardList);

                        try
                        {
                            if (att.FileType == "video")
                            {
                                await _botClient.SendVideo(chatId, new InputFileId(att.TelegramFileId), caption: caption, parseMode: ParseMode.Html, replyMarkup: replyKb);
                                return;
                            }
                            else if (att.FileType == "voice")
                            {
                                await _botClient.SendVoice(chatId, new InputFileId(att.TelegramFileId), caption: caption, parseMode: ParseMode.Html, replyMarkup: replyKb);
                                return;
                            }
                            else if (att.FileType == "audio")
                            {
                                await _botClient.SendAudio(chatId, new InputFileId(att.TelegramFileId), caption: caption, parseMode: ParseMode.Html, replyMarkup: replyKb);
                                return;
                            }
                            else if (att.FileType == "photo")
                            {
                                await _botClient.SendPhoto(chatId, new InputFileId(att.TelegramFileId), caption: caption, parseMode: ParseMode.Html, replyMarkup: replyKb);
                                return;
                            }
                        }
                        catch (Exception ex)
                        {
                            await _botClient.SendMessage(chatId, $"❌ Faylni yuborishda xatolik: {ex.Message}");
                            return;
                        }
                    }
                }
            }

            // Guruh havolasi orqali /start bosilganda (masalan: https://t.me/bot?start=group_12)
            if (payload.StartsWith("group_"))
            {
                if (long.TryParse(payload.Replace("group_", ""), out var targetGroupId))
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var group = await db.TelegramGroups.FirstOrDefaultAsync(g => g.Id == targetGroupId && g.IsActive);
                    if (group != null)
                    {
                        var exists = await db.GroupMembers.AnyAsync(gm => gm.GroupId == targetGroupId && gm.StudentId == user.Id);
                        if (!exists)
                        {
                            db.GroupMembers.Add(new GroupMember
                            {
                                GroupId = targetGroupId,
                                StudentId = user.Id,
                                IsActive = true,
                                JoinedAt = DateTime.UtcNow
                            });
                            await db.SaveChangesAsync();
                        }
                    }
                }
            }

            if (user.IsAdmin)
            {
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
        }

        // Foydalanuvchi avatar rasmini dinamik aniqlash
        try
        {
            if (fromUser != null)
            {
                var photos = await _botClient.GetUserProfilePhotos(fromUser.Id, limit: 1);
                if (photos.TotalCount > 0 && photos.Photos.Length > 0 && photos.Photos[0].Length > 0)
                {
                    var file = await _botClient.GetFile(photos.Photos[0][0].FileId);
                    var botToken = _configuration["BotConfiguration:BotToken"];
                    user.AvatarUrl = $"https://api.telegram.org/file/bot{botToken}/{file.FilePath}";
                    _userRepository.Update(user);
                }
            }
        }
        catch { }

        // O'quvchini Telegram guruhlarga a'zoligini tekshirib sinxronlash
        using (var scope = _scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (fromUser != null)
            {
                var activeGroups = await db.TelegramGroups.Where(g => g.IsActive).ToListAsync();
                foreach (var g in activeGroups)
                {
                    try
                    {
                        var member = await _botClient.GetChatMember(g.TelegramChatId, fromUser.Id);
                        if (member.Status == ChatMemberStatus.Member || member.Status == ChatMemberStatus.Administrator || member.Status == ChatMemberStatus.Creator)
                        {
                            var exists = await db.GroupMembers.AnyAsync(gm => gm.GroupId == g.Id && gm.StudentId == user.Id);
                            if (!exists)
                            {
                                db.GroupMembers.Add(new GroupMember { GroupId = g.Id, StudentId = user.Id, IsActive = true, JoinedAt = DateTime.UtcNow });
                            }
                            // Agar a'zo oldin o'qituvchi tomonidan tizimdan o'chirilgan bo'lsa (IsActive == false), start bosganda avtomatik faollashtirilmaydi
                        }
                    }
                    catch { }
                }
                await db.SaveChangesAsync();
            }
        }

        await SendCustomizedStartMessageAsync(chatId, user);
    }

    private async Task SendCustomizedStartMessageAsync(long chatId, Lanswitch.Domain.Entities.User user, int? messageIdToEdit = null)
    {
        user.LoginToken = Guid.NewGuid().ToString("N");
        user.LoginTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        _userRepository.Update(user);

        var me = await _botClient.GetMe();
        var botUsername = me.Username ?? "lanswitchbot";

        string frontend_host = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        var studentTmaUrl = $"https://{frontend_host}/student?role=student&user_id={user.Id}&telegram_id={user.TelegramId}";
        var teacherTmaUrl = $"https://{frontend_host}/teacher?role=teacher&user_id={user.Id}&telegram_id={user.TelegramId}";
        var loginUrl = $"https://{frontend_host}/api/auth/redirect?token={user.LoginToken}";

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // 1. Foydalanuvchining faol obunasi bormi?
        var activeSub = await db.UserSubscriptions
            .Where(s => s.UserId == user.Id && (s.Status == "Active" || s.IsActive))
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool isSubActive = false;
        string remainingFormatted = "";
        var now = DateTime.UtcNow;

        if (activeSub != null && activeSub.EndDate > now && user.Balance > 0)
        {
            isSubActive = true;
            var diff = activeSub.EndDate - now;
            if (diff.TotalDays >= 1)
            {
                remainingFormatted = $"{(int)diff.TotalDays} kun {(int)diff.Hours} soat";
            }
            else
            {
                remainingFormatted = $"{(int)diff.TotalHours} soat {(int)diff.Minutes} daqiqa";
            }
        }

        // 2. Foydalanuvchining o'quvchi guruhlari
        var studentGroups = await db.GroupMembers
            .Include(gm => gm.Group)
            .Where(gm => gm.StudentId == user.Id && gm.IsActive && gm.Group.IsActive)
            .ToListAsync();

        // 3. Foydalanuvchining o'qituvchi guruhlari
        var teacherGroups = await db.TelegramGroups
            .Where(g => g.OwnerId == user.Id && g.IsActive)
            .ToListAsync();

        // =====================================================================
        // HOLAT 1: FOYDALANUVCHIDA FAOL OBUNA MAVJUD (Customized Subscription Message)
        // =====================================================================
        if (isSubActive && activeSub != null)
        {
            bool isTeacherPlan = activeSub.TargetRole == "Teacher" || activeSub.PlanId.Contains("teacher");

            if (!isTeacherPlan)
            {
                // STUDENT PREMIUM OBUNASI
                if (studentGroups.Count == 0)
                {
                    // Guruhsiz talaba: Asosan kino va so'z yodlash
                    var text = $"Assalomu alaykum, <b>{user.FullName}</b>! 👋\n" +
                               $"👑 <b>Student Premium obunangiz faol!</b>\n\n" +
                               $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                               $"⏳ <b>Amal qilish muddati:</b> ~{remainingFormatted} <i>(real-time sarflanadi)</i>\n\n" +
                               $"🎯 <b>Siz mustaqil ta'lim rejimidasiz:</b>\n" +
                               $"Hozirda hech qanday dars guruhiga a'zo emassiz, shuning uchun asosiy e'tiboringizni kino va so'z boyligingizni oshirishga qaratishingiz mumkin:\n\n" +
                               $"🎬 <b>1. Kinolar va Seriallar:</b>\n" +
                               $"Inglizcha filmlarni interaktiv subtitrlar bilan tomosha qiling, yangi so'zlarni saqlang va film ichidagi <b>AI Ustoz</b> bilan muloqot qiling!\n\n" +
                               $"📖 <b>2. Lug'at va So'z yodlash:</b>\n" +
                               $"Eng mashhur darslik va kitoblardan minglab yangi so'zlarni audio talaffuzi bilan yodlang.\n\n" +
                               $"✨ <i>(Kelajakda: insho/esseni rasmga olib AI tahlil qilish imkoniyati ham qo'shiladi! 🚀)</i>\n\n" +
                               $"💡 <i>Eslatma: Agar ustozingiz bo'lsa, ular sizni dars guruhiga qo'shishi bilanoq uyga vazifalar ham avtomatik ochiladi.</i>\n\n" +
                               $"👇 <i>Davom etish uchun bo'limni tanlang:</i>";

                    var kb = new InlineKeyboardMarkup(new[]
                    {
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("🎬 Kinolarni tomosha qilish", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=movies" }),
                            InlineKeyboardButton.WithWebApp("📖 Lug'at yodlash", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=vocabulary" })
                        },
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("🎓 O'quvchi kabineti (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl })
                        },
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("💳 Balans va Tariflar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&open_plans=1" })
                        }
                    });

                    await SendOrEditMessageAsync(chatId, messageIdToEdit, text, kb);
                    return;
                }
                else
                {
                    // Guruhga a'zo talaba: Uyga vazifalar + Kinolar + Lug'at
                    var text = $"Assalomu alaykum, <b>{user.FullName}</b>! 👋\n" +
                               $"👑 <b>Student Premium obunangiz faol!</b>\n\n" +
                               $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                               $"⏳ <b>Amal qilish muddati:</b> ~{remainingFormatted} <i>(real-time sarflanadi)</i>\n\n" +
                               $"🏫 <b>Ulangan guruhlaringiz:</b> {studentGroups.Count} ta faol dars guruhi\n\n" +
                               $"Siz uchun barcha imkoniyatlar to'liq ochiq:\n" +
                               $"📝 <b>Uyga vazifalar:</b> Guruhingiz o'qituvchisi bergan topshiriq va testlarni topshiring\n" +
                               $"🎬 <b>Kinolar va seriallar:</b> Inglizcha filmlarni subtitrlar va AI Ustoz bilan tomosha qiling\n" +
                               $"📖 <b>So'z yodlash:</b> Lug'atlardagi yangi so'zlarni audio bilan o'zlashtiring\n\n" +
                               $"✨ <i>(Kelajakda: insho/esseni rasmga olib AI tahlil qilish imkoni ham qo'shiladi! 🚀)</i>\n\n" +
                               $"👇 <i>Darslarni davom ettirish uchun bo'limni tanlang:</i>";

                    var kb = new InlineKeyboardMarkup(new[]
                    {
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("📝 Uyga vazifalar va Guruhlar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=homework" })
                        },
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("🎬 Kinolar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=movies" }),
                            InlineKeyboardButton.WithWebApp("📖 Lug'at", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=vocabulary" })
                        },
                        new[]
                        {
                            InlineKeyboardButton.WithWebApp("🎓 O'quvchi ilovasi", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl }),
                            InlineKeyboardButton.WithWebApp("💳 Balans va Tariflar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&open_plans=1" })
                        }
                    });

                    await SendOrEditMessageAsync(chatId, messageIdToEdit, text, kb);
                    return;
                }
            }
            else
            {
                // TEACHER PLAN OBUNASI
                var text = $"Assalomu alaykum, <b>{user.FullName}</b>! 👋\n" +
                           $"👑 <b>O'qituvchi obunangiz ({activeSub.PlanName}) faol!</b>\n\n" +
                           $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                           $"⏳ <b>Amal qilish muddati:</b> ~{remainingFormatted} <i>(real-time sarflanadi)</i>\n\n" +
                           $"👥 <b>Faol guruhlaringiz:</b> {teacherGroups.Count} ta guruh\n\n" +
                           $"O'qituvchi vositalaringiz to'liq faol:\n" +
                           $"• Guruh topshiriqlari va testlarni avtomatlashtirish\n" +
                           $"• O'quvchilar javoblarini tekshirish va jarimalar nazorati\n" +
                           $"• So'z yodlash monitoringi\n\n" +
                           $"👇 <i>O'qituvchi boshqaruv kabinetiga kiring:</i>";

                var kb = new InlineKeyboardMarkup(new[]
                {
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp("👨‍🏫 O'qituvchi Paneli (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = teacherTmaUrl })
                    },
                    new[]
                    {
                        InlineKeyboardButton.WithUrl("➕ Botni yangi guruhga qo'shish", $"https://t.me/{botUsername}?startgroup=true"),
                        InlineKeyboardButton.WithUrl("🌐 Web orqali kirish", loginUrl)
                    }
                });

                await SendOrEditMessageAsync(chatId, messageIdToEdit, text, kb);
                return;
            }
        }

        // =====================================================================
        // HOLAT 2: HALI OBUNA YO'Q YOKI MUDDATI TUGAGAN
        // =====================================================================
        var cardSetting = await db.CardPaymentSettings.FirstOrDefaultAsync();
        decimal bonusAmount = cardSetting?.InitialBonusAmount > 0 ? cardSetting.InitialBonusAmount : 25000m;
        decimal minAmount = cardSetting?.MinAmount > 0 ? cardSetting.MinAmount : 15000m;

        bool hasPriorSubscription = await db.UserSubscriptions.AnyAsync(s => s.UserId == user.Id);
        bool canClaimBonus = !user.HasReceivedInitialBonus && !hasPriorSubscription;

        if (canClaimBonus)
        {
            // Yangi foydalanuvchi yoki hali tarif belgilanmagan: Tarmoqlangan qisqa kirish menyusi
            var welcomeMsg = $"Assalomu alaykum, <b>{user.FullName}</b>! 👋\n" +
                             $"<b>Lanswitch</b> ta'lim platformasiga xush kelibsiz.\n\n" +
                             $"🎁 <b>Boshlang'ich bonus:</b> Yangi foydalanuvchilar uchun <b>{bonusAmount:N0} so'm</b> bepul bonus tayyor!\n\n" +
                             $"Platformadan qaysi maqsadda foydalanmoqchisiz? O'zingizga mos bo'limni tanlang 👇";

            var branchingKeyboard = new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("🎓 Men O'quvchiman / Talaba", "branch:student"),
                    InlineKeyboardButton.WithCallbackData("👨‍🏫 Men O'qituvchiman", "branch:teacher")
                },
                new[]
                {
                    InlineKeyboardButton.WithWebApp("🚀 To'g'ridan-to'g'ri ilovaga kirish", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl })
                }
            });

            await SendOrEditMessageAsync(chatId, messageIdToEdit, welcomeMsg, branchingKeyboard);
            return;
        }
        else
        {
            // Avval obuna/bonus ishlatgan, lekin hozir muddati tugagan foydalanuvchi
            bool isTeacherUser = user.Role == "Teacher" || teacherGroups.Count > 0;
            var expiredMsg = $"Assalomu alaykum, <b>{user.FullName}</b>! 👋\n\n" +
                             $"⚠️ <b>Tarifingiz muddati yakunlangan!</b>\n\n" +
                             $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n\n" +
                             (isTeacherUser
                                 ? $"Guruhlaringiz va o'quvchilaringiz bilan ishlashni davom ettirish uchun hisobingizni minimal <b>{minAmount:N0}+ so'm</b>ga to'ldiring!\n\n"
                                 : $"Kinolarni tomosha qilish, film ichida AI Ustoz bilan muloqot qilish va o'qishni davom ettirish uchun hisobingizni minimal <b>{minAmount:N0}+ so'm</b>ga to'ldiring!\n\n") +
                             $"💡 <i>Mablag' sekundlarigacha aniqlikda, faqat faol foydalangan vaqtingiz bo'yicha real-time sarflanadi.</i>\n\n" +
                             $"👇 <i>Davom etish uchun quyidagilardan birini tanlang:</i>";

            var expiredKb = isTeacherUser
                ? new InlineKeyboardMarkup(new[]
                {
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp("🖥 O'qituvchi Paneli (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = teacherTmaUrl })
                    },
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp($"💳 Tariflar (Minimal {minAmount:N0} so'm)", new Telegram.Bot.Types.WebAppInfo { Url = $"{teacherTmaUrl}&open_plans=1" }),
                        InlineKeyboardButton.WithWebApp("🎓 O'quvchi kabineti", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl })
                    }
                })
                : new InlineKeyboardMarkup(new[]
                {
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp($"💳 Balansni to'ldirish (Minimal {minAmount:N0} so'm)", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&open_plans=1" })
                    },
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp("🎬 Kinolarni ko'rish", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=movies" }),
                        InlineKeyboardButton.WithWebApp("📖 Lug'at", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=vocabulary" })
                    },
                    new[]
                    {
                        InlineKeyboardButton.WithWebApp("📱 Mini App'ni ochish", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl }),
                        InlineKeyboardButton.WithWebApp("👨‍🏫 O'qituvchi bo'limi", new Telegram.Bot.Types.WebAppInfo { Url = teacherTmaUrl })
                    }
                });

            await SendOrEditMessageAsync(chatId, messageIdToEdit, expiredMsg, expiredKb);
            return;
        }
    }

    private async Task SendBranchDetailsAsync(long chatId, int messageId, Lanswitch.Domain.Entities.User user, string branch)
    {
        var me = await _botClient.GetMe();
        var botUsername = me.Username ?? "lanswitchbot";

        string frontend_host = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        var studentTmaUrl = $"https://{frontend_host}/student?role=student&user_id={user.Id}&telegram_id={user.TelegramId}";
        var teacherTmaUrl = $"https://{frontend_host}/teacher?role=teacher&user_id={user.Id}&telegram_id={user.TelegramId}";

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        bool hasPriorSubscription = await db.UserSubscriptions.AnyAsync(s => s.UserId == user.Id);
        bool canClaimBonus = !user.HasReceivedInitialBonus && !hasPriorSubscription;
        var cardSetting = await db.CardPaymentSettings.FirstOrDefaultAsync();
        decimal bonusAmount = cardSetting?.InitialBonusAmount > 0 ? cardSetting.InitialBonusAmount : 25000m;

        if (branch == "student")
        {
            var text = $"🎓 <b>O'quvchi / Talaba bo'limi</b>\n\n" +
                       $"Ingliz tilini mustaqil yoki guruhda samarali o'rganing:\n\n" +
                       $"1️⃣ <b>Kinolar va Seriallar:</b>\n" +
                       $"Filmlarni interaktiv subtitrlar bilan ko'ring, har bir gapni tahlil qiling va film ichidagi <b>AI Ustoz</b> bilan suhbatlashing.\n\n" +
                       $"2️⃣ <b>Lug'at va So'z yodlash:</b>\n" +
                       $"Darsliklardan minglab so'zlarni audio talaffuz va testlar orqali yodlang.\n\n" +
                       $"3️⃣ <b>Guruhdagi topshiriqlar:</b>\n" +
                       $"Agar o'qituvchingiz bo'lsa, sizni dars guruhiga qo'shishi bilanoq barcha uyga vazifalar avtomatik chiqadi.\n\n" +
                       $"✨ <i>(Kelajakda: insho/esse yozib rasmga olganda AI orqali tekshirish imkoni ham bo'ladi! 🚀)</i>\n\n" +
                       (canClaimBonus ? $"🎁 <i>Sizda {bonusAmount:N0} so'm bepul bonus mavjud! Ilovaga kirib darhol bonusni oling.</i>\n\n" : "") +
                       $"👇 <i>O'rganishni boshlash uchun tanlang:</i>";

            var kb = new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithWebApp("🚀 Ilovani ochish (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = studentTmaUrl })
                },
                new[]
                {
                    InlineKeyboardButton.WithWebApp("🎬 Kinolar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=movies" }),
                    InlineKeyboardButton.WithWebApp("📖 Lug'at", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentTmaUrl}&tab=vocabulary" })
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("🔙 Asosiy menyuga qaytish", "branch:main")
                }
            });

            await SendOrEditMessageAsync(chatId, messageId, text, kb);
        }
        else if (branch == "teacher")
        {
            var text = $"👨‍🏫 <b>O'qituvchi / Repetitor bo'limi</b>\n\n" +
                       $"O'quvchilaringiz darslarini va uyga vazifalarini 100% avtomatlashtiring:\n\n" +
                       $"1️⃣ <b>Guruhga ulang:</b>\n" +
                       $"O'quvchilaringiz mavjud bo'lgan Telegram guruhingizga botni qo'shing va <b>Administrator</b> qiling.\n\n" +
                       $"2️⃣ <b>Topshiriq va testlar:</b>\n" +
                       $"Darsliklardan so'zlar yodlash, 4 variantli testlar va video/audio topshiriqlarni bir necha soniyada e'lon qiling.\n\n" +
                       $"3️⃣ <b>Avtomatik nazorat:</b>\n" +
                       $"Bot o'quvchilar bajarganini tekshiradi, reyting tuzadi va kechikkanlarga jarimalar hisoblaydi.\n\n" +
                       $"👇 <i>Boshlash uchun qadamni tanlang:</i>";

            var kb = new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithWebApp("🖥 O'qituvchi Paneli (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = teacherTmaUrl })
                },
                new[]
                {
                    InlineKeyboardButton.WithUrl("➕ Botni guruhga qo'shish", $"https://t.me/{botUsername}?startgroup=true")
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("🔙 Asosiy menyuga qaytish", "branch:main")
                }
            });

            await SendOrEditMessageAsync(chatId, messageId, text, kb);
        }
        else if (branch == "main")
        {
            await SendCustomizedStartMessageAsync(chatId, user, messageId);
        }
    }

    private async Task SendOrEditMessageAsync(long chatId, int? messageIdToEdit, string text, InlineKeyboardMarkup keyboard)
    {
        if (messageIdToEdit.HasValue)
        {
            try
            {
                await _botClient.EditMessageText(
                    chatId: chatId,
                    messageId: messageIdToEdit.Value,
                    text: text,
                    parseMode: ParseMode.Html,
                    replyMarkup: keyboard);
                return;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EditMessageText error: {ex.Message}");
            }
        }

        await _botClient.SendMessage(chatId, text, parseMode: ParseMode.Html, replyMarkup: keyboard);
    }

    private async Task HandleGroupStartAsync(long chatId, string title, Lanswitch.Domain.Entities.User user, Telegram.Bot.Types.User? fromUser)
    {
        if (fromUser == null) return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            var administrators = await _botClient.GetChatAdministrators(chatId);
            var callerIsAdmin = administrators.Any(a => a.User.Id == fromUser.Id);

            if (!callerIsAdmin)
            {
                await _botClient.SendMessage(
                    chatId,
                    "❌ <b>Botni faqat guruh egasi yoki administratorlari faollashtirishi mumkin.</b>",
                    parseMode: ParseMode.Html);
                return;
            }

            var creator = administrators.FirstOrDefault(a => a.Status == ChatMemberStatus.Creator) 
                          ?? administrators.FirstOrDefault(a => a.User.Id == fromUser.Id);

            if (creator == null) return;

            var ownerTgId = creator.User.Id.ToString();
            var ownerUser = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerTgId);
            if (ownerUser == null)
            {
                ownerUser = new Lanswitch.Domain.Entities.User
                {
                    TelegramId = ownerTgId,
                    FullName = $"{creator.User.FirstName} {creator.User.LastName}".Trim(),
                    Username = creator.User.Username,
                    Role = "Teacher",
                    NativeLanguageId = 1
                };
                db.Users.Add(ownerUser);
                await db.SaveChangesAsync();
            }
            else if (ownerUser.Role != "Teacher" && !ownerUser.IsAdmin)
            {
                ownerUser.Role = "Teacher";
                await db.SaveChangesAsync();
            }

            var group = await db.TelegramGroups.FirstOrDefaultAsync(g => g.TelegramChatId == chatId);
            if (group == null)
            {
                var now = DateTime.UtcNow;
                var activeTeacherSub = await db.UserSubscriptions
                    .Where(s => s.UserId == ownerUser.Id && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
                    .OrderByDescending(s => s.Id)
                    .FirstOrDefaultAsync();

                if (!ownerUser.IsAdmin && activeTeacherSub == null)
                {
                    await _botClient.SendMessage(
                        chatId,
                        "❌ <b>Yangi guruhni ulash uchun guruh egasida faol \"Ustoz\" tarifi bo'lishi lozim.</b>\n\n" +
                        $"Guruh egasi (@{ownerUser.Username ?? ownerUser.FullName}) avval botga kirib, \"Ustoz\" tarifini faollashtirishi kerak: @lanswitchbot",
                        parseMode: ParseMode.Html);
                    try { await _botClient.LeaveChat(chatId); } catch {}
                    return;
                }

                if (!ownerUser.IsAdmin && activeTeacherSub != null)
                {
                    var currentGroupCount = await db.TelegramGroups.CountAsync(g => g.OwnerId == ownerUser.Id && g.IsActive);
                    if (currentGroupCount >= activeTeacherSub.MaxGroups)
                    {
                        await _botClient.SendMessage(
                            chatId,
                            $"❌ <b>Sizning tarifingizdagi guruhlar limiti ({activeTeacherSub.MaxGroups} ta) to'lgan!</b>\n\n" +
                            "Yangi guruh ulash uchun tarifingizni oshiring: @lanswitchbot",
                            parseMode: ParseMode.Html);
                        try { await _botClient.LeaveChat(chatId); } catch {}
                        return;
                    }
                }

                group = new TelegramGroup
                {
                    TelegramChatId = chatId,
                    Title = title,
                    OwnerId = ownerUser.Id,
                    IsActive = true
                };
                db.TelegramGroups.Add(group);
                await db.SaveChangesAsync();
            }
            else
            {
                group.Title = title;
                group.OwnerId = ownerUser.Id;
                group.IsActive = true;
                await db.SaveChangesAsync();
            }

            foreach (var admin in administrators)
            {
                if (admin.Status == ChatMemberStatus.Creator) continue;
                var adminTgId = admin.User.Id.ToString();
                var adminUser = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == adminTgId);
                if (adminUser == null)
                {
                    adminUser = new Lanswitch.Domain.Entities.User
                    {
                        TelegramId = adminTgId,
                        FullName = $"{admin.User.FirstName} {admin.User.LastName}".Trim(),
                        Username = admin.User.Username,
                        Role = "Teacher",
                        NativeLanguageId = 1
                    };
                    db.Users.Add(adminUser);
                    await db.SaveChangesAsync();
                }

                var groupAdmin = await db.GroupAdmins.FirstOrDefaultAsync(ga => ga.GroupId == group.Id && ga.UserId == adminUser.Id);
                if (groupAdmin == null)
                {
                    db.GroupAdmins.Add(new GroupAdmin
                    {
                        GroupId = group.Id,
                        UserId = adminUser.Id,
                        IsOwner = false,
                        CanCreateHomework = true,
                        CanReviewHomework = true,
                        CanManageMembers = true
                    });
                }
            }
            await db.SaveChangesAsync();

            var me = await _botClient.GetMe();
            var botUsername = me.Username ?? "lanswitchbot";
            string frontendHost = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
            var webUrl = $"https://{frontendHost}/teacher";

            var keyboard = new InlineKeyboardMarkup(new[]
            {
                new[] { InlineKeyboardButton.WithUrl("🖥 O'qituvchi Web Paneli", webUrl) },
                new[] { InlineKeyboardButton.WithUrl("📱 Botga /start bosish", $"https://t.me/{botUsername}?start=group_{group.Id}") }
            });

            var text = $"✅ <b>Guruh muvaffaqiyatli Lanswitch tizimiga ulandi!</b>\n\n" +
                       $"📚 <b>Guruh:</b> {title}\n" +
                       $"👑 <b>O'qituvchi:</b> {ownerUser.FullName}\n\n" +
                       $"👥 <i>O'quvchilar darslar va uyga vazifalarni qabul qilish uchun quyidagi tugma orqali botga /start bosishlari lozim 👇</i>";

            await _botClient.SendMessage(chatId, text, parseMode: ParseMode.Html, replyMarkup: keyboard);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Group start error: {ex.Message}");
        }
    }

    private async Task HandleMyChatMemberAsync(ChatMemberUpdated myChatMember)
    {
        var chatId = myChatMember.Chat.Id;
        var title = myChatMember.Chat.Title ?? "Telegram Group";
        var status = myChatMember.NewChatMember.Status;

        if (status == ChatMemberStatus.Administrator || status == ChatMemberStatus.Member)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            try
            {
                var administrators = await _botClient.GetChatAdministrators(chatId);
                var creator = administrators.FirstOrDefault(a => a.Status == ChatMemberStatus.Creator);
                if (creator == null) return;

                var ownerTelegramId = creator.User.Id.ToString();
                var ownerUser = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == ownerTelegramId);
                if (ownerUser == null)
                {
                    ownerUser = new Lanswitch.Domain.Entities.User
                    {
                        TelegramId = ownerTelegramId,
                        FullName = $"{creator.User.FirstName} {creator.User.LastName}".Trim(),
                        Username = creator.User.Username,
                        Role = "Teacher",
                        NativeLanguageId = 1
                    };
                    db.Users.Add(ownerUser);
                    await db.SaveChangesAsync();
                }
                else if (ownerUser.Role != "Teacher" && !ownerUser.IsAdmin)
                {
                    ownerUser.Role = "Teacher";
                    await db.SaveChangesAsync();
                }

                var group = await db.TelegramGroups.FirstOrDefaultAsync(g => g.TelegramChatId == chatId);
                if (group == null)
                {
                    var now = DateTime.UtcNow;
                    var activeTeacherSub = await db.UserSubscriptions
                        .Where(s => s.UserId == ownerUser.Id && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
                        .OrderByDescending(s => s.Id)
                        .FirstOrDefaultAsync();

                    if (!ownerUser.IsAdmin && activeTeacherSub == null)
                    {
                        await _botClient.SendMessage(
                            chatId,
                            "❌ <b>Yangi guruhni ulash uchun guruh egasida faol \"Ustoz\" tarifi bo'lishi lozim.</b>\n\n" +
                            $"Guruh egasi (@{ownerUser.Username ?? ownerUser.FullName}) avval botga kirib, \"Ustoz\" tarifini faollashtirishi kerak: @lanswitchbot",
                            parseMode: ParseMode.Html);
                        try { await _botClient.LeaveChat(chatId); } catch {}
                        return;
                    }

                    if (!ownerUser.IsAdmin && activeTeacherSub != null)
                    {
                        var currentGroupCount = await db.TelegramGroups.CountAsync(g => g.OwnerId == ownerUser.Id && g.IsActive);
                        if (currentGroupCount >= activeTeacherSub.MaxGroups)
                        {
                            await _botClient.SendMessage(
                                chatId,
                                $"❌ <b>Sizning tarifingizdagi guruhlar limiti ({activeTeacherSub.MaxGroups} ta) to'lgan!</b>\n\n" +
                                "Yangi guruh ulash uchun tarifingizni oshiring: @lanswitchbot",
                                parseMode: ParseMode.Html);
                            try { await _botClient.LeaveChat(chatId); } catch {}
                            return;
                        }
                    }

                    group = new TelegramGroup
                    {
                        TelegramChatId = chatId,
                        Title = title,
                        OwnerId = ownerUser.Id,
                        IsActive = true
                    };
                    db.TelegramGroups.Add(group);
                    await db.SaveChangesAsync();
                }
                else
                {
                    group.Title = title;
                    group.OwnerId = ownerUser.Id;
                    group.IsActive = true;
                    await db.SaveChangesAsync();
                }

                // Guruh adminlarini ro'yxatga olish
                foreach (var admin in administrators)
                {
                    if (admin.Status == ChatMemberStatus.Creator) continue;
                    var adminTgId = admin.User.Id.ToString();
                    var adminUser = await db.Users.FirstOrDefaultAsync(u => u.TelegramId == adminTgId);
                    if (adminUser == null)
                    {
                        adminUser = new Lanswitch.Domain.Entities.User
                        {
                            TelegramId = adminTgId,
                            FullName = $"{admin.User.FirstName} {admin.User.LastName}".Trim(),
                            Username = admin.User.Username,
                            Role = "Teacher",
                            NativeLanguageId = 1
                        };
                        db.Users.Add(adminUser);
                        await db.SaveChangesAsync();
                    }

                    var groupAdmin = await db.GroupAdmins.FirstOrDefaultAsync(ga => ga.GroupId == group.Id && ga.UserId == adminUser.Id);
                    if (groupAdmin == null)
                    {
                        db.GroupAdmins.Add(new GroupAdmin
                        {
                            GroupId = group.Id,
                            UserId = adminUser.Id,
                            IsOwner = false,
                            CanCreateHomework = true,
                            CanReviewHomework = true,
                            CanManageMembers = true
                        });
                    }
                }
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Group sync error: {ex.Message}");
            }
        }
    }

    private async Task ShowAdminMenuAsync(long chatId)
    {
        string frontendHost = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        var adminUrl = $"https://{frontendHost}/admin";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("🛡️ WebApp Admin Panel", new WebAppInfo { Url = adminUrl })
            },
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
        await _botClient.SendMessage(chatId, "🛠 *Admin Panel*\nWebApp orqali to'liq boshqarish yoki quyidagi menyudan foydalaning:", parseMode: ParseMode.Markdown, replyMarkup: keyboard);
    }

    private async Task HandleCallbackQueryAsync(CallbackQuery callbackQuery)
    {
        var chatId = callbackQuery.Message!.Chat.Id;
        var data = callbackQuery.Data;
        
        var user = await GetOrCreateUserAsync(callbackQuery.From);

        // Tarmoqlangan start menyu callbacklari
        if (data != null && data.StartsWith("branch:"))
        {
            var branchKey = data.Replace("branch:", "");
            if (branchKey == "student" || branchKey == "teacher")
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var dbUser = await db.Users.FindAsync(user.Id);
                if (dbUser != null)
                {
                    dbUser.Role = branchKey == "teacher" ? "Teacher" : "Student";
                    await db.SaveChangesAsync();
                    user.Role = dbUser.Role;
                }
            }
            await SendBranchDetailsAsync(chatId, callbackQuery.Message!.MessageId, user, branchKey);
            try
            {
                await _botClient.AnswerCallbackQuery(callbackQuery.Id);
            }
            catch { }
            return;
        }

        // To'lov chekini botdan tasdiqlash yoki bekor qilish
        if (data != null && data.StartsWith("pay_approve:"))
        {
            if (long.TryParse(data.Replace("pay_approve:", ""), out var reqId))
            {
                using var scope = _scopeFactory.CreateScope();
                var subService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                try
                {
                    await subService.ApprovePaymentRequestAsync(reqId, null, null, user.FullName);
                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, "✅ To'lov muvaffaqiyatli tasdiqlandi!");
                }
                catch (Exception ex)
                {
                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, $"❌ Xatolik: {ex.Message}", showAlert: true);
                }
                return;
            }
        }

        if (data != null && data.StartsWith("pay_reject:"))
        {
            if (long.TryParse(data.Replace("pay_reject:", ""), out var reqId))
            {
                using var scope = _scopeFactory.CreateScope();
                var subService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                try
                {
                    await subService.RejectPaymentRequestAsync(reqId, "Soxta chek yoki to'lov hisobga tushmagan", user.FullName);
                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, "❌ To'lov rad etildi!");
                }
                catch (Exception ex)
                {
                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, $"❌ Xatolik: {ex.Message}", showAlert: true);
                }
                return;
            }
        }

        // 1. O'quvchi tomonidan faylni tasdiqlash yoki bekor qilish
        if (data != null && data.StartsWith("confirm_sub_"))
        {
            if (long.TryParse(data.Replace("confirm_sub_", ""), out var itemId))
            {
                var state = _stateManager.GetState(chatId);
                if (state.Data.TryGetValue("PendingFileId", out var rawFileId) &&
                    state.Data.TryGetValue("PendingFileType", out var rawFileType))
                {
                    string fileId = rawFileId?.ToString() ?? "";
                    string fileType = rawFileType?.ToString() ?? "";
                    long fileSize = 0;
                    if (state.Data.TryGetValue("PendingFileSize", out var rawFileSize))
                    {
                        long.TryParse(rawFileSize?.ToString() ?? "0", out fileSize);
                    }

                    using var scope = _scopeFactory.CreateScope();
                    var assignService = scope.ServiceProvider.GetRequiredService<IAssignmentService>();

                    await assignService.SubmitMediaItemAsync(user.Id, itemId, new List<AttachmentDto>
                    {
                        new AttachmentDto
                        {
                            TelegramFileId = fileId,
                            FileType = fileType,
                            FileSizeBytes = fileSize
                        }
                    });

                    _stateManager.ClearState(chatId);

                    string frontendHost = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
                    var studentTmaUrl = $"https://{frontendHost}/student?role=student&user_id={user.Id}&telegram_id={user.TelegramId}&tab=homework";
                    var backKeyboard = new InlineKeyboardMarkup(new[]
                    {
                        new[] { InlineKeyboardButton.WithWebApp("📱 Mini App ga qaytish", new WebAppInfo { Url = studentTmaUrl }) }
                    });

                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, "Topshirig'ingiz qabul qilindi!");
                    await _botClient.EditMessageText(
                        chatId,
                        callbackQuery.Message.MessageId,
                        "✅ <b>Topshirig'ingiz muvaffaqiyatli qabul qilindi va yuklandi!</b>\n\nUstozingiz tekshirib baholaganida sizga xabar boradi.",
                        parseMode: ParseMode.Html,
                        replyMarkup: backKeyboard);
                    return;
                }
            }
        }
        else if (data != null && data.StartsWith("cancel_sub_"))
        {
            _stateManager.ClearState(chatId);
            await _botClient.AnswerCallbackQuery(callbackQuery.Id, "Topshiriq yuklash bekor qilindi");

            string frontendHost = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
            var studentTmaUrl = $"https://{frontendHost}/student?role=student&user_id={user.Id}&telegram_id={user.TelegramId}&tab=homework";
            var backKeyboard = new InlineKeyboardMarkup(new[]
            {
                new[] { InlineKeyboardButton.WithWebApp("📱 Mini App ga qaytish", new WebAppInfo { Url = studentTmaUrl }) }
            });

            await _botClient.EditMessageText(
                chatId,
                callbackQuery.Message.MessageId,
                "🗑️ <b>Topshiriq yuklash bekor qilindi.</b>\n\nIstalgan vaqtda Mini App orqali qayta yuborishingiz mumkin.",
                parseMode: ParseMode.Html,
                replyMarkup: backKeyboard);
            return;
        }

        // 2. O'qituvchi tomonidan botda baholash (grade_sub_{subId}_{status})
        if (data != null && data.StartsWith("grade_sub_"))
        {
            var parts = data.Split('_');
            if (parts.Length == 4 && long.TryParse(parts[2], out var subId) && int.TryParse(parts[3], out var status))
            {
                using var scope = _scopeFactory.CreateScope();
                var assignService = scope.ServiceProvider.GetRequiredService<IAssignmentService>();
                var ok = await assignService.GradeItemSubmissionAsync(subId, user.Id, new GradeSubmissionDto { Status = status, Comment = "Telegram bot orqali baholandi" });
                if (ok)
                {
                    string statusIcon = status switch
                    {
                        1 => "✅ 1 Bajarildi",
                        0 => "❌ 0 Jarima",
                        2 => "⚠️ 2 Jarima Bajarildi",
                        _ => "Tekshirildi"
                    };

                    await _botClient.AnswerCallbackQuery(callbackQuery.Id, $"Baholandi: {statusIcon}", showAlert: true);
                    try
                    {
                        await _botClient.EditMessageCaption(
                            chatId,
                            callbackQuery.Message.MessageId,
                            caption: (callbackQuery.Message.Caption ?? "") + $"\n\n🎯 <b>O'qituvchi bahosi:</b> {statusIcon}",
                            parseMode: ParseMode.Html);
                    }
                    catch {}
                    return;
                }
            }
        }

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
            
            // --- Aqlli guruhlash funksiyasi (Subtitrlarni mantiqiy bloklarga ajratadi) ---
            var smartBatches = new List<List<Subtitle>>();
            var currentGroup = new List<Subtitle>();

            double maxTimeGapSeconds = 2.0; // Subtitrlar orasidagi maksimal vaqt (2 soniya)
            int currentGroupLength = 0;

            for (int index = 0; index < subtitles.Count; index++)
            {
                var currentSub = subtitles[index];
                currentGroup.Add(currentSub);
                currentGroupLength += currentSub.Text.Length;

                bool isLastElement = (index == subtitles.Count - 1);
                bool shouldSplit = false;

                if (!isLastElement)
                {
                    var nextSub = subtitles[index + 1];
                    
                    // 1-Qoida: Oradagi vaqt tahlili
                    var currentEndTime = currentSub.EndTime;
                    var nextStartTime = nextSub.StartTime;
                    double gap = (nextStartTime - currentEndTime).TotalSeconds;

                    // 2-Qoida: Matn nuqta, so'roq yoki undov bilan tugaganmi?
                    string trimmedText = currentSub.Text.Trim();
                    bool isSentenceEnd = trimmedText.EndsWith(".") || trimmedText.EndsWith("!") || trimmedText.EndsWith("?");

                    // Guruhni bo'lish kerakmi yoki yo'qligini aniqlaymiz
                    if (gap > maxTimeGapSeconds || isSentenceEnd || currentGroup.Count >= 20 || currentGroupLength + nextSub.Text.Length >= 1000)
                    {
                        shouldSplit = true;
                    }
                }
                else
                {
                    // Agar eng oxirgi element bo'lsa, baribir guruhni yopish (bo'lish) kerak
                    shouldSplit = true;
                }

                // Guruhni asosiy ro'yxatga qo'shish mantiqi
                if (shouldSplit)
                {
                    // Agar oldingi guruh mavjud bo'lsa va u bilan birlashtirganda ham 1000 dan oshmasa
                    if (smartBatches.Count > 0 && 
                        (smartBatches[^1].Sum(s => s.Text.Length) + currentGroupLength) <= 1000)
                    {
                        // Oldingi guruhning o'ziga qo'shib yuboramiz
                        smartBatches[^1].AddRange(currentGroup);
                    }
                    else
                    {
                        // Aks holda yangi guruh sifatida qo'shamiz
                        smartBatches.Add(currentGroup);
                    }

                    // Guruhni nollashtiramiz
                    currentGroupLength = 0;
                    currentGroup = new List<Subtitle>(); 
                }
            }

            // --- 2-QADAM: GEMINI AI ORQALI TAHLIL (Endi smartBatches ustida aylanadi) ---
            await botClient.SendMessage(chatId, "🤖 Gemini AI orqali aqlli guruhlangan subtitrlarni tahlil qilish boshlandi... ⏳");

            int indexOffset = 1;

            foreach (var batch in smartBatches)
            {
                var batchJsonData = batch.Select(s => new { id = s.Id, text = s.Text }).ToList();
                var subtitlesJson = System.Text.Json.JsonSerializer.Serialize(batchJsonData);
                
                var aiAnalyses = await geminiService.AnalyzeGrammarAsync(subtitlesJson, langTitle);
                
                if (aiAnalyses != null && aiAnalyses.Count > 0)
                {
                    foreach (var analysis in aiAnalyses)
                    {
                        var gap = new Gap
                        {
                            Text = analysis.SentenceText,
                            AiAnalysis = analysis.AiAnalysis,
                            SubtitleId = analysis.SubtitleId, 
                            Index = indexOffset++,
                            AiGrammarContextIds = analysis.GrammarContextIds
                        };
                        await gapRepo.AddAsync(gap);
                        
                        // O'zak so'zlarni saqlash mantiqi (O'zgarishsiz qoladi)
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
                                    
                                    var newTranslate = new WordTranslate { WordId = newWord.Id, LanguageId = 1, TranslateText = rw.Translation.Trim() };
                                    await wordTranslateRepo.AddAsync(newTranslate);
                                    
                                    wordId = newWord.Id;
                                    existingWords[wordText] = wordId;
                                }
                                
                                await subtitleWordRepo.AddAsync(new SubtitleWord
                                {
                                    SubtitleId = analysis.SubtitleId,
                                    WordId = wordId
                                });
                            }
                        }
                    }
                }
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
