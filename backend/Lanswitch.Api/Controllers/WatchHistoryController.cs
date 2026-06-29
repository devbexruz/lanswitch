using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Lanswitch.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class WatchHistoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public WatchHistoryController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest request)
    {
        long userId = request.UserId;
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdString, out var parsedId))
        {
            userId = parsedId;
        }

        if (userId <= 0)
        {
            // Unauthenticated guest user, don't save watch history
            return Ok();
        }

        var history = await _context.WatchHistories
            .FirstOrDefaultAsync(w => w.UserId == userId && w.MediaId == request.MediaId && w.EpisodeId == request.EpisodeId);

        if (history == null)
        {
            history = new WatchHistory
            {
                UserId = userId,
                MediaId = request.MediaId,
                EpisodeId = request.EpisodeId,
                CurrentTimeSeconds = request.CurrentTimeSeconds,
                IsCompleted = request.IsCompleted,
                LastWatchedAt = DateTime.UtcNow
            };
            _context.WatchHistories.Add(history);
        }
        else
        {
            history.CurrentTimeSeconds = request.CurrentTimeSeconds;
            history.LastWatchedAt = DateTime.UtcNow;
            if (request.IsCompleted)
            {
                history.IsCompleted = true;
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("continue-watching/{userId}")]
    public async Task<IActionResult> GetContinueWatching(long userId)
    {
        var histories = await _context.WatchHistories
            .Include(w => w.Media)
            .Include(w => w.Episode)
            .Where(w => w.UserId == userId && !w.IsCompleted)
            .OrderByDescending(w => w.LastWatchedAt)
            .Take(10)
            .ToListAsync();

        var result = histories.Select(h => new {
            h.Id,
            h.MediaId,
            h.EpisodeId,
            h.CurrentTimeSeconds,
            h.IsCompleted,
            h.LastWatchedAt,
            Media = new {
                h.Media?.Id,
                h.Media?.Title,
                h.Media?.ThumbnailUrl,
                h.Media?.IsFilm,
                h.Media?.DurationalMinutes
            },
            Episode = h.Episode == null ? null : new {
                h.Episode.Id,
                h.Episode.Title,
                h.Episode.EpisodeNumber,
                h.Episode.DurationalMinutes
            }
        });

        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> RemoveFromHistory(long id)
    {
        var history = await _context.WatchHistories.FindAsync(id);
        if (history != null)
        {
            _context.WatchHistories.Remove(history);
            await _context.SaveChangesAsync();
        }
        return Ok();
    }
}

public class HeartbeatRequest
{
    public long UserId { get; set; }
    public long MediaId { get; set; }
    public long? EpisodeId { get; set; }
    public int CurrentTimeSeconds { get; set; }
    public bool IsCompleted { get; set; }
}
