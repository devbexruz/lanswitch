using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Lanswitch.Infrastructure.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _context;
    private readonly ITelegramBotClient _botClient;

    public SubscriptionService(AppDbContext context, ITelegramBotClient botClient)
    {
        _context = context;
        _botClient = botClient;
    }

    public static readonly List<SubscriptionPlanConfig> DefaultPlans = new()
    {
        new SubscriptionPlanConfig
        {
            PlanId = "student_monthly",
            Name = "Student Premium",
            TargetRole = "Student",
            MonthlyPrice = 50000,
            Period = "1 oy",
            MaxGroups = 0,
            HasTrial = false,
            TrialDays = 0,
            Badge = "Talabalar uchun",
            FeaturesJson = JsonSerializer.Serialize(new[]
            {
                "Kinolarni cheksiz ko'rish va subtitr tahlili",
                "AI ustoz bilan cheksiz muloqot va grammatik tahlil",
                "Lug'at va darsliklardan to'liq foydalanish",
                "Uyga vazifalarni topshirish va natijalar nazorati"
            }),
            OrderIndex = 1,
            IsActive = true
        },
        new SubscriptionPlanConfig
        {
            PlanId = "teacher_standart",
            Name = "Ustoz - Standart",
            TargetRole = "Teacher",
            MonthlyPrice = 99000,
            Period = "1 oy",
            MaxGroups = 3,
            HasTrial = false,
            TrialDays = 0,
            Badge = "1-Tarif (3 ta guruh)",
            FeaturesJson = JsonSerializer.Serialize(new[]
            {
                "3 tagacha guruhni to'liq boshqarish",
                "Avtomatik uyga vazifalar berish va baholash",
                "Talabalar hisoboti va jarimalar nazorati"
            }),
            OrderIndex = 2,
            IsActive = true
        },
        new SubscriptionPlanConfig
        {
            PlanId = "teacher_pro",
            Name = "Ustoz - Pro",
            TargetRole = "Teacher",
            MonthlyPrice = 189000,
            Period = "1 oy",
            MaxGroups = 10,
            HasTrial = false,
            TrialDays = 0,
            Badge = "2-Tarif (Tavsiya etiladi)",
            FeaturesJson = JsonSerializer.Serialize(new[]
            {
                "10 tagacha guruhni to'liq boshqarish",
                "Kengaytirilgan tahlil va guruh statistikasi",
                "Avtomatik vazifalar va monitoring"
            }),
            OrderIndex = 3,
            IsActive = true
        },
        new SubscriptionPlanConfig
        {
            PlanId = "teacher_max",
            Name = "Ustoz - Max",
            TargetRole = "Teacher",
            MonthlyPrice = 249000,
            Period = "1 oy",
            MaxGroups = 20,
            HasTrial = false,
            TrialDays = 0,
            Badge = "3-Tarif (Maksimal)",
            FeaturesJson = JsonSerializer.Serialize(new[]
            {
                "20 tagacha guruhni to'liq boshqarish",
                "Cheksiz talabalar va to'liq avtomatlashtirish",
                "Prioritetli texnik qo'llab-quvvatlash"
            }),
            OrderIndex = 4,
            IsActive = true
        }
    };

    public async Task<List<SubscriptionPlanConfig>> GetPlansAsync()
    {
        var plans = await _context.SubscriptionPlanConfigs
            .OrderBy(p => p.OrderIndex)
            .ToListAsync();

        if (plans.Count == 0)
        {
            _context.SubscriptionPlanConfigs.AddRange(DefaultPlans);
            await _context.SaveChangesAsync();
            return DefaultPlans;
        }

        // Ustoz tariflaridan Student Premium qatorini tozalash
        bool changed = false;
        foreach (var p in plans)
        {
            if (p.TargetRole == "Teacher" && !string.IsNullOrWhiteSpace(p.FeaturesJson) && p.FeaturesJson.Contains("Student Premium"))
            {
                try
                {
                    var feats = JsonSerializer.Deserialize<List<string>>(p.FeaturesJson) ?? new List<string>();
                    var filtered = feats.Where(f => !f.Contains("Student Premium", StringComparison.OrdinalIgnoreCase)).ToList();
                    p.FeaturesJson = JsonSerializer.Serialize(filtered);
                    changed = true;
                }
                catch { }
            }
        }
        if (changed)
        {
            await _context.SaveChangesAsync();
        }

        return plans;
    }

    public async Task<SubscriptionPlanConfig> UpdatePlanAsync(string planId, SubscriptionPlanConfig updated)
    {
        var existing = await _context.SubscriptionPlanConfigs.FirstOrDefaultAsync(p => p.PlanId == planId);
        if (existing == null)
        {
            existing = new SubscriptionPlanConfig { PlanId = planId };
            _context.SubscriptionPlanConfigs.Add(existing);
        }

        existing.Name = updated.Name;
        existing.TargetRole = updated.TargetRole;
        existing.MonthlyPrice = updated.MonthlyPrice;
        existing.Period = updated.Period ?? "1 oy";
        existing.MaxGroups = updated.MaxGroups;
        existing.HasTrial = updated.HasTrial;
        existing.TrialDays = updated.TrialDays;
        existing.Badge = updated.Badge ?? "";
        if (!string.IsNullOrEmpty(updated.FeaturesJson))
        {
            existing.FeaturesJson = updated.FeaturesJson;
        }
        existing.IsActive = updated.IsActive;
        existing.OrderIndex = updated.OrderIndex;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task<CardPaymentSetting> GetCardSettingsAsync()
    {
        var setting = await _context.CardPaymentSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            setting = new CardPaymentSetting
            {
                CardNumber = "9860 0000 0000 0000",
                CardHolder = "ADMINISTRATOR",
                BankName = "Humo / Uzcard",
                MinAmount = 15000,
                InitialBonusAmount = 25000,
                Instructions = "Xohlagancha pul o'tkazing, minimum 15,000 so'm. Tarifingizga mos ravishda muddat soat va minutlarigacha hisoblab qo'shiladi."
            };
            _context.CardPaymentSettings.Add(setting);
            await _context.SaveChangesAsync();
        }
        else if (setting.InitialBonusAmount <= 0)
        {
            setting.InitialBonusAmount = 25000;
        }
        return setting;
    }

    public async Task<CardPaymentSetting> UpdateCardSettingsAsync(CardPaymentSetting updated)
    {
        var setting = await _context.CardPaymentSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            setting = new CardPaymentSetting();
            _context.CardPaymentSettings.Add(setting);
        }

        setting.CardNumber = updated.CardNumber;
        setting.CardHolder = updated.CardHolder;
        setting.BankName = updated.BankName;
        setting.MinAmount = updated.MinAmount > 0 ? updated.MinAmount : 15000;
        setting.InitialBonusAmount = updated.InitialBonusAmount > 0 ? updated.InitialBonusAmount : 25000;
        setting.Instructions = updated.Instructions;
        setting.IsActive = updated.IsActive;

        await _context.SaveChangesAsync();
        return setting;
    }

    public async Task<object> CalculateSwitchAsync(long userId, string targetPlanId, decimal additionalAmount)
    {
        var plans = await GetPlansAsync();
        var targetPlan = plans.FirstOrDefault(p => p.PlanId == targetPlanId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == targetPlanId);

        if (targetPlan == null)
            throw new ArgumentException("Tanlangan tarif topilmadi");

        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        var now = DateTime.UtcNow;

        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == userId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool isCurrentTrial = activeSub != null && activeSub.IsTrial;
        decimal currentLiveBalance = user.Balance;
        string? currentPlanName = null;
        string? trialNotice = null;
        double remainingHours = 0;
        int remainingDays = 0;
        int remainingRemHours = 0;

        if (activeSub != null)
        {
            currentPlanName = activeSub.PlanName;
            var remainingSeconds = Math.Max(0, (activeSub.EndDate - now).TotalSeconds);
            remainingHours = remainingSeconds / 3600.0;
            remainingDays = (int)(remainingHours / 24);
            remainingRemHours = (int)(remainingHours % 24);

            var monthlyPrice = activeSub.Price > 0 ? activeSub.Price : 50000m;
            var perSecRate = monthlyPrice / (30m * 24m * 3600m);
            var elapsedSecs = Math.Max(0, (now - activeSub.StartDate).TotalSeconds);
            var spentSoFar = Math.Round((decimal)elapsedSecs * perSecRate);
            spentSoFar = Math.Min(user.Balance, spentSoFar);
            currentLiveBalance = Math.Max(0, user.Balance - spentSoFar);
        }

        var targetMonthlyPrice = targetPlan.MonthlyPrice > 0 ? targetPlan.MonthlyPrice : 50000m;
        var targetPerSecRate = targetMonthlyPrice / (30m * 24m * 3600m);

        // 1. Avvalgi qoldiq hisobidan
        decimal residualValue = currentLiveBalance;
        double fromResSecs = residualValue > 0 ? (double)(residualValue / targetPerSecRate) : 0;
        int fromResMins = (int)Math.Round(fromResSecs / 60.0);
        int fromResDays = fromResMins / (24 * 60);
        int fromResHours = (fromResMins % (24 * 60)) / 60;
        int fromResMinRem = fromResMins % 60;

        // 2. Yangi to'lov hisobidan
        double fromPaySecs = additionalAmount > 0 ? (double)(additionalAmount / targetPerSecRate) : 0;
        int fromPayMins = (int)Math.Round(fromPaySecs / 60.0);
        int fromPayDays = fromPayMins / (24 * 60);
        int fromPayHours = (fromPayMins % (24 * 60)) / 60;
        int fromPayMinRem = fromPayMins % 60;

        // 3. Jami muddat
        double totalSecs = fromResSecs + fromPaySecs;
        int totalMins = fromResMins + fromPayMins;
        int totalDays = totalMins / (24 * 60);
        int totalRemHours = (totalMins % (24 * 60)) / 60;
        int totalRemMins = totalMins % 60;

        bool isSwitchingTariff = activeSub != null && activeSub.PlanId != targetPlan.PlanId;

        return new
        {
            hasCurrentSubscription = activeSub != null,
            isSwitchingTariff,
            currentPlanId = activeSub?.PlanId,
            currentPlanName,
            isCurrentTrial,
            trialNotice,
            currentLiveBalance = Math.Round(currentLiveBalance, 0),
            currentRemainingDays = remainingDays,
            currentRemainingHours = remainingRemHours,
            currentTotalRemainingHours = Math.Round(remainingHours, 1),
            formattedRemainingCurrent = $"{remainingDays} kun {remainingRemHours} soat",
            residualValue = Math.Round(residualValue, 0),

            additionalAmount,
            totalBudget = Math.Round(residualValue + additionalAmount, 0),

            targetPlanId = targetPlan.PlanId,
            targetPlanName = targetPlan.Name,
            targetMonthlyPrice,

            fromResidualDuration = $"{fromResDays} kun {fromResHours} soat {fromResMinRem} minut",
            fromPaymentDuration = $"{fromPayDays} kun {fromPayHours} soat {fromPayMinRem} minut",
            totalDuration = $"{totalDays} kun {totalRemHours} soat {totalRemMins} minut",

            calculatedDays = totalDays,
            calculatedHours = totalRemHours,
            calculatedMinutes = totalRemMins,
            formattedDuration = $"{totalDays} kun {totalRemHours} soat {totalRemMins} minut"
        };
    }

    public async Task<SubscriptionPaymentRequest> SubmitReceiptAsync(long userId, string planId, decimal amount, string receiptUrl)
    {
        var plans = await GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == planId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == planId);

        if (plan == null) throw new ArgumentException("Tarif topilmadi");

        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        // Puliga yarasha vaqt hisoblash (agar summa kiritilgan bo'lsa)
        amount = Math.Max(0, amount);
        var hourlyRate = plan.MonthlyPrice / 720m;
        var calculatedHours = amount > 0 ? (amount / hourlyRate) : 0m;
        int totalMinutes = (int)Math.Round(calculatedHours * 60m);

        var request = new SubscriptionPaymentRequest
        {
            UserId = userId,
            PlanId = plan.PlanId,
            PlanName = plan.Name,
            Amount = amount,
            CalculatedDurationHours = calculatedHours,
            CalculatedDurationMinutes = totalMinutes,
            ReceiptImageUrl = receiptUrl,
            Status = "Pending",
            VerificationToken = Guid.NewGuid().ToString("N")
        };

        _context.SubscriptionPaymentRequests.Add(request);
        await _context.SaveChangesAsync();

        // Adminlarga Telegram orqali xabar yuborish
        int days = totalMinutes / (24 * 60);
        int remMins = totalMinutes % (24 * 60);
        int hours = remMins / 60;
        int mins = remMins % 60;

        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate > DateTime.UtcNow)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        string switchNotice = "";
        if (activeSub != null && activeSub.PlanId != plan.PlanId)
        {
            var remainingSecs = Math.Max(0, (activeSub.EndDate - DateTime.UtcNow).TotalSeconds);
            var remH = Math.Round(remainingSecs / 3600.0, 1);
            var oldPlan = plans.FirstOrDefault(p => p.PlanId == activeSub.PlanId)
                ?? DefaultPlans.FirstOrDefault(p => p.PlanId == activeSub.PlanId);
            var oldPrice = oldPlan?.MonthlyPrice ?? activeSub.Price;
            var oldHourly = oldPrice / 720m;
            var residualVal = (decimal)(remainingSecs / 3600.0) * oldHourly;

            switchNotice = $"\n🔄 <b>Tarif almashtirish:</b> {activeSub.PlanName} ➡️ {plan.Name}\n" +
                           $"⏱️ <b>Avvalgi qoldiq:</b> {remH} soat (~{residualVal:N0} so'm)\n" +
                           $"<i>Tasdiqlash vaqtida qoldiq yangi tarifga avtomatik qo'shiladi!</i>\n";
        }
        else if (activeSub != null && activeSub.PlanId == plan.PlanId)
        {
            switchNotice = $"\n⏳ <b>Mavjud tarifni uzaytirish:</b> {plan.Name}\n";
        }

        var amountDisplay = amount > 0 ? $"<b>{amount:N0} so'm</b>" : "<i>Ko'rsatilmagan (Chekda)</i>";
        var webAppVerifyUrl = $"https://lanswitch.developerlogic.uz/verify-receipt/{request.Id}?token={request.VerificationToken}";

        var messageText = $"🧾 <b>Yangi to'lov cheki yuborildi!</b> (№{request.Id})\n\n" +
                          $"👤 <b>Foydalanuvchi:</b> {user.FullName}\n" +
                          $"🆔 <b>Telegram ID:</b> <code>{user.TelegramId}</code>\n" +
                          $"📱 <b>Username:</b> @{user.Username ?? "mavjud emas"}\n\n" +
                          $"📦 <b>Tanlangan tarif:</b> {plan.Name}\n" +
                          $"💰 <b>Summa:</b> {amountDisplay}\n" +
                          (amount > 0 ? $"⏳ <b>Taxminiy vaqt:</b> {days} kun {hours} soat {mins} minut\n" : "") +
                          switchNotice +
                          $"\n📅 <b>Vaqt:</b> {DateTime.UtcNow.AddHours(5):yyyy-MM-dd HH:mm}\n\n" +
                          $"👇 <i>Chekni tekshirish, summani kiritish/tasdiqlash yoki rad etish uchun quyidagi tugmani bosing:</i>";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("🔍 Chekni ko'rish & Tasdiqlash", new WebAppInfo { Url = webAppVerifyUrl })
            }
        });

        // Barcha adminlarga botdan xabar jo'natamiz
        var admins = await _context.Users.Where(u => u.IsAdmin && !string.IsNullOrEmpty(u.TelegramId)).ToListAsync();
        foreach (var admin in admins)
        {
            if (long.TryParse(admin.TelegramId, out var adminChatId))
            {
                try
                {
                    // Chek rasmi mavjud bo'lsa
                    var fullLocalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", receiptUrl.TrimStart('/'));
                    if (File.Exists(fullLocalPath))
                    {
                        using var stream = File.OpenRead(fullLocalPath);
                        var sentMsg = await _botClient.SendPhoto(
                            adminChatId,
                            new InputFileStream(stream, Path.GetFileName(fullLocalPath)),
                            caption: messageText,
                            parseMode: ParseMode.Html,
                            replyMarkup: keyboard
                        );
                        request.AdminTelegramMessageId = sentMsg.Id;
                        request.AdminChatId = adminChatId;
                    }
                    else
                    {
                        var sentMsg = await _botClient.SendMessage(
                            adminChatId,
                            messageText,
                            parseMode: ParseMode.Html,
                            replyMarkup: keyboard
                        );
                        request.AdminTelegramMessageId = sentMsg.Id;
                        request.AdminChatId = adminChatId;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Admin {admin.FullName} ga xabar yuborishda xato: {ex.Message}");
                }
            }
        }

        await _context.SaveChangesAsync();
        return request;
    }

    public async Task<SubscriptionPaymentRequest> ApprovePaymentRequestAsync(
        long requestId, 
        decimal? correctedAmount, 
        string? adminNotes, 
        string? processedBy)
    {
        var req = await _context.SubscriptionPaymentRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (req == null) throw new ArgumentException("To'lov so'rovi topilmadi");
        if (req.Status != "Pending")
        {
            throw new InvalidOperationException($"Ushbu to'lov so'rovi allaqachon ko'rib chiqilgan! (Holati: {req.Status}, Tasdiqlagan: {req.ProcessedBy})");
        }

        var plans = await GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == req.PlanId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == req.PlanId);

        if (plan == null) throw new ArgumentException("Tarif topilmadi");

        decimal finalAmount = correctedAmount.HasValue && correctedAmount.Value > 0 
            ? correctedAmount.Value 
            : req.Amount;

        if (finalAmount <= 0)
        {
            throw new InvalidOperationException("Iltimos, chekdagi to'g'ri to'lov summasini kiriting!");
        }

        req.ApprovedAmount = finalAmount;
        var hourlyRate = plan.MonthlyPrice / 720m;
        var calculatedHours = finalAmount / hourlyRate;
        int totalMinutes = (int)Math.Round(calculatedHours * 60m);

        req.CalculatedDurationHours = calculatedHours;
        req.CalculatedDurationMinutes = totalMinutes;
        req.Status = "Approved";
        req.AdminNotes = adminNotes;
        req.ProcessedAt = DateTime.UtcNow;
        req.ProcessedBy = processedBy ?? "Admin";

        var user = req.User ?? await _context.Users.FindAsync(req.UserId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        var now = DateTime.UtcNow;

        // Foydalanuvchining faol obunasini aniqlash
        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == req.UserId && (s.Status == "Active" || s.IsActive))
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        DateTime newEnd = now;

        if (activeSub != null && !activeSub.IsTrial)
        {
            var monthlyPrice = activeSub.Price > 0 ? activeSub.Price : 50000m;
            var perSecRate = monthlyPrice / (30m * 24m * 3600m);

            if (now >= activeSub.EndDate)
            {
                // Avvalgi muddat to'liq tugagan
                activeSub.IsActive = false;
                activeSub.Status = "Expired";
                activeSub.FinishedDate = activeSub.EndDate;
                user.Balance = finalAmount; // Faqat yangi to'ldirilgan summa

                var newSeconds = (double)(user.Balance / perSecRate);
                newEnd = now.AddSeconds(newSeconds);

                activeSub = new UserSubscription
                {
                    UserId = user.Id,
                    PlanId = activeSub.PlanId,
                    PlanName = activeSub.PlanName,
                    TargetRole = activeSub.TargetRole,
                    MaxGroups = activeSub.MaxGroups,
                    Price = monthlyPrice,
                    IsTrial = false,
                    StartDate = now,
                    EndDate = newEnd,
                    InitialBalance = user.Balance,
                    DeductedAmount = 0,
                    IsActive = true,
                    Status = "Active",
                    LastActivatedAt = now,
                    TotalPaidAmount = finalAmount,
                    Notes = $"Balans to'ldirildi (+{finalAmount:N0} so'm) va obuna davom ettirildi."
                };
                _context.UserSubscriptions.Add(activeSub);
            }
            else
            {
                // Hali muddati davom etmoqda -> StartDate dan now gacha sarflangan qismini yechamiz
                var elapsedSecs = Math.Max(0, (now - activeSub.StartDate).TotalSeconds);
                var spentSoFar = Math.Round((decimal)elapsedSecs * perSecRate);
                spentSoFar = Math.Min(user.Balance, spentSoFar);

                user.Balance = Math.Max(0, user.Balance - spentSoFar) + finalAmount;

                activeSub.DeductedAmount += spentSoFar;
                activeSub.StartDate = now;
                activeSub.InitialBalance = user.Balance;

                var newSeconds = (double)(user.Balance / perSecRate);
                newEnd = now.AddSeconds(newSeconds);
                activeSub.EndDate = newEnd;
                activeSub.LastActivatedAt = now;
                activeSub.TotalPaidAmount += finalAmount;
                activeSub.Notes = $"Balans to'ldirildi (+{finalAmount:N0} so'm). Yangi muddat: {newEnd:yyyy-MM-dd HH:mm} gacha.";
            }
        }
        else
        {
            // Faol pullik obunasi yo'q (yoki sinov muddati edi)
            if (activeSub != null && activeSub.IsTrial)
            {
                activeSub.IsActive = false;
                activeSub.Status = "TrialEnded";
                activeSub.FinishedDate = now;
            }

            user.Balance += finalAmount;

            var targetPlan = plan;
            var monthlyPrice = targetPlan.MonthlyPrice > 0 ? targetPlan.MonthlyPrice : 50000m;
            var perSecRate = monthlyPrice / (30m * 24m * 3600m);
            var newSeconds = (double)(user.Balance / perSecRate);
            newEnd = now.AddSeconds(newSeconds);

            activeSub = new UserSubscription
            {
                UserId = user.Id,
                PlanId = targetPlan.PlanId,
                PlanName = targetPlan.Name,
                TargetRole = targetPlan.TargetRole,
                MaxGroups = targetPlan.MaxGroups,
                Price = monthlyPrice,
                IsTrial = false,
                StartDate = now,
                EndDate = newEnd,
                InitialBalance = user.Balance,
                DeductedAmount = 0,
                IsActive = true,
                Status = "Active",
                LastActivatedAt = now,
                TotalPaidAmount = finalAmount,
                Notes = $"Balans to'ldirildi (+{finalAmount:N0} so'm) va {targetPlan.Name} tarifi faollashtirildi."
            };
            _context.UserSubscriptions.Add(activeSub);
        }

        if (plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        // Log yozish
        var log = new SubscriptionLog
        {
            UserId = req.UserId,
            PlanId = activeSub.PlanId,
            PlanName = activeSub.PlanName,
            ActionType = "CardPaymentApproved",
            AmountPaid = finalAmount,
            DurationHours = (decimal)((newEnd - now).TotalHours),
            PeriodStart = now,
            PeriodEnd = newEnd,
            PreviousPlanId = null,
            PaymentRequestId = req.Id,
            Notes = $"To'lov tasdiqlandi: {finalAmount:N0} so'm. Balans: {user.Balance:N0} so'm. Tasdiqlovchi: {req.ProcessedBy}."
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        // 1. Foydalanuvchiga Telegram bot orqali xabar
        if (user != null && long.TryParse(user.TelegramId, out var userChatId))
        {
            var totalDurationSpan = newEnd - DateTime.UtcNow;
            int totalMinsAll = (int)Math.Round(totalDurationSpan.TotalMinutes);
            int d = totalMinsAll / (24 * 60);
            int rM = totalMinsAll % (24 * 60);
            int h = rM / 60;
            int m = rM % 60;

            var userMsg = $"🎉 <b>To'lovingiz muvaffaqiyatli tasdiqlandi!</b>\n\n" +
                          $"💰 <b>Kiritilgan summa:</b> {finalAmount:N0} so'm\n" +
                          $"💳 <b>Yangi hisob balansingiz:</b> <b>{user.Balance:N0} so'm</b>\n" +
                          $"📦 <b>Faol tarif:</b> {activeSub.PlanName}\n" +
                          $"⏳ <b>Hisoblangan umumiy muddat:</b> {d} kun {h} soat {m} minut\n" +
                          $"📅 <b>Amal qilish muddati:</b> <b>{newEnd.AddHours(5):yyyy-MM-dd HH:mm}</b> gacha\n\n" +
                          $"Lanswitch xizmatlaridan maroqli foydalaning! 🚀";

            try
            {
                await _botClient.SendMessage(userChatId, userMsg, parseMode: ParseMode.Html);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Foydalanuvchiga botdan xabar borishida xato: {ex.Message}");
            }
        }

        // 2. Admin bot xabarini yangilash (inline tugmalarni yopish)
        if (req.AdminChatId.HasValue && req.AdminTelegramMessageId.HasValue)
        {
            try
            {
                var caption = $"✅ <b>TO'LOV TASDIQLANDI</b> (№{req.Id})\n" +
                              $"👤 Foydalanuvchi: {user?.FullName}\n" +
                              $"📦 Tarif: {plan.Name}\n" +
                              $"💰 Tasdiqlangan summa: {finalAmount:N0} so'm\n" +
                              $"📅 Muddat: {newEnd.AddHours(5):yyyy-MM-dd HH:mm} gacha\n" +
                              $"👮‍♂️ Tasdiqladi: {req.ProcessedBy}";

                await _botClient.EditMessageCaption(
                    req.AdminChatId.Value,
                    req.AdminTelegramMessageId.Value,
                    caption,
                    parseMode: ParseMode.Html,
                    replyMarkup: null
                );
            }
            catch { }
        }

        return req;
    }

    public async Task<SubscriptionPaymentRequest> RejectPaymentRequestAsync(
        long requestId, 
        string? reason, 
        string? processedBy)
    {
        var req = await _context.SubscriptionPaymentRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (req == null) throw new ArgumentException("To'lov so'rovi topilmadi");
        if (req.Status != "Pending")
        {
            throw new InvalidOperationException($"Ushbu to'lov so'rovi allaqachon ko'rib chiqilgan! (Holati: {req.Status}, Bajaruvchi: {req.ProcessedBy})");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new InvalidOperationException("Iltimos, rad etish sababini ko'rsating!");
        }

        req.Status = "Rejected";
        req.AdminNotes = reason;
        req.ProcessedAt = DateTime.UtcNow;
        req.ProcessedBy = processedBy ?? "Admin";

        await _context.SaveChangesAsync();

        var user = req.User ?? await _context.Users.FindAsync(req.UserId);
        if (user != null && long.TryParse(user.TelegramId, out var userChatId))
        {
            var userMsg = $"❌ <b>Afsuski, to'lov chekingiz tasdiqlanmadi.</b>\n\n" +
                          $"📦 <b>Tarif:</b> {req.PlanName}\n" +
                          $"❗ <b>Rad etish sababi:</b> {req.AdminNotes}\n\n" +
                          $"<i>Iltimos, to'lov chekini qaytadan to'g'ri yuboring yoki savollaringiz bo'lsa admin bilan bog'laning.</i>";

            try
            {
                await _botClient.SendMessage(userChatId, userMsg, parseMode: ParseMode.Html);
            }
            catch { }
        }

        if (req.AdminChatId.HasValue && req.AdminTelegramMessageId.HasValue)
        {
            try
            {
                var caption = $"❌ <b>TO'LOV RAD ETILDI</b> (№{req.Id})\n" +
                              $"👤 Foydalanuvchi: {user?.FullName}\n" +
                              $"📦 Tarif: {req.PlanName}\n" +
                              $"💰 Summa: {req.Amount:N0} so'm\n" +
                              $"❗ Sabab: {req.AdminNotes}\n" +
                              $"👮‍♂️ Rad etdi: {req.ProcessedBy}";

                await _botClient.EditMessageCaption(
                    req.AdminChatId.Value,
                    req.AdminTelegramMessageId.Value,
                    caption,
                    parseMode: ParseMode.Html,
                    replyMarkup: null
                );
            }
            catch { }
        }

        return req;
    }

    public async Task<UserSubscription> GrantSubscriptionAsync(
        long userId, 
        string planId, 
        int durationDays, 
        string? notes, 
        string? processedBy)
    {
        var plans = await GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == planId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == planId);

        if (plan == null) throw new ArgumentException("Tarif topilmadi");

        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == userId && s.Status == "Active")
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        DateTime start = DateTime.UtcNow;
        DateTime end;

        var grantEquivalentValue = Math.Round((plan.MonthlyPrice / 30m) * (durationDays > 0 ? durationDays : 30), 0);
        user.Balance = grantEquivalentValue;

        if (activeSub != null && activeSub.EndDate > DateTime.UtcNow && activeSub.PlanId == plan.PlanId)
        {
            end = activeSub.EndDate.AddDays(durationDays > 0 ? durationDays : 30);
            activeSub.EndDate = end;
            activeSub.InitialBalance += grantEquivalentValue;
            activeSub.IsActive = true;
            activeSub.LastActivatedAt = DateTime.UtcNow;
        }
        else
        {
            if (activeSub != null && activeSub.EndDate > DateTime.UtcNow)
            {
                activeSub.Status = "Switched";
                activeSub.IsActive = false;
                activeSub.FinishedDate = DateTime.UtcNow;
            }

            end = DateTime.UtcNow.AddDays(durationDays > 0 ? durationDays : 30);
            activeSub = new UserSubscription
            {
                UserId = user.Id,
                PlanId = plan.PlanId,
                PlanName = plan.Name,
                TargetRole = plan.TargetRole,
                MaxGroups = plan.MaxGroups,
                Price = plan.MonthlyPrice,
                IsTrial = false,
                StartDate = start,
                EndDate = end,
                InitialBalance = grantEquivalentValue,
                IsActive = true,
                Status = "Active",
                LastActivatedAt = DateTime.UtcNow,
                Notes = notes ?? "Admin tomonidan to'g'ridan-to'g'ri berildi"
            };
            _context.UserSubscriptions.Add(activeSub);
        }

        if (plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        var log = new SubscriptionLog
        {
            UserId = user.Id,
            PlanId = plan.PlanId,
            PlanName = plan.Name,
            ActionType = "AdminManualGrant",
            AmountPaid = 0,
            DurationHours = (durationDays > 0 ? durationDays : 30) * 24,
            PeriodStart = start,
            PeriodEnd = end,
            Notes = $"Admin ({processedBy ?? "Admin"}) tomonidan berildi. Izoh: {notes}"
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        if (long.TryParse(user.TelegramId, out var userChatId))
        {
            var msg = $"🎁 <b>Sizga {plan.Name} obunasi taqdim etildi!</b>\n\n" +
                      $"⏳ <b>Muddat:</b> {durationDays} kun\n" +
                      $"📅 <b>Amal qilish muddati:</b> <b>{end.AddHours(5):yyyy-MM-dd HH:mm}</b> gacha\n\n" +
                      $"Lanswitch xizmatlaridan to'liq foydalanishingiz mumkin! 🚀";
            try
            {
                await _botClient.SendMessage(userChatId, msg, parseMode: ParseMode.Html);
            }
            catch { }
        }

        return activeSub;
    }

    public async Task<object> GetLogsAndStatsAsync()
    {
        var logs = await _context.SubscriptionLogs
            .Include(l => l.User)
            .OrderByDescending(l => l.Id)
            .Take(200)
            .Select(l => new
            {
                l.Id,
                l.UserId,
                UserFullName = l.User != null ? l.User.FullName : "Noma'lum",
                UserTelegramId = l.User != null ? l.User.TelegramId : "",
                UserUsername = l.User != null ? l.User.Username : "",
                l.PlanId,
                l.PlanName,
                l.ActionType,
                l.AmountPaid,
                l.DurationHours,
                l.PeriodStart,
                l.PeriodEnd,
                l.PreviousPlanId,
                l.Notes,
                l.CreatedAt
            })
            .ToListAsync();

        // Har bir tarif bo'yicha jami foydalanilgan vaqt va tushum
        var allLogs = await _context.SubscriptionLogs.ToListAsync();
        var planStats = allLogs
            .GroupBy(l => l.PlanId)
            .Select(g =>
            {
                var totalHours = g.Sum(l => l.DurationHours);
                var totalPaid = g.Sum(l => l.AmountPaid);
                int totalMinutes = (int)Math.Round(totalHours * 60m);
                int days = totalMinutes / (24 * 60);
                int remMins = totalMinutes % (24 * 60);
                int hours = remMins / 60;
                int mins = remMins % 60;

                return new
                {
                    PlanId = g.Key,
                    PlanName = g.FirstOrDefault()?.PlanName ?? g.Key,
                    Count = g.Count(),
                    TotalPaid = totalPaid,
                    TotalHours = Math.Round(totalHours, 1),
                    TotalDays = days,
                    FormattedTotalDuration = $"{days} kun {hours} soat {mins} minut"
                };
            })
            .ToList();

        var totalRevenue = allLogs.Sum(l => l.AmountPaid);

        return new
        {
            totalRevenue,
            totalSubscriptionsCount = allLogs.Count,
            planStats,
            recentLogs = logs
        };
    }

    public async Task<object> GetUserBalanceAndSubscriptionAsync(long userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        var now = DateTime.UtcNow;

        var subs = await _context.UserSubscriptions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Id)
            .ToListAsync();

        var activeSub = subs.FirstOrDefault(s => (s.Status == "Active" || s.IsActive) && s.EndDate >= now);

        // Muddati o'tib ketgan faol obunani aniqlash va balansni 0 qilish
        var potentiallyExpired = subs.FirstOrDefault(s => (s.Status == "Active" || s.IsActive) && s.EndDate < now);
        if (potentiallyExpired != null)
        {
            potentiallyExpired.IsActive = false;
            potentiallyExpired.Status = "Expired";
            potentiallyExpired.FinishedDate = potentiallyExpired.EndDate;
            potentiallyExpired.DeductedAmount += potentiallyExpired.InitialBalance > 0 ? potentiallyExpired.InitialBalance : user.Balance;
            user.Balance = 0;
            await _context.SaveChangesAsync();
        }

        var usedStudentTrial = subs.Any(s => s.TargetRole == "Student" && s.IsTrial);
        var usedTeacherTrial = subs.Any(s => s.TargetRole == "Teacher" && s.IsTrial);

        decimal currentLiveBalance = user.Balance;
        double remainingSeconds = 0;
        decimal hourlyRate = 0;
        decimal perSecondRate = 0;

        if (activeSub != null)
        {
            var monthlyPrice = activeSub.Price > 0 ? activeSub.Price : 50000m;
            hourlyRate = Math.Round(monthlyPrice / 720m, 2);
            perSecondRate = monthlyPrice / (30m * 24m * 3600m);

            var elapsedSecs = Math.Max(0, (now - activeSub.StartDate).TotalSeconds);
            var spentSoFar = Math.Round((decimal)elapsedSecs * perSecondRate);
            spentSoFar = Math.Min(user.Balance, spentSoFar);

            currentLiveBalance = Math.Max(0, user.Balance - spentSoFar);
            remainingSeconds = Math.Max(0, (activeSub.EndDate - now).TotalSeconds);
        }

        int daysLeft = (int)(remainingSeconds / 86400);
        int hoursLeft = (int)((remainingSeconds % 86400) / 3600);
        int minsLeft = (int)((remainingSeconds % 3600) / 60);
        int secsLeft = (int)(remainingSeconds % 60);

        var cardSetting = await GetCardSettingsAsync();
        decimal bonusAmount = cardSetting.InitialBonusAmount > 0 ? cardSetting.InitialBonusAmount : 25000m;
        decimal minAmount = cardSetting.MinAmount > 0 ? cardSetting.MinAmount : 15000m;

        var hasPriorSubscription = subs.Any();
        bool canClaimBonus = !user.HasReceivedInitialBonus && !hasPriorSubscription;

        return new
        {
            user = new
            {
                id = user.Id,
                fullName = user.FullName,
                username = user.Username,
                role = user.Role,
                balance = user.Balance,
                liveBalance = currentLiveBalance,
                hasReceivedInitialBonus = user.HasReceivedInitialBonus,
                canClaimBonus = canClaimBonus
            },
            hasActiveSubscription = activeSub != null,
            hasPriorSubscription = hasPriorSubscription,
            canClaimBonus = canClaimBonus,
            hasReceivedInitialBonus = user.HasReceivedInitialBonus,
            bonusAmount = bonusAmount,
            minAmount = minAmount,
            subscription = activeSub == null ? null : new
            {
                id = activeSub.Id,
                planId = activeSub.PlanId,
                planName = activeSub.PlanName,
                targetRole = activeSub.TargetRole,
                maxGroups = activeSub.MaxGroups,
                price = activeSub.Price,
                hourlyRate,
                perSecondRate,
                isTrial = activeSub.IsTrial,
                isActive = activeSub.IsActive,
                status = activeSub.Status,
                startDate = activeSub.StartDate,
                endDate = activeSub.EndDate,
                calculatedEndDate = activeSub.EndDate,
                initialBalance = activeSub.InitialBalance,
                currentLiveBalance,
                remainingSeconds = Math.Round(remainingSeconds, 0),
                formattedRemainingTime = $"{daysLeft} kun {hoursLeft} soat {minsLeft} minut {secsLeft} sekund",
                daysLeft,
                hoursLeft,
                minsLeft,
                secsLeft,
                lastActivatedAt = activeSub.LastActivatedAt,
                notes = activeSub.Notes
            },
            usedStudentTrial,
            usedTeacherTrial
        };
    }

    public async Task<UserSubscription> SwitchPlanAsync(long userId, string targetPlanId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        var plans = await GetPlansAsync();
        var targetPlan = plans.FirstOrDefault(p => p.PlanId == targetPlanId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == targetPlanId);
        if (targetPlan == null) throw new ArgumentException("Tanlangan tarif topilmadi");

        var now = DateTime.UtcNow;

        // 1. Qaraladi barcha active=True obyektlar
        var activeSubs = await _context.UserSubscriptions
            .Where(s => s.UserId == userId && (s.Status == "Active" || s.IsActive))
            .ToListAsync();

        foreach (var sub in activeSubs)
        {
            var oldMonthlyPrice = sub.Price > 0 ? sub.Price : 50000m;
            var oldPerSecRate = oldMonthlyPrice / (30m * 24m * 3600m);

            DateTime finishedDate;
            decimal spentAmount;

            // agar calculated active date dan o'tib ketilgan bo'lsa finished_date sifatida calculated olinadi
            if (now >= sub.EndDate)
            {
                finishedDate = sub.EndDate;
                spentAmount = sub.InitialBalance > 0 ? sub.InitialBalance : user.Balance;
                user.Balance = 0; // to'liq tugagan
            }
            else
            {
                finishedDate = now;
                var elapsedSecs = Math.Max(0, (now - sub.StartDate).TotalSeconds);
                spentAmount = Math.Round((decimal)elapsedSecs * oldPerSecRate);
                spentAmount = Math.Min(user.Balance, spentAmount);
                user.Balance = Math.Max(0, user.Balance - spentAmount);
            }

            sub.FinishedDate = finishedDate;
            sub.DeductedAmount += spentAmount;
            sub.IsActive = false;
            sub.Status = now >= sub.EndDate ? "Expired" : "Switched";
            sub.Notes = $"Tarif almashtirildi. Sarflangan: {spentAmount:N0} so'm. Yakunlangan: {finishedDate:yyyy-MM-dd HH:mm:ss}";
        }

        // 2. Yangi tarifga o'tkazilganda yana bitta object yaratiladi
        if (user.Balance <= 0)
        {
            throw new InvalidOperationException("Balansingizda yetarli mablag' mavjud emas (0 so'm). Iltimos, yangi tarifni yoqish uchun avval hisobingizni to'ldiring!");
        }

        var targetMonthlyPrice = targetPlan.MonthlyPrice > 0 ? targetPlan.MonthlyPrice : 50000m;
        var targetPerSecRate = targetMonthlyPrice / (30m * 24m * 3600m);
        var remainingSeconds = (double)(user.Balance / targetPerSecRate);
        var calculatedEndDate = now.AddSeconds(remainingSeconds);

        var newSub = new UserSubscription
        {
            UserId = user.Id,
            PlanId = targetPlan.PlanId,
            PlanName = targetPlan.Name,
            TargetRole = targetPlan.TargetRole,
            MaxGroups = targetPlan.MaxGroups,
            Price = targetMonthlyPrice,
            IsTrial = false,
            StartDate = now,
            EndDate = calculatedEndDate,
            InitialBalance = user.Balance,
            DeductedAmount = 0,
            IsActive = true,
            Status = "Active",
            LastActivatedAt = now,
            Notes = $"Yangi tarifga o'tildi. Balans: {user.Balance:N0} so'm. Hisoblangan muddat: {calculatedEndDate:yyyy-MM-dd HH:mm} gacha."
        };

        if (targetPlan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        _context.UserSubscriptions.Add(newSub);

        var log = new SubscriptionLog
        {
            UserId = user.Id,
            PlanId = targetPlan.PlanId,
            PlanName = targetPlan.Name,
            ActionType = "TariffSwitched",
            AmountPaid = 0,
            DurationHours = (decimal)(remainingSeconds / 3600.0),
            PeriodStart = now,
            PeriodEnd = calculatedEndDate,
            Notes = $"Tarif almashtirildi -> {targetPlan.Name}. Balans: {user.Balance:N0} so'm ({Math.Round(remainingSeconds / 3600.0, 1)} soat)."
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        // Telegram bot orqali obuna faollashganligi haqida xabar yuborish
        if (long.TryParse(user.TelegramId, out var userChatId))
        {
            try
            {
                var diff = calculatedEndDate - now;
                string remFormatted = diff.TotalDays >= 1 
                    ? $"{(int)diff.TotalDays} kun {(int)diff.Hours} soat" 
                    : $"{(int)diff.TotalHours} soat {(int)diff.Minutes} daqiqa";

                string host = "lanswitch.developerlogic.uz";
                var studentUrl = $"https://{host}/student?user_id={user.Id}&telegram_id={user.TelegramId}";
                var teacherUrl = $"https://{host}/teacher?user_id={user.Id}&telegram_id={user.TelegramId}";

                var groupCount = await _context.GroupMembers
                    .CountAsync(gm => gm.StudentId == user.Id && gm.IsActive);

                string notifyText;
                InlineKeyboardMarkup notifyKb;

                if (targetPlan.TargetRole == "Teacher" || targetPlan.PlanId.Contains("teacher"))
                {
                    notifyText = $"🎉 <b>Tabriklaymiz! O'qituvchi obunangiz ({targetPlan.Name}) muvaffaqiyatli faollashtirildi!</b>\n\n" +
                                 $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                                 $"⏳ <b>Amal qilish muddati:</b> ~{remFormatted}\n\n" +
                                 $"Guruhlarni ulash, topshiriqlar berish va avtomatik nazorat vositalari siz uchun to'liq faol! 🚀";
                    notifyKb = new InlineKeyboardMarkup(new[]
                    {
                        new[] { InlineKeyboardButton.WithWebApp("👨‍🏫 O'qituvchi Paneli", new Telegram.Bot.Types.WebAppInfo { Url = teacherUrl }) }
                    });
                }
                else
                {
                    if (groupCount == 0)
                    {
                        notifyText = $"🎉 <b>Tabriklaymiz! Student Premium obunangiz faollashtirildi!</b>\n\n" +
                                     $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                                     $"⏳ <b>Amal qilish muddati:</b> ~{remFormatted} <i>(real-time sarflanadi)</i>\n\n" +
                                     $"🎯 <b>Siz mustaqil ta'lim rejimidasiz:</b>\n" +
                                     $"Hozircha guruhga a'zo emassiz, shuning uchun asosiy e'tiboringizni mustaqil o'rganishga qaratishingiz mumkin:\n\n" +
                                     $"🎬 <b>Kinolar va Seriallar:</b> Barcha filmlarni interaktiv subtitrlar va AI Ustoz bilan tomosha qiling\n" +
                                     $"📖 <b>Lug'at va So'z yodlash:</b> Darslik so'zlarini audio talaffuz bilan yodlang\n\n" +
                                     $"✨ <i>(Kelajakda: insho/esseni rasmga olib AI orqali tekshirtirish imkoni ham qo'shiladi! 🚀)</i>\n\n" +
                                     $"💡 <i>Ustozingiz sizni dars guruhiga qo'shishi bilanoq topshiriqlar ham bu yerda avtomatik ko'rinadi.</i>";
                        notifyKb = new InlineKeyboardMarkup(new[]
                        {
                            new[] { InlineKeyboardButton.WithWebApp("🎬 Kinolarni ko'rish", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentUrl}&tab=movies" }) },
                            new[] { InlineKeyboardButton.WithWebApp("📖 Lug'at yodlash", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentUrl}&tab=vocabulary" }) }
                        });
                    }
                    else
                    {
                        notifyText = $"🎉 <b>Tabriklaymiz! Student Premium obunangiz faollashtirildi!</b>\n\n" +
                                     $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n" +
                                     $"⏳ <b>Amal qilish muddati:</b> ~{remFormatted} <i>(real-time sarflanadi)</i>\n" +
                                     $"🏫 <b>Guruhlaringiz:</b> {groupCount} ta faol dars guruhi\n\n" +
                                     $"Barcha topshiriqlar, darslar, kinolar va lug'at siz uchun to'liq ochiq! 🚀\n\n" +
                                     $"✨ <i>(Kelajakda: insho/esseni rasmga olib AI tahlil qilish imkoni ham qo'shiladi!)</i>";
                        notifyKb = new InlineKeyboardMarkup(new[]
                        {
                            new[] { InlineKeyboardButton.WithWebApp("📝 Topshiriqlarni ko'rish", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentUrl}&tab=homework" }) },
                            new[] { InlineKeyboardButton.WithWebApp("🎬 Kinolar", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentUrl}&tab=movies" }) }
                        });
                    }
                }

                await _botClient.SendMessage(userChatId, notifyText, parseMode: ParseMode.Html, replyMarkup: notifyKb);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending subscription notification to {user.TelegramId}: {ex.Message}");
            }
        }

        return newSub;
    }

    public async Task<bool> SendTopUpInstructionsToBotAsync(long userId, string? planId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null || !long.TryParse(user.TelegramId, out var userChatId))
        {
            return false;
        }

        var cardSetting = await GetCardSettingsAsync();
        var plans = await GetPlansAsync();
        var selectedPlan = plans.FirstOrDefault(p => p.PlanId == planId);
        string planNotice = selectedPlan != null ? $"\n📦 <b>Tanlangan tarif:</b> {selectedPlan.Name} ({selectedPlan.MonthlyPrice:N0} so'm/oy)" : "";

        var text = $"💳 <b>Lanswitch Hisob Balansini To'ldirish</b>\n{planNotice}\n\n" +
                   $"Quyidagi rasmiy kartaga to'lov o'tkazing:\n" +
                   $"🏦 <b>Bank:</b> {cardSetting.BankName}\n" +
                   $"💳 <b>Karta:</b> <code>{cardSetting.CardNumber}</code>\n" +
                   $"👤 <b>Egasi:</b> {cardSetting.CardHolder}\n\n" +
                   $"💰 <b>To'lov summasi:</b>\n" +
                   $"Qancha pul o'tkazishni o'zingiz belgilaysiz (minimum {cardSetting.MinAmount:N0} so'm). Tarif rejangizga mos ravishda muddat sekundlarigacha hisoblab qo'shiladi.\n\n" +
                   $"📸 <b>Keyingi qadam:</b>\n" +
                   $"To'lovni amalga oshirgach, to'lov cheki (kvitansiya yoki screenshot)ni ushbu botga rasm sifatida yuboring!\n\n" +
                   $"⏳ Admin tasdiqlashi bilan to'lov balansingizga qo'shiladi va WebApp'da real vaqtda sarflanib boradi.";

        try
        {
            await _botClient.SendMessage(userChatId, text, parseMode: ParseMode.Html);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending topup instructions to user {userId}: {ex.Message}");
            return false;
        }
    }

    public async Task<object> ClaimInitialBonusAsync(long userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        if (user.HasReceivedInitialBonus)
        {
            throw new InvalidOperationException("Siz allaqachon boshlang'ich bonusni qabul qilgansiz.");
        }

        var hasPriorSubscription = await _context.UserSubscriptions.AnyAsync(s => s.UserId == userId);
        if (hasPriorSubscription)
        {
            throw new InvalidOperationException("Boshlang'ich bonus faqat avval hech qachon obuna faollashtirmagan yangi foydalanuvchilar uchun amal qiladi.");
        }

        var cardSetting = await GetCardSettingsAsync();
        decimal bonusAmount = cardSetting.InitialBonusAmount > 0 ? cardSetting.InitialBonusAmount : 25000m;

        user.Balance += bonusAmount;
        user.HasReceivedInitialBonus = true;

        var payment = new SubscriptionPaymentRequest
        {
            UserId = user.Id,
            PlanId = "initial_bonus",
            PlanName = "Boshlang'ich Bonus",
            Amount = bonusAmount,
            ApprovedAmount = bonusAmount,
            ReceiptImageUrl = "system://initial_bonus",
            Status = "Approved",
            AdminNotes = $"{bonusAmount:N0} so'm yangi foydalanuvchi bonusi",
            CreatedAt = DateTime.UtcNow,
            ProcessedAt = DateTime.UtcNow,
            ProcessedBy = "System"
        };
        _context.SubscriptionPaymentRequests.Add(payment);

        await _context.SaveChangesAsync();

        if (long.TryParse(user.TelegramId, out var userChatId))
        {
            try
            {
                string host = "lanswitch.developerlogic.uz";
                var studentUrl = $"https://{host}/student?user_id={user.Id}&telegram_id={user.TelegramId}";
                var text = $"🎁 <b>{bonusAmount:N0} so'm Boshlang'ich Bonus balansingizga muvaffaqiyatli qo'shildi!</b>\n\n" +
                           $"💰 <b>Hisob balansingiz:</b> {user.Balance:N0} so'm\n\n" +
                           $"Siz ushbu bonus bilan Student Premium yoki O'qituvchi tariflarini bepul sinab ko'rishingiz mumkin!\n\n" +
                           $"👇 <i>Ilovaga kirib, istalgan tarifni tanlang va boshlang:</i>";
                var kb = new InlineKeyboardMarkup(new[]
                {
                    new[] { InlineKeyboardButton.WithWebApp("🚀 Tarifni tanlash va boshlash", new Telegram.Bot.Types.WebAppInfo { Url = $"{studentUrl}&open_plans=1" }) }
                });
                await _botClient.SendMessage(userChatId, text, parseMode: ParseMode.Html, replyMarkup: kb);
            }
            catch { }
        }

        return new
        {
            message = $"Tabriklaymiz! {bonusAmount:N0} so'm boshlang'ich bonus balansingizga muvaffaqiyatli qo'shildi!",
            balance = user.Balance,
            liveBalance = user.Balance,
            bonusAmount = bonusAmount,
            hasReceivedInitialBonus = true,
            canClaimBonus = false
        };
    }
}
