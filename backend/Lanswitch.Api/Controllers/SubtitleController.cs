using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;

using Lanswitch.Api.Attributes;

namespace Lanswitch.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[ApiKey]
public class SubtitleController : ControllerBase
{
    private readonly IGenericRepository<Subtitle> _subtitleRepository;

    public SubtitleController(IGenericRepository<Subtitle> subtitleRepository)
    {
        _subtitleRepository = subtitleRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetSubtitles([FromQuery] long? mediaId, [FromQuery] long? episodeId)
    {
        var allSubtitles = await _subtitleRepository.GetAllAsync();
        
        IEnumerable<Subtitle> query = allSubtitles;
        
        if (episodeId.HasValue)
        {
            query = query.Where(s => s.EpisodeId == episodeId.Value);
        }
        else if (mediaId.HasValue)
        {
            query = query.Where(s => s.MediaId == mediaId.Value && s.EpisodeId == null);
        }

        return Ok(query.OrderBy(s => s.Index).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> AddSubtitle([FromBody] Subtitle subtitle)
    {
        if (subtitle == null) return BadRequest("Subtitle cannot be null");
        
        await _subtitleRepository.AddAsync(subtitle);
        return Ok(subtitle);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSubtitle(long id)
    {
        var subtitle = await _subtitleRepository.GetByIdAsync(id);
        if (subtitle == null) return NotFound("Subtitle not found");

        _subtitleRepository.Remove(subtitle);
        return Ok("Subtitle deleted successfully");
    }
}
