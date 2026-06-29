using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Linq;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/sessions")]
[Authorize]
public class SessionController : ControllerBase
{
    private readonly AppDbContext _context;

    public SessionController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetMySessions()
    {
        var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !long.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var sessions = await _context.UserSessions
            .Where(s => s.UserId == userId && s.IsActive)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new {
                s.Id,
                s.Device,
                s.Agent,
                s.IpAddress,
                s.CreatedAt,
                s.UpdatedAt,
                s.RefreshTokenExpiryTime
            })
            .ToListAsync();

        return Ok(sessions);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> RevokeSession(long id)
    {
        var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !long.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var session = await _context.UserSessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (session == null)
        {
            return NotFound(new { message = "Seans topilmadi" });
        }

        session.IsActive = false;
        session.UpdatedAt = System.DateTime.UtcNow;
        _context.UserSessions.Update(session);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Seans muvaffaqiyatli o'chirildi" });
    }
}
