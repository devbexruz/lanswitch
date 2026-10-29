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

        // Check if there is already a record for this user and this exact media + episode
        var history = await _context.WatchHistories
            .FirstOrDefaultAsync(w => w.UserId == userId && w.MediaId == request.MediaId && w.EpisodeId == request.EpisodeId);

        if (history == null)
        {
            // Also check if the user had a previous record for this same media (e.g. earlier episode or film)
            var existingMediaRecord = await _context.WatchHistories
                .FirstOrDefaultAsync(w => w.UserId == userId && w.MediaId == request.MediaId);

            if (existingMediaRecord != null)
            {
                // Update the existing record so there's always 1 active entry representing the latest position of this media
                existingMediaRecord.EpisodeId = request.EpisodeId;
                existingMediaRecord.CurrentTimeSeconds = request.CurrentTimeSeconds;
                existingMediaRecord.IsCompleted = request.IsCompleted;
                existingMediaRecord.LastWatchedAt = DateTime.UtcNow;
                history = existingMediaRecord;
            }
            else
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
        }
        else
        {
            history.CurrentTimeSeconds = request.CurrentTimeSeconds;
            history.LastWatchedAt = DateTime.UtcNow;
            if (request.IsCompleted)
            {
                history.IsCompleted = true;
            }
            else if (request.CurrentTimeSeconds < 30)
            {
                history.IsCompleted = false;
            }
        }

        await _context.SaveChangesAsync();

        // TALAB: Har safar 10 tadan buyog'ini yaratishdayoq bazadan o'chirib yuborish
        // Keep strictly only the 10 most recent watch history records per user
        var excessHistories = await _context.WatchHistories
            .Where(w => w.UserId == userId)
            .OrderByDescending(w => w.LastWatchedAt)
            .Skip(10)
            .ToListAsync();

        if (excessHistories.Any())
        {
            _context.WatchHistories.RemoveRange(excessHistories);
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpGet("continue-watching/{userId}")]
    public async Task<IActionResult> GetContinueWatchingWithId(long userId)
    {
        return await FetchContinueWatching(userId);
    }

    [HttpGet("continue-watching")]
    public async Task<IActionResult> GetContinueWatching()
    {
        long userId = 0;
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdString, out var parsedId))
        {
            userId = parsedId;
        }

        if (userId <= 0)
        {
            return Ok(Array.Empty<object>());
        }

        return await FetchContinueWatching(userId);
    }

    private async Task<IActionResult> FetchContinueWatching(long userId)
    {
        var histories = await _context.WatchHistories
            .Include(w => w.Media)
            .Include(w => w.Episode)
            .Where(w => w.UserId == userId && !w.IsCompleted)
            .OrderByDescending(w => w.LastWatchedAt)
            .Take(10)
            .ToListAsync();

        var result = histories.Select(h => {
            int duration = (h.Episode?.DurationalMinutes ?? h.Media?.DurationalMinutes ?? 0) * 60;
            int progress = duration > 0 ? (int)Math.Min(100, Math.Max(0, (h.CurrentTimeSeconds * 100.0) / duration)) : 0;
            return new {
                h.Id,
                h.MediaId,
                h.EpisodeId,
                h.CurrentTimeSeconds,
                h.IsCompleted,
                h.LastWatchedAt,
                DurationSeconds = duration,
                ProgressPercentage = progress,
                Media = h.Media == null ? null : new {
                    h.Media.Id,
                    h.Media.Title,
                    h.Media.ThumbnailUrl,
                    h.Media.IsFilm,
                    h.Media.DurationalMinutes,
                    h.Media.Level,
                    h.Media.LanguageId
                },
                Episode = h.Episode == null ? null : new {
                    h.Episode.Id,
                    h.Episode.Title,
                    h.Episode.EpisodeNumber,
                    h.Episode.DurationalMinutes,
                    h.Episode.ThumbnailUrl
                }
            };
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

    [HttpDelete("media/{mediaId}")]
    public async Task<IActionResult> RemoveMediaFromHistory(long mediaId)
    {
        long userId = 0;
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdString, out var parsedId))
        {
            userId = parsedId;
        }

        var histories = await _context.WatchHistories
            .Where(w => (userId <= 0 || w.UserId == userId) && w.MediaId == mediaId)
            .ToListAsync();

        if (histories.Any())
        {
            _context.WatchHistories.RemoveRange(histories);
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
