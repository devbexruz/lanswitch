using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubscriptionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ISubscriptionService _subscriptionService;
    private readonly IWebHostEnvironment _env;

    public SubscriptionController(
        AppDbContext context,
        ISubscriptionService subscriptionService,
        IWebHostEnvironment env)
    {
        _context = context;
        _subscriptionService = subscriptionService;
        _env = env;
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("id")?.Value
                    ?? User.FindFirst("sub")?.Value;
        if (long.TryParse(claim, out var id)) return id;
        return null;
    }

    private bool IsUserAdmin()
    {
        return User.IsInRole("Admin") || User.HasClaim(ClaimTypes.Role, "Admin") || User.HasClaim("role", "Admin");
    }

    // ==================== PUBLIC & USER ENDPOINTS ====================

    [AllowAnonymous]
    [HttpGet("plans")]
    public async Task<IActionResult> GetPlans()
    {
        var plans = await _subscriptionService.GetPlansAsync();
        return Ok(plans);
    }

    [AllowAnonymous]
    [HttpGet("card-settings")]
    public async Task<IActionResult> GetCardSettings()
    {
        var settings = await _subscriptionService.GetCardSettingsAsync();
        return Ok(settings);
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> GetMySubscription()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var res = await _subscriptionService.GetUserBalanceAndSubscriptionAsync(userId.Value);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record SwitchPlanRequest(string TargetPlanId);

    [Authorize]
    [HttpPost("switch-plan")]
    public async Task<IActionResult> SwitchPlan([FromBody] SwitchPlanRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var newSub = await _subscriptionService.SwitchPlanAsync(userId.Value, request.TargetPlanId);
            return Ok(new
            {
                message = $"{newSub.PlanName} tarifiga muvaffaqiyatli o'tildi!",
                subscription = newSub
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record CalculateSwitchRequest(string TargetPlanId, decimal AdditionalAmount = 0);

    [Authorize]
    [HttpPost("calculate-switch")]
    public async Task<IActionResult> CalculateSwitch([FromBody] CalculateSwitchRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var res = await _subscriptionService.CalculateSwitchAsync(userId.Value, request.TargetPlanId, request.AdditionalAmount);
            return Ok(res);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record StartTrialRequest(string PlanId);

    [Authorize]
    [HttpPost("start-trial")]
    public async Task<IActionResult> StartTrial([FromBody] StartTrialRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var plans = await _subscriptionService.GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == request.PlanId);
        if (plan == null) return BadRequest("Bunday tarif mavjud emas");
        if (!plan.HasTrial) return BadRequest("Ushbu tarif uchun sinov muddati mavjud emas");

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return NotFound("Foydalanuvchi topilmadi");

        var alreadyUsed = await _context.UserSubscriptions.AnyAsync(s =>
            s.UserId == userId.Value && s.TargetRole == plan.TargetRole && s.IsTrial);

        if (alreadyUsed)
        {
            return BadRequest($"Siz {plan.TargetRole} tariflari uchun 14 kunlik bepul sinov muddatidan avval foydalangansiz.");
        }

        var trialDays = plan.TrialDays > 0 ? plan.TrialDays : 14;
        var start = DateTime.UtcNow;
        var end = start.AddDays(trialDays);

        var subscription = new UserSubscription
        {
            UserId = user.Id,
            PlanId = plan.PlanId,
            PlanName = plan.Name,
            TargetRole = plan.TargetRole,
            MaxGroups = plan.MaxGroups,
            Price = plan.MonthlyPrice,
            IsTrial = true,
            StartDate = start,
            EndDate = end,
            LastActivatedAt = start,
            Status = "Active",
            Notes = $"{trialDays} kunlik bepul sinov muddati"
        };

        if (plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        _context.UserSubscriptions.Add(subscription);

        var log = new SubscriptionLog
        {
            UserId = user.Id,
            PlanId = plan.PlanId,
            PlanName = plan.Name,
            ActionType = "TrialActivated",
            AmountPaid = 0,
            DurationHours = trialDays * 24,
            PeriodStart = start,
            PeriodEnd = end,
            Notes = $"{trialDays} kunlik bepul sinov"
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"{plan.Name} tarifi uchun {trialDays} kunlik bepul sinov muddati faollashtirildi! 🎉",
            subscription
        });
    }

    [Authorize]
    [HttpPost("submit-receipt")]
    public async Task<IActionResult> SubmitReceipt([FromForm] IFormFile? receipt, [FromForm] string planId, [FromForm] decimal amount)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        if (receipt == null || receipt.Length == 0)
        {
            return BadRequest(new { message = "Iltimos, to'lov cheki screenshotini yuklang!" });
        }

        if (amount < 15000)
        {
            return BadRequest(new { message = "Minimal to'lov summasi 15 000 so'm!" });
        }

        // Faylni saqlash
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var receiptsDir = Path.Combine(webRoot, "uploads", "receipts");
        if (!Directory.Exists(receiptsDir))
        {
            Directory.CreateDirectory(receiptsDir);
        }

        var ext = Path.GetExtension(receipt.FileName);
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var fileName = $"receipt_{userId}_{DateTime.UtcNow.Ticks}{ext}";
        var filePath = Path.Combine(receiptsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await receipt.CopyToAsync(stream);
        }

        var receiptUrl = $"/uploads/receipts/{fileName}";

        try
        {
            var req = await _subscriptionService.SubmitReceiptAsync(userId.Value, planId, amount, receiptUrl);
            return Ok(new
            {
                message = "To'lov cheki qabul qilindi va tekshirish uchun yuborildi! Tez orada adminga yetib boradi va tasdiqlangach botdan xabar olasiz.",
                request = req
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record RequestTopUpRequest(string? PlanId);

    [Authorize]
    [HttpPost("request-topup")]
    public async Task<IActionResult> RequestTopUp([FromBody] RequestTopUpRequest? request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var sent = await _subscriptionService.SendTopUpInstructionsToBotAsync(userId.Value, request?.PlanId);
        return Ok(new
        {
            sentToBot = sent,
            message = sent
                ? "Telegram botingizga to'lov ma'lumotlari yuborildi! Bot orqali to'lov qiling va chekni yuboring."
                : "To'lov ma'lumotlarini qabul qilish uchun avval Telegram botimizga /start bosing."
        });
    }

    // ==================== ADMIN ENDPOINTS ====================

    [Authorize]
    [HttpPut("admin/plans/{planId}")]
    public async Task<IActionResult> UpdatePlan(string planId, [FromBody] SubscriptionPlanConfig updated)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var plan = await _subscriptionService.UpdatePlanAsync(planId, updated);
        return Ok(plan);
    }

    [Authorize]
    [HttpPut("admin/card-settings")]
    public async Task<IActionResult> UpdateCardSettings([FromBody] CardPaymentSetting updated)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var settings = await _subscriptionService.UpdateCardSettingsAsync(updated);
        return Ok(settings);
    }

    [Authorize]
    [HttpGet("admin/payment-requests")]
    public async Task<IActionResult> GetPaymentRequestsAdmin()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var list = await _context.SubscriptionPaymentRequests
            .Include(r => r.User)
            .OrderByDescending(r => r.Id)
            .Take(100)
            .Select(r => new
            {
                r.Id,
                r.UserId,
                UserFullName = r.User != null ? r.User.FullName : "Noma'lum",
                UserTelegramId = r.User != null ? r.User.TelegramId : "",
                UserUsername = r.User != null ? r.User.Username : "",
                r.PlanId,
                r.PlanName,
                r.Amount,
                r.ApprovedAmount,
                r.CalculatedDurationHours,
                r.CalculatedDurationMinutes,
                r.ReceiptImageUrl,
                r.Status,
                r.AdminNotes,
                r.ProcessedAt,
                r.ProcessedBy,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    public record ApprovePaymentDto(long RequestId, decimal? CorrectedAmount, string? AdminNotes);

    [Authorize]
    [HttpPost("admin/approve-payment")]
    public async Task<IActionResult> ApprovePayment([FromBody] ApprovePaymentDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        try
        {
            var req = await _subscriptionService.ApprovePaymentRequestAsync(
                dto.RequestId, 
                dto.CorrectedAmount, 
                dto.AdminNotes, 
                user.FullName);

            return Ok(new
            {
                message = $"To'lov muvaffaqiyatli tasdiqlandi! Foydalanuvchiga bot orqali xabar yuborildi.",
                request = req
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record RejectPaymentDto(long RequestId, string? Reason);

    [Authorize]
    [HttpPost("admin/reject-payment")]
    public async Task<IActionResult> RejectPayment([FromBody] RejectPaymentDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        try
        {
            var req = await _subscriptionService.RejectPaymentRequestAsync(
                dto.RequestId, 
                dto.Reason, 
                user.FullName);

            return Ok(new
            {
                message = "To'lov bekor qilindi (rad etildi).",
                request = req
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record AdminGrantDto(long UserId, string PlanId, int DurationDays = 30, string? Notes = null);

    [Authorize]
    [HttpPost("admin/grant")]
    public async Task<IActionResult> GrantSubscriptionAdmin([FromBody] AdminGrantDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        try
        {
            var sub = await _subscriptionService.GrantSubscriptionAsync(
                dto.UserId, 
                dto.PlanId, 
                dto.DurationDays, 
                dto.Notes, 
                user.FullName);

            return Ok(new
            {
                message = $"Obuna {dto.DurationDays} kunga muvaffaqiyatli faollashtirildi!",
                subscription = sub
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ==================== WEB APP VERIFY ENDPOINTS ====================

    [AllowAnonymous]
    [HttpGet("receipt-verify/{id}")]
    public async Task<IActionResult> GetReceiptVerifyDetails(long id, [FromQuery] string? token)
    {
        var req = await _context.SubscriptionPaymentRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (req == null) return NotFound(new { message = "To'lov cheki so'rovi topilmadi" });

        // Check authentication: token OR admin session
        bool isAuthorized = false;
        if (!string.IsNullOrEmpty(token) && req.VerificationToken == token)
        {
            isAuthorized = true;
        }
        else
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null && (user.IsAdmin || IsUserAdmin()))
                {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized)
        {
            return Unauthorized(new { message = "Ushbu chekni ko'rish uchun ruxsat berilmagan yoki havola muddati tugagan" });
        }

        var plans = await _subscriptionService.GetPlansAsync();
        var plan = plans.FirstOrDefault(p => p.PlanId == req.PlanId);

        return Ok(new
        {
            id = req.Id,
            userId = req.UserId,
            userFullName = req.User != null ? req.User.FullName : "Noma'lum",
            userTelegramId = req.User != null ? req.User.TelegramId : "",
            userUsername = req.User != null ? req.User.Username : "",
            planId = req.PlanId,
            planName = req.PlanName,
            amount = req.Amount,
            approvedAmount = req.ApprovedAmount,
            calculatedDurationHours = req.CalculatedDurationHours,
            calculatedDurationMinutes = req.CalculatedDurationMinutes,
            receiptImageUrl = req.ReceiptImageUrl,
            status = req.Status, // "Pending", "Approved", "Rejected"
            adminNotes = req.AdminNotes,
            processedAt = req.ProcessedAt,
            processedBy = req.ProcessedBy,
            createdAt = req.CreatedAt,
            monthlyPrice = plan?.MonthlyPrice ?? 50000m,
            token = req.VerificationToken
        });
    }

    public record WebAppApproveDto(decimal Amount, string? AdminNotes, string? ProcessedBy);

    [AllowAnonymous]
    [HttpPost("receipt-verify/{id}/approve")]
    public async Task<IActionResult> ApproveReceiptViaWebApp(long id, [FromQuery] string? token, [FromBody] WebAppApproveDto dto)
    {
        var req = await _context.SubscriptionPaymentRequests.FindAsync(id);
        if (req == null) return NotFound(new { message = "To'lov so'rovi topilmadi" });

        string adminName = dto.ProcessedBy ?? "Admin";
        bool isAuthorized = false;
        if (!string.IsNullOrEmpty(token) && req.VerificationToken == token)
        {
            isAuthorized = true;
        }
        else
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null && (user.IsAdmin || IsUserAdmin()))
                {
                    isAuthorized = true;
                    adminName = user.FullName;
                }
            }
        }

        if (!isAuthorized)
        {
            return Unauthorized(new { message = "Ushbu amalni bajarish uchun ruxsat berilmagan" });
        }

        try
        {
            var updated = await _subscriptionService.ApprovePaymentRequestAsync(
                id,
                dto.Amount,
                dto.AdminNotes,
                adminName);

            return Ok(new
            {
                message = "To'lov muvaffaqiyatli tasdiqlandi va foydalanuvchi balansiga qo'shildi!",
                request = updated
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public record WebAppRejectDto(string Reason, string? ProcessedBy);

    [AllowAnonymous]
    [HttpPost("receipt-verify/{id}/reject")]
    public async Task<IActionResult> RejectReceiptViaWebApp(long id, [FromQuery] string? token, [FromBody] WebAppRejectDto dto)
    {
        var req = await _context.SubscriptionPaymentRequests.FindAsync(id);
        if (req == null) return NotFound(new { message = "To'lov so'rovi topilmadi" });

        string adminName = dto.ProcessedBy ?? "Admin";
        bool isAuthorized = false;
        if (!string.IsNullOrEmpty(token) && req.VerificationToken == token)
        {
            isAuthorized = true;
        }
        else
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null && (user.IsAdmin || IsUserAdmin()))
                {
                    isAuthorized = true;
                    adminName = user.FullName;
                }
            }
        }

        if (!isAuthorized)
        {
            return Unauthorized(new { message = "Ushbu amalni bajarish uchun ruxsat berilmagan" });
        }

        try
        {
            var updated = await _subscriptionService.RejectPaymentRequestAsync(
                id,
                dto.Reason,
                adminName);

            return Ok(new
            {
                message = "To'lov muvaffaqiyatli rad etildi va foydalanuvchiga xabar yuborildi.",
                request = updated
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("admin/logs")]
    public async Task<IActionResult> GetLogsAndStats()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var stats = await _subscriptionService.GetLogsAndStatsAsync();
        return Ok(stats);
    }

    [Authorize]
    [HttpGet("admin/all")]
    public async Task<IActionResult> GetAllSubscriptionsAdmin()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var list = await _context.UserSubscriptions
            .Include(s => s.User)
            .OrderByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id,
                s.UserId,
                UserFullName = s.User != null ? s.User.FullName : "Noma'lum",
                UserTelegramId = s.User != null ? s.User.TelegramId : "",
                UserUsername = s.User != null ? s.User.Username : "",
                s.PlanId,
                s.PlanName,
                s.TargetRole,
                s.MaxGroups,
                s.Price,
                s.IsTrial,
                s.StartDate,
                s.EndDate,
                s.Status,
                s.LastActivatedAt,
                s.TotalPaidAmount,
                s.Notes,
                IsCurrentlyActive = s.Status == "Active" && s.EndDate >= DateTime.UtcNow
            })
            .ToListAsync();

        return Ok(list);
    }

    [Authorize]
    [HttpPost("admin/cancel/{id}")]
    public async Task<IActionResult> AdminCancelSubscription(long id)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || (!user.IsAdmin && !IsUserAdmin())) return Forbid();

        var sub = await _context.UserSubscriptions.FindAsync(id);
        if (sub == null) return NotFound("Obuna topilmadi");

        sub.Status = "Cancelled";

        var log = new SubscriptionLog
        {
            UserId = sub.UserId,
            PlanId = sub.PlanId,
            PlanName = sub.PlanName,
            ActionType = "Cancelled",
            AmountPaid = 0,
            DurationHours = 0,
            PeriodStart = sub.StartDate,
            PeriodEnd = DateTime.UtcNow,
            Notes = $"Admin ({user.FullName}) tomonidan bekor qilindi"
        };
        _context.SubscriptionLogs.Add(log);

        await _context.SaveChangesAsync();

        return Ok(new { message = "Obuna bekor qilindi" });
    }
}
