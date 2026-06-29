using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationController(AppDbContext context)
    {
        _context = context;
    }

    private long GetUserId()
    {
        return long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = GetUserId();
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

    [HttpPost("admin/send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminSendNotification([FromBody] AdminSendNotificationRequest req)
    {
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
}

public class AdminSendNotificationRequest
{
    public long? UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
}
