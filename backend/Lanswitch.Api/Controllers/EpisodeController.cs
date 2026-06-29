using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/episodes")]
public class EpisodeController : ControllerBase
{
    private readonly AppDbContext _context;

    public EpisodeController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("media/{mediaId}")]
    public async Task<IActionResult> GetByMediaId(long mediaId)
    {
        var episodes = await _context.Episodes
            .Where(e => e.MediaId == mediaId)
            .OrderBy(e => e.EpisodeNumber)
            .Select(e => new {
                e.Id,
                e.Title,
                e.EpisodeNumber,
                e.VideoUrl,
                e.ThumbnailUrl
            })
            .ToListAsync();

        return Ok(episodes);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateForMedia([FromBody] CreateEpisodeRequest request)
    {
        var epCount = await _context.Episodes.CountAsync(e => e.MediaId == request.MediaId);
        
        var episode = new Episode
        {
            MediaId = request.MediaId,
            EpisodeNumber = request.EpisodeNumber ?? (epCount + 1),
            Title = request.Title ?? $"Epizod {request.EpisodeNumber ?? (epCount + 1)}",
            Description = "",
            Level = "A1",
            VideoUrl = "",
            ThumbnailUrl = "https://ui-avatars.com/api/?name=Episode"
        };
        
        _context.Episodes.Add(episode);
        await _context.SaveChangesAsync();
        
        return Ok(new { episode.Id, episode.EpisodeNumber, episode.Title });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteEpisode(long id)
    {
        var ep = await _context.Episodes.FindAsync(id);
        if (ep == null) return NotFound();
        
        _context.Episodes.Remove(ep);
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "Epizod o'chirildi" });
    }
}

public class CreateEpisodeRequest
{
    public long MediaId { get; set; }
    public string? Title { get; set; }
    public int? EpisodeNumber { get; set; }
}
