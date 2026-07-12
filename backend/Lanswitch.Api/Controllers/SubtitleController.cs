using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Lanswitch.Infrastructure.Data;
using Lanswitch.Application.Interfaces;
using Lanswitch.Api.Attributes;

namespace Lanswitch.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SubtitleController : ControllerBase
{
    private readonly IGenericRepository<Subtitle> _subtitleRepository;
    private readonly AppDbContext _context;
    private readonly IGeminiAiService _geminiService;

    public SubtitleController(
        IGenericRepository<Subtitle> subtitleRepository,
        AppDbContext context,
        IGeminiAiService geminiService)
    {
        _subtitleRepository = subtitleRepository;
        _context = context;
        _geminiService = geminiService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSubtitles([FromQuery] long? mediaId, [FromQuery] long? episodeId)
    {
        IQueryable<Subtitle> query = _context.Subtitles
            .Include(s => s.Gaps)
            .Include(s => s.SubtitleWords)
                .ThenInclude(sw => sw.Word)
                    .ThenInclude(w => w!.Translates);
        
        if (episodeId.HasValue)
        {
            query = query.Where(s => s.EpisodeId == episodeId.Value);
        }
        else if (mediaId.HasValue)
        {
            query = query.Where(s => s.MediaId == mediaId.Value && s.EpisodeId == null);
        }

        var result = await query.OrderBy(s => s.Index).ToListAsync();
        
        // Prepare projection to avoid circular references if any (handled by IgnoreCycles but let's be safe)
        var projectedResult = result.Select(s => new {
            s.Id,
            s.MediaId,
            s.EpisodeId,
            s.Index,
            s.StartTime,
            s.EndTime,
            s.Text,
            s.CreatedAt,
            Gaps = s.Gaps.Select(g => new {
                g.Id,
                g.Text,
                g.Index,
                g.AiAnalysis
            }),
            Words = s.SubtitleWords.Select(sw => new {
                sw.Word?.Id,
                sw.Word?.Text,
                sw.Word?.LanguageId,
                Translation = sw.Word?.Translates.FirstOrDefault()?.TranslateText
            })
        });

        return Ok(projectedResult);
    }

    [HttpPost("{id}/analyze")]
    public async Task<IActionResult> AnalyzeSubtitle(long id)
    {
        var subtitle = await _context.Subtitles
            .Include(s => s.Gaps)
            .Include(s => s.SubtitleWords).ThenInclude(sw => sw.Word).ThenInclude(w => w!.Translates)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (subtitle == null) return NotFound("Subtitle not found");

        // If already analyzed, just return it
        if (subtitle.Gaps.Any())
        {
            return Ok(subtitle); // will be serialized via IgnoreCycles
        }

        var analysis = await _geminiService.AnalyzeGrammarAsync(subtitle.Text);

        if (analysis != null && analysis.Any())
        {
            int sentenceIndex = 0;
            foreach (var sentence in analysis)
            {
                if (!string.IsNullOrEmpty(sentence.SentenceText))
                {
                    var gap = new Gap
                    {
                        SubtitleId = subtitle.Id,
                        Text = sentence.SentenceText,
                        AiAnalysis = sentence.AiAnalysis,
                        Index = sentenceIndex++,
                        AiGrammarContextIds = sentence.GrammarContextIds
                    };

                    _context.Gaps.Add(gap);
                }
            }

            await _context.SaveChangesAsync();
        }

        // Fetch again to get updated relationships
        var updatedSubtitle = await _context.Subtitles
            .Include(s => s.Gaps)
            .Include(s => s.SubtitleWords).ThenInclude(sw => sw!.Word).ThenInclude(w => w!.Translates)
            .FirstOrDefaultAsync(s => s.Id == id);

        var projectedResult = new {
            updatedSubtitle!.Id,
            updatedSubtitle.MediaId,
            updatedSubtitle.EpisodeId,
            updatedSubtitle.Index,
            updatedSubtitle.StartTime,
            updatedSubtitle.EndTime,
            updatedSubtitle.Text,
            updatedSubtitle.CreatedAt,
            Gaps = updatedSubtitle.Gaps.Select(g => new {
                g.Id,
                g.Text,
                g.Index,
                g.AiAnalysis
            }),
            Words = updatedSubtitle.SubtitleWords.Select(sw => new {
                sw.Word?.Id,
                sw.Word?.Text,
                sw.Word?.LanguageId,
                Translation = sw.Word?.Translates.FirstOrDefault()?.TranslateText
            })
        };

        return Ok(projectedResult);
    }

    [HttpPost]
    [ApiKey]
    public async Task<IActionResult> AddSubtitle([FromBody] Subtitle subtitle)
    {
        if (subtitle == null) return BadRequest("Subtitle cannot be null");
        
        await _subtitleRepository.AddAsync(subtitle);
        return Ok(subtitle);
    }

    [HttpDelete("{id}")]
    [ApiKey]
    public async Task<IActionResult> DeleteSubtitle(long id)
    {
        var subtitle = await _subtitleRepository.GetByIdAsync(id);
        if (subtitle == null) return NotFound("Subtitle not found");

        _subtitleRepository.Remove(subtitle);
        return Ok("Subtitle deleted successfully");
    }
}
