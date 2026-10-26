using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITelegramBotClient _botClient;

    public NotificationController(AppDbContext context, ITelegramBotClient botClient)
    {
        _context = context;
        _botClient = botClient;
    }

    private long GetUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(idClaim) && long.TryParse(idClaim, out var id))
            return id;
        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && long.TryParse(headerVal, out var headerId))
            return headerId;
        return 0;
    }

    private async Task<bool> IsAdminUserAsync()
    {
        var userId = GetUserId();
        if (userId <= 0) return false;
        var user = await _context.Users.FindAsync(userId);
        return user?.IsAdmin == true || User.IsInRole("Admin");
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = GetUserId();
        if (userId <= 0) return Unauthorized();

        var notifications = await _context.AppNotifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50) // Limit to recent 50
            .Select(n => new {
                n.Id,
                n.Title,
                n.Message,
                n.Type,
                n.IsRead,
                n.CreatedAt,
                n.Link
            })
            .ToListAsync();
            
        return Ok(notifications);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(long id)
    {
        var userId = GetUserId();
        if (userId <= 0) return Unauthorized();

        var notification = await _context.AppNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            
        if (notification == null)
            return NotFound();

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        if (userId <= 0) return Unauthorized();

        var unreadNotifications = await _context.AppNotifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        if (unreadNotifications.Any())
        {
            foreach (var notif in unreadNotifications)
            {
                notif.IsRead = true;
            }
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    /// <summary>
    /// Eski in-app notification yuborish metodi (orqaga moslik uchun)
    /// </summary>
    [HttpPost("admin/send")]
    public async Task<IActionResult> AdminSendNotification([FromBody] AdminSendNotificationRequest req)
    {
        if (!await IsAdminUserAsync())
            return StatusCode(403, new { message = "Faqat administratorlar xabar yuborishi mumkin!" });

        var notifications = new List<AppNotification>();
        
        if (req.UserId.HasValue && req.UserId > 0)
        {
            notifications.Add(new AppNotification
            {
                UserId = req.UserId.Value,
                Title = req.Title,
                Message = req.Message,
                Type = "admin_message",
                IsRead = false
            });
        }
        else
        {
            var users = await _context.Users.Select(u => u.Id).ToListAsync();
            foreach (var uId in users)
            {
                notifications.Add(new AppNotification
                {
                    UserId = uId,
                    Title = req.Title,
                    Message = req.Message,
                    Type = "admin_message",
                    IsRead = false
                });
            }
        }

        if (notifications.Any())
        {
            _context.AppNotifications.AddRange(notifications);
            await _context.SaveChangesAsync();
        }

        return Ok(new { message = $"Xabar {notifications.Count} ta foydalanuvchiga yuborildi." });
    }

    /// <summary>
    /// Telegram Reklama & Xabarnoma auditoriyasi statistikasi
    /// </summary>
    [HttpGet("admin/broadcast/stats")]
    public async Task<IActionResult> GetBroadcastStats()
    {
        if (!await IsAdminUserAsync())
            return StatusCode(403, new { message = "Faqat administratorlar foydalana oladi" });

        var now = DateTime.UtcNow;
        var totalUsers = await _context.Users.CountAsync();
        var telegramUsers = await _context.Users.CountAsync(u => !string.IsNullOrEmpty(u.TelegramId));
        var students = await _context.Users.CountAsync(u => u.Role == "Student" && !string.IsNullOrEmpty(u.TelegramId));
        var teachers = await _context.Users.CountAsync(u => u.Role == "Teacher" && !string.IsNullOrEmpty(u.TelegramId));

        var premiumUserIds = await _context.UserSubscriptions
            .Where(s => (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync();

        var premiumTelegramUsers = await _context.Users
            .CountAsync(u => premiumUserIds.Contains(u.Id) && !string.IsNullOrEmpty(u.TelegramId));

        var freeTelegramUsers = Math.Max(0, telegramUsers - premiumTelegramUsers);

        return Ok(new
        {
            totalUsers,
            telegramUsers,
            students,
            teachers,
            premiumUsers = premiumTelegramUsers,
            freeUsers = freeTelegramUsers
        });
    }

    /// <summary>
    /// Telegramda xabarni test qilish (Adminning o'ziga xabar yuborib ko'rish)
    /// </summary>
    [HttpPost("admin/broadcast/test")]
    public async Task<IActionResult> TestBroadcast([FromBody] TelegramBroadcastTestRequest req)
    {
        if (!await IsAdminUserAsync())
            return StatusCode(403, new { message = "Faqat administratorlar foydalana oladi" });

        var userId = GetUserId();
        var admin = await _context.Users.FindAsync(userId);
        if (admin == null || string.IsNullOrWhiteSpace(admin.TelegramId) || !long.TryParse(admin.TelegramId, out var adminChatId))
        {
            return BadRequest(new { message = "Sizning hisobingizda Telegram ID ulanmagan! Avval Telegram bot orqali kiring." });
        }

        if (string.IsNullOrWhiteSpace(req.MessageHtml))
        {
            return BadRequest(new { message = "Xabar matni bo'sh bo'lishi mumkin emas!" });
        }

        var keyboard = BuildKeyboard(req.Buttons);

        try
        {
            await SendSingleTelegramMessageAsync(adminChatId, req.MessageHtml, req.PhotoUrl, keyboard);
            return Ok(new { success = true, message = "✅ Test xabari Telegramingizga yuborildi! Formatlashni tekshirib ko'ring." });
        }
        catch (ApiRequestException apiEx)
        {
            return BadRequest(new { 
                success = false, 
                message = $"Telegram formatlash xatosi: {apiEx.Message}. Iltimos, HTML teglari (<b>, <i>, <a> va h.k.) to'g'ri yopilganligini tekshiring!" 
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = $"Xatolik yuz berdi: {ex.Message}" });
        }
    }

    /// <summary>
    /// Barchaga yoki belgilangan auditoriyaga Telegram orqali reklama / xabar tarqatish
    /// </summary>
    [HttpPost("admin/broadcast/send")]
    public async Task<IActionResult> SendBroadcast([FromBody] TelegramBroadcastRequest req)
    {
        if (!await IsAdminUserAsync())
            return StatusCode(403, new { message = "Faqat administratorlar xabar tarqatishi mumkin!" });

        if (string.IsNullOrWhiteSpace(req.MessageHtml))
        {
            return BadRequest(new { message = "Xabar matni bo'sh bo'lishi mumkin emas!" });
        }

        var now = DateTime.UtcNow;
        var query = _context.Users.Where(u => !string.IsNullOrEmpty(u.TelegramId));

        switch (req.Target?.ToLowerInvariant())
        {
            case "students":
                query = query.Where(u => u.Role == "Student");
                break;
            case "teachers":
                query = query.Where(u => u.Role == "Teacher");
                break;
            case "premium":
                var activePremiumIds = await _context.UserSubscriptions
                    .Where(s => (s.Status == "Active" || s.IsActive) && s.EndDate > now)
                    .Select(s => s.UserId)
                    .Distinct()
                    .ToListAsync();
                query = query.Where(u => activePremiumIds.Contains(u.Id));
                break;
            case "free":
                var activeSubUserIds = await _context.UserSubscriptions
                    .Where(s => (s.Status == "Active" || s.IsActive) && s.EndDate > now)
                    .Select(s => s.UserId)
                    .Distinct()
                    .ToListAsync();
                query = query.Where(u => !activeSubUserIds.Contains(u.Id));
                break;
            case "custom":
                if (req.CustomUserIds != null && req.CustomUserIds.Any())
                {
                    query = query.Where(u => req.CustomUserIds.Contains(u.Id));
                }
                break;
            case "all":
            default:
                // All users with telegram ID
                break;
        }

        var targetUsers = await query
            .Select(u => new { u.Id, u.TelegramId, u.FullName })
            .ToListAsync();

        if (!targetUsers.Any())
        {
            return BadRequest(new { message = "Belgilangan auditoriyada foydalanuvchilar topilmadi!" });
        }

        var keyboard = BuildKeyboard(req.Buttons);

        // Pre-validate HTML format by sending to bot itself or checking parsing
        int sentCount = 0;
        int blockedCount = 0;
        int failedCount = 0;

        foreach (var u in targetUsers)
        {
            if (!long.TryParse(u.TelegramId, out var chatId))
            {
                failedCount++;
                continue;
            }

            try
            {
                await SendSingleTelegramMessageAsync(chatId, req.MessageHtml, req.PhotoUrl, keyboard);
                sentCount++;
            }
            catch (ApiRequestException apiEx) when (apiEx.ErrorCode == 403)
            {
                // Bot was blocked by user or user deactivated
                blockedCount++;
            }
            catch (ApiRequestException apiEx)
            {
                failedCount++;
                if (sentCount == 0 && (apiEx.Message.Contains("can't parse entities") || apiEx.Message.Contains("unclosed tag")))
                {
                    return BadRequest(new { 
                        message = $"Telegram xabar formatlashida xatolik: {apiEx.Message}. Iltimos, HTML teglari (<b>, <i>, <a> va h.k.) to'g'ri yopilganligini tekshiring!",
                        error = apiEx.Message
                    });
                }
            }
            catch
            {
                failedCount++;
            }

            // Small delay to protect against Telegram flood control limits
            await Task.Delay(35);
        }

        // If also send in-app notification
        if (req.AlsoSendInApp)
        {
            try
            {
                var cleanTitle = !string.IsNullOrWhiteSpace(req.InAppTitle) 
                    ? req.InAppTitle.Trim() 
                    : "📢 Yangi Xabarnoma";

                // Strip HTML tags for clean in-app preview
                var cleanMessage = System.Text.RegularExpressions.Regex.Replace(req.MessageHtml, "<.*?>", string.Empty);
                if (cleanMessage.Length > 250) cleanMessage = cleanMessage.Substring(0, 247) + "...";

                var inAppNotifs = targetUsers.Select(u => new AppNotification
                {
                    UserId = u.Id,
                    Title = cleanTitle,
                    Message = cleanMessage,
                    Type = "admin_broadcast",
                    IsRead = false
                }).ToList();

                _context.AppNotifications.AddRange(inAppNotifs);
                await _context.SaveChangesAsync();
            }
            catch { }
        }

        return Ok(new
        {
            success = true,
            totalRecipients = targetUsers.Count,
            sentCount,
            blockedCount,
            failedCount,
            message = $"Xabar muvaffaqiyatli tarqatildi: {sentCount} ta yetkazildi, {blockedCount} ta bloklagan, {failedCount} ta xatolik."
        });
    }

    private InlineKeyboardMarkup? BuildKeyboard(List<BroadcastInlineButtonDto>? buttons)
    {
        if (buttons == null || buttons.Count == 0) return null;

        var rows = new List<List<InlineKeyboardButton>>();
        foreach (var b in buttons)
        {
            if (string.IsNullOrWhiteSpace(b.Text) || string.IsNullOrWhiteSpace(b.Url)) continue;
            var text = b.Text.Trim();
            var url = b.Url.Trim();

            if (url.Contains("/tma") || url.Contains("mini-app"))
            {
                rows.Add(new List<InlineKeyboardButton>
                {
                    InlineKeyboardButton.WithWebApp(text, new WebAppInfo { Url = url })
                });
            }
            else
            {
                rows.Add(new List<InlineKeyboardButton>
                {
                    InlineKeyboardButton.WithUrl(text, url)
                });
            }
        }

        return rows.Count > 0 ? new InlineKeyboardMarkup(rows) : null;
    }

    private async Task SendSingleTelegramMessageAsync(long chatId, string textHtml, string? photoUrl, InlineKeyboardMarkup? keyboard)
    {
        if (!string.IsNullOrWhiteSpace(photoUrl) && Uri.TryCreate(photoUrl, UriKind.Absolute, out var photoUri))
        {
            await _botClient.SendPhoto(
                chatId: chatId,
                photo: InputFile.FromUri(photoUri),
                caption: textHtml,
                parseMode: ParseMode.Html,
                replyMarkup: keyboard
            );
        }
        else
        {
            await _botClient.SendMessage(
                chatId: chatId,
                text: textHtml,
                parseMode: ParseMode.Html,
                replyMarkup: keyboard
            );
        }
    }
}

public class AdminSendNotificationRequest
{
    public long? UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
}

public class BroadcastInlineButtonDto
{
    public string Text { get; set; } = null!;
    public string Url { get; set; } = null!;
}

public class TelegramBroadcastTestRequest
{
    public string MessageHtml { get; set; } = null!;
    public string? PhotoUrl { get; set; }
    public List<BroadcastInlineButtonDto>? Buttons { get; set; }
}

public class TelegramBroadcastRequest
{
    public string Target { get; set; } = "all"; // all, students, teachers, premium, free, custom
    public List<long>? CustomUserIds { get; set; }
    public string MessageHtml { get; set; } = null!;
    public string? PhotoUrl { get; set; }
    public List<BroadcastInlineButtonDto>? Buttons { get; set; }
    public bool AlsoSendInApp { get; set; } = true;
    public string? InAppTitle { get; set; }
}
