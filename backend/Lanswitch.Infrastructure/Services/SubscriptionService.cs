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
            HasTrial = true,
            TrialDays = 14,
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
            HasTrial = true,
            TrialDays = 14,
            Badge = "1-Tarif (14 kun bepul)",
            FeaturesJson = JsonSerializer.Serialize(new[]
            {
                "3 tagacha guruhni to'liq boshqarish",
                "Avtomatik uyga vazifalar berish va baholash",
                "Talabalar hisoboti va jarimalar nazorati",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
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
                "Avtomatik vazifalar va monitoring",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
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
                "Prioritetli texnik qo'llab-quvvatlash",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
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
                Instructions = "Xohlagancha pul o'tkazing, minimum 15,000 so'm. Tarifingizga mos ravishda muddat soat va minutlarigacha hisoblab qo'shiladi."
            };
            _context.CardPaymentSettings.Add(setting);
            await _context.SaveChangesAsync();
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

        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == userId && s.Status == "Active" && s.EndDate > DateTime.UtcNow)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        decimal residualValue = 0;
        double remainingHours = 0;
        string? currentPlanName = null;

        if (activeSub != null)
        {
            currentPlanName = activeSub.PlanName;
            var remainingSeconds = Math.Max(0, (activeSub.EndDate - DateTime.UtcNow).TotalSeconds);
            remainingHours = remainingSeconds / 3600.0;

            var oldPlan = plans.FirstOrDefault(p => p.PlanId == activeSub.PlanId)
                ?? DefaultPlans.FirstOrDefault(p => p.PlanId == activeSub.PlanId);

            var oldMonthlyPrice = oldPlan?.MonthlyPrice ?? (activeSub.Price > 0 ? activeSub.Price : 50000);
            
            // 30 kun = 720 soat
            var oldHourlyRate = oldMonthlyPrice / 720m;
            residualValue = (decimal)remainingHours * oldHourlyRate;
        }

        var totalBudget = residualValue + additionalAmount;
        var targetMonthlyPrice = targetPlan.MonthlyPrice > 0 ? targetPlan.MonthlyPrice : 50000;
        var targetHourlyRate = targetMonthlyPrice / 720m;

        decimal calculatedHours = totalBudget / targetHourlyRate;
        int totalMinutes = (int)Math.Round(calculatedHours * 60m);

        int days = totalMinutes / (24 * 60);
        int remMins = totalMinutes % (24 * 60);
        int hours = remMins / 60;
        int mins = remMins % 60;

        return new
        {
            hasCurrentSubscription = activeSub != null,
            currentPlanName,
            currentRemainingHours = Math.Round(remainingHours, 1),
            residualValue = Math.Round(residualValue, 0),
            additionalAmount,
            totalBudget = Math.Round(totalBudget, 0),
            targetPlanId = targetPlan.PlanId,
            targetPlanName = targetPlan.Name,
            targetMonthlyPrice,
            calculatedDurationHours = Math.Round(calculatedHours, 2),
            calculatedDays = days,
            calculatedHours = hours,
            calculatedMinutes = mins,
            formattedDuration = $"{days} kun {hours} soat {mins} minut"
        };
    }

    public async Task<SubscriptionPaymentRequest> SubmitReceiptAsync(long userId, string planId, decimal amount, string receiptUrl)
    {
        var cardSetting = await GetCardSettingsAsync();
        if (amount < cardSetting.MinAmount)
        {
            throw new InvalidOperationException($"Minimal to'lov miqdori {cardSetting.MinAmount:N0} so'm!");
        }

        var plans = await GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == planId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == planId);

        if (plan == null) throw new ArgumentException("Tarif topilmadi");

        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new ArgumentException("Foydalanuvchi topilmadi");

        // Puliga yarasha vaqt hisoblash
        var hourlyRate = plan.MonthlyPrice / 720m;
        var calculatedHours = amount / hourlyRate;
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
            Status = "Pending"
        };

        _context.SubscriptionPaymentRequests.Add(request);
        await _context.SaveChangesAsync();

        // Adminlarga Telegram orqali xabar yuborish
        int days = totalMinutes / (24 * 60);
        int remMins = totalMinutes % (24 * 60);
        int hours = remMins / 60;
        int mins = remMins % 60;

        var messageText = $"🧾 <b>Yangi to'lov cheki yuborildi!</b> (№{request.Id})\n\n" +
                          $"👤 <b>Foydalanuvchi:</b> {user.FullName}\n" +
                          $"🆔 <b>Telegram ID:</b> <code>{user.TelegramId}</code>\n" +
                          $"📱 <b>Username:</b> @{user.Username ?? "mavjud emas"}\n\n" +
                          $"📦 <b>Tarif:</b> {plan.Name}\n" +
                          $"💰 <b>Kiritilgan summa:</b> <b>{amount:N0} so'm</b>\n" +
                          $"⏳ <b>Hisoblangan vaqt:</b> {days} kun {hours} soat {mins} minut\n" +
                          $"📅 <b>Vaqt:</b> {DateTime.UtcNow.AddHours(5):yyyy-MM-dd HH:mm}\n\n" +
                          $"⚠️ <i>Iltimos, summani chekdagi bilan 1 so'migacha solishtiring!</i>";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("✅ Tasdiqlash", $"pay_approve:{request.Id}"),
                InlineKeyboardButton.WithCallbackData("❌ Soxta / Bekor qilish", $"pay_reject:{request.Id}")
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
        if (req.Status == "Approved") return req; // allaqachon tasdiqlangan

        var plans = await GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == req.PlanId)
            ?? DefaultPlans.FirstOrDefault(p => p.PlanId == req.PlanId);

        if (plan == null) throw new ArgumentException("Tarif topilmadi");

        decimal finalAmount = correctedAmount.HasValue && correctedAmount.Value > 0 
            ? correctedAmount.Value 
            : req.Amount;

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

        // Foydalanuvchi obunasini yangilash
        var activeSub = await _context.UserSubscriptions
            .Where(s => s.UserId == req.UserId && s.Status == "Active")
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        DateTime newStart = DateTime.UtcNow;
        DateTime newEnd;
        string? prevPlanId = null;

        if (activeSub != null && activeSub.EndDate > DateTime.UtcNow)
        {
            prevPlanId = activeSub.PlanId;

            // Agar ayni shu tarif davom ettirilayotgan bo'lsa
            if (activeSub.PlanId == req.PlanId)
            {
                newStart = activeSub.StartDate;
                newEnd = activeSub.EndDate.AddMinutes(totalMinutes);
                activeSub.EndDate = newEnd;
                activeSub.LastActivatedAt = DateTime.UtcNow;
                activeSub.TotalPaidAmount += finalAmount;
            }
            else
            {
                // Boshqa tarifga o'tish (pro-rata konvertatsiya)
                var oldPlan = plans.FirstOrDefault(p => p.PlanId == activeSub.PlanId)
                    ?? DefaultPlans.FirstOrDefault(p => p.PlanId == activeSub.PlanId);
                var oldPrice = oldPlan?.MonthlyPrice ?? activeSub.Price;
                var oldHourly = oldPrice / 720m;
                var remainingSecs = (activeSub.EndDate - DateTime.UtcNow).TotalSeconds;
                var residualVal = (decimal)(remainingSecs / 3600.0) * oldHourly;

                var totalCred = residualVal + finalAmount;
                var combinedMinutes = (int)Math.Round((totalCred / hourlyRate) * 60m);

                // Eskisini yakunlaymiz
                activeSub.Status = "Switched";

                // Yangi obuna
                newEnd = DateTime.UtcNow.AddMinutes(combinedMinutes);
                activeSub = new UserSubscription
                {
                    UserId = req.UserId,
                    PlanId = plan.PlanId,
                    PlanName = plan.Name,
                    TargetRole = plan.TargetRole,
                    MaxGroups = plan.MaxGroups,
                    Price = plan.MonthlyPrice,
                    IsTrial = false,
                    StartDate = DateTime.UtcNow,
                    EndDate = newEnd,
                    Status = "Active",
                    LastActivatedAt = DateTime.UtcNow,
                    TotalPaidAmount = finalAmount,
                    Notes = $"Tarif o'zgartirildi ({prevPlanId} -> {plan.PlanId})"
                };
                _context.UserSubscriptions.Add(activeSub);
            }
        }
        else
        {
            // Yangi obuna
            newEnd = DateTime.UtcNow.AddMinutes(totalMinutes);
            activeSub = new UserSubscription
            {
                UserId = req.UserId,
                PlanId = plan.PlanId,
                PlanName = plan.Name,
                TargetRole = plan.TargetRole,
                MaxGroups = plan.MaxGroups,
                Price = plan.MonthlyPrice,
                IsTrial = false,
                StartDate = newStart,
                EndDate = newEnd,
                Status = "Active",
                LastActivatedAt = DateTime.UtcNow,
                TotalPaidAmount = finalAmount,
                Notes = "Karta orqali to'lov tasdiqlandi"
            };
            _context.UserSubscriptions.Add(activeSub);
        }

        // Foydalanuvchi Teacher tarifini olsa va roli Student bo'lsa
        var user = req.User ?? await _context.Users.FindAsync(req.UserId);
        if (user != null && plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        // Log yozish
        var log = new SubscriptionLog
        {
            UserId = req.UserId,
            PlanId = plan.PlanId,
            PlanName = plan.Name,
            ActionType = prevPlanId != null && prevPlanId != plan.PlanId ? "TariffSwitched" : "CardPaymentApproved",
            AmountPaid = finalAmount,
            DurationHours = calculatedHours,
            PeriodStart = newStart,
            PeriodEnd = newEnd,
            PreviousPlanId = prevPlanId,
            PaymentRequestId = req.Id,
            Notes = $"Tasdiqlovchi: {req.ProcessedBy}. Summa: {finalAmount:N0} so'm. Izoh: {adminNotes}"
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        // 1. Foydalanuvchiga Telegram bot orqali xabar
        if (user != null && long.TryParse(user.TelegramId, out var userChatId))
        {
            int d = totalMinutes / (24 * 60);
            int rM = totalMinutes % (24 * 60);
            int h = rM / 60;
            int m = rM % 60;

            var userMsg = $"🎉 <b>To'lovingiz muvaffaqiyatli tasdiqlandi!</b>\n\n" +
                          $"📦 <b>Tarif:</b> {plan.Name}\n" +
                          $"💰 <b>Tasdiqlangan summa:</b> {finalAmount:N0} so'm\n" +
                          $"⏳ <b>Qo'shilgan muddat:</b> {d} kun {h} soat {m} minut\n" +
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
        if (req.Status == "Rejected") return req;

        req.Status = "Rejected";
        req.AdminNotes = reason ?? "Soxta chek yoki to'lov tushmagan";
        req.ProcessedAt = DateTime.UtcNow;
        req.ProcessedBy = processedBy ?? "Admin";

        await _context.SaveChangesAsync();

        var user = req.User ?? await _context.Users.FindAsync(req.UserId);
        if (user != null && long.TryParse(user.TelegramId, out var userChatId))
        {
            var userMsg = $"❌ <b>Afsuski, to'lov chekingiz tasdiqlanmadi.</b>\n\n" +
                          $"📦 <b>Tarif:</b> {req.PlanName}\n" +
                          $"💰 <b>Summa:</b> {req.Amount:N0} so'm\n" +
                          $"❗ <b>Sabab:</b> {req.AdminNotes}\n\n" +
                          $"Agar xatolik yuz bergan deb hisoblasangiz, iltimos admin bilan bog'laning.";

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

        if (activeSub != null && activeSub.EndDate > DateTime.UtcNow && activeSub.PlanId == plan.PlanId)
        {
            end = activeSub.EndDate.AddDays(durationDays > 0 ? durationDays : 30);
            activeSub.EndDate = end;
            activeSub.LastActivatedAt = DateTime.UtcNow;
        }
        else
        {
            if (activeSub != null && activeSub.EndDate > DateTime.UtcNow)
            {
                activeSub.Status = "Switched";
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
}
