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

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubscriptionController : ControllerBase
{
    private readonly AppDbContext _context;

    public SubscriptionController(AppDbContext context)
    {
        _context = context;
    }

    public record PlanDto(
        string Id,
        string Name,
        string TargetRole,
        decimal Price,
        string FormattedPrice,
        string Period,
        int MaxGroups,
        bool HasTrial,
        int TrialDays,
        List<string> Features,
        string Badge
    );

    private static readonly List<PlanDto> Plans = new()
    {
        new PlanDto(
            "student_monthly",
            "Student Premium",
            "Student",
            50000,
            "50 000 so'm / oy",
            "1 oy",
            0,
            true,
            14,
            new List<string>
            {
                "Kinolarni cheksiz ko'rish va subtitr tahlili",
                "AI ustoz bilan cheksiz muloqot va grammatik tahlil",
                "Lug'at va darsliklardan to'liq foydalanish",
                "Uyga vazifalarni topshirish va natijalar nazorati"
            },
            "Talabalar uchun"
        ),
        new PlanDto(
            "teacher_standart",
            "Ustoz - Standart",
            "Teacher",
            99000,
            "99 000 so'm / oy",
            "1 oy",
            3,
            true,
            14,
            new List<string>
            {
                "3 tagacha guruhni to'liq boshqarish",
                "Avtomatik uyga vazifalar berish va baholash",
                "Talabalar hisoboti va jarimalar nazorati",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
            },
            "1-Tarif (14 kun bepul)"
        ),
        new PlanDto(
            "teacher_pro",
            "Ustoz - Pro",
            "Teacher",
            189000,
            "189 000 so'm / oy",
            "1 oy",
            10,
            false,
            0,
            new List<string>
            {
                "10 tagacha guruhni to'liq boshqarish",
                "Kengaytirilgan tahlil va guruh statistikasi",
                "Avtomatik vazifalar va monitoring",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
            },
            "2-Tarif (Tavsiya etiladi)"
        ),
        new PlanDto(
            "teacher_max",
            "Ustoz - Max",
            "Teacher",
            249000,
            "249 000 so'm / oy",
            "1 oy",
            20,
            false,
            0,
            new List<string>
            {
                "20 tagacha guruhni to'liq boshqarish",
                "Cheksiz talabalar va to'liq avtomatlashtirish",
                "Prioritetli texnik qo'llab-quvvatlash",
                "Barcha Student Premium imkoniyatlari (kinolar, AI, lug'at)"
            },
            "3-Tarif (Maksimal)"
        )
    };

    [AllowAnonymous]
    [HttpGet("plans")]
    public IActionResult GetPlans()
    {
        return Ok(Plans);
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("id")?.Value
                    ?? User.FindFirst("sub")?.Value;
        if (long.TryParse(claim, out var id)) return id;
        return null;
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> GetMySubscription()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var subs = await _context.UserSubscriptions
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.EndDate)
            .ToListAsync();

        var activeSub = subs.FirstOrDefault(s => s.Status == "Active" && s.EndDate >= DateTime.UtcNow);
        var usedStudentTrial = subs.Any(s => s.TargetRole == "Student" && s.IsTrial);
        var usedTeacherTrial = subs.Any(s => s.TargetRole == "Teacher" && s.IsTrial);

        var daysLeft = activeSub != null ? (int)Math.Max(0, Math.Ceiling((activeSub.EndDate - DateTime.UtcNow).TotalDays)) : 0;

        return Ok(new
        {
            hasActiveSubscription = activeSub != null,
            subscription = activeSub == null ? null : new
            {
                activeSub.Id,
                activeSub.PlanId,
                activeSub.PlanName,
                activeSub.TargetRole,
                activeSub.MaxGroups,
                activeSub.Price,
                activeSub.IsTrial,
                activeSub.StartDate,
                activeSub.EndDate,
                activeSub.Status,
                daysLeft
            },
            usedStudentTrial,
            usedTeacherTrial
        });
    }

    public record StartTrialRequest(string PlanId);

    [Authorize]
    [HttpPost("start-trial")]
    public async Task<IActionResult> StartTrial([FromBody] StartTrialRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var plan = Plans.FirstOrDefault(p => p.Id == request.PlanId);
        if (plan == null) return BadRequest("Bunday tarif mavjud emas");
        if (!plan.HasTrial) return BadRequest("Ushbu tarif uchun sinov muddati mavjud emas");

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return NotFound("Foydalanuvchi topilmadi");

        // Check if user already used trial for this target role
        var alreadyUsed = await _context.UserSubscriptions.AnyAsync(s =>
            s.UserId == userId.Value && s.TargetRole == plan.TargetRole && s.IsTrial);

        if (alreadyUsed)
        {
            return BadRequest($"Siz {plan.TargetRole} tariflari uchun 14 kunlik bepul sinov muddatidan avval foydalangansiz.");
        }

        var subscription = new UserSubscription
        {
            UserId = user.Id,
            PlanId = plan.Id,
            PlanName = plan.Name,
            TargetRole = plan.TargetRole,
            MaxGroups = plan.MaxGroups,
            Price = plan.Price,
            IsTrial = true,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(14),
            Status = "Active",
            Notes = "14 kunlik bepul sinov muddati"
        };

        // If user activated teacher plan and role is Student, upgrade role to Teacher
        if (plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        _context.UserSubscriptions.Add(subscription);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"{plan.Name} tarifi uchun 14 kunlik bepul sinov muddati faollashtirildi! 🎉",
            subscription
        });
    }

    // ==================== ADMIN ENDPOINTS ====================

    [HttpGet("admin/all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllSubscriptionsAdmin()
    {
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
                s.Notes,
                IsCurrentlyActive = s.Status == "Active" && s.EndDate >= DateTime.UtcNow
            })
            .ToListAsync();

        return Ok(list);
    }

    public record AdminGrantRequest(
        long UserId,
        string PlanId,
        int DurationDays = 30,
        bool IsTrial = false,
        string? Notes = null
    );

    [HttpPost("admin/grant")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminGrantSubscription([FromBody] AdminGrantRequest request)
    {
        var plan = Plans.FirstOrDefault(p => p.Id == request.PlanId);
        if (plan == null) return BadRequest("Bunday tarif topilmadi");

        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null) return NotFound("Foydalanuvchi topilmadi");

        var startDate = DateTime.UtcNow;
        var endDate = startDate.AddDays(request.DurationDays > 0 ? request.DurationDays : 30);

        var sub = new UserSubscription
        {
            UserId = user.Id,
            PlanId = plan.Id,
            PlanName = plan.Name,
            TargetRole = plan.TargetRole,
            MaxGroups = plan.MaxGroups,
            Price = plan.Price,
            IsTrial = request.IsTrial,
            StartDate = startDate,
            EndDate = endDate,
            Status = "Active",
            Notes = request.Notes ?? (request.IsTrial ? "Admin tomonidan bepul berildi" : "Admin tomonidan faollashtirildi")
        };

        if (plan.TargetRole == "Teacher" && user.Role == "Student")
        {
            user.Role = "Teacher";
        }

        _context.UserSubscriptions.Add(sub);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"{user.FullName} ga {plan.Name} tarifi {request.DurationDays} kunga faollashtirildi!",
            subscription = sub
        });
    }

    [HttpPost("admin/cancel/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminCancelSubscription(long id)
    {
        var sub = await _context.UserSubscriptions.FindAsync(id);
        if (sub == null) return NotFound("Obuna topilmadi");

        sub.Status = "Cancelled";
        await _context.SaveChangesAsync();

        return Ok(new { message = "Obuna bekor qilindi" });
    }
}
