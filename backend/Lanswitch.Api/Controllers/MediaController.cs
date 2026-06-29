using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IGenericRepository<Media> _mediaRepository;

    public MediaController(IGenericRepository<Media> mediaRepository)
    {
        _mediaRepository = mediaRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromServices] AppDbContext context)
    {
        var isAdmin = User.IsInRole("Admin");

        var query = context.Medias.Include(m => m.Categories).AsQueryable();

        // Non-admin users can only see media that has at least one category assigned
        if (!isAdmin)
        {
            query = query.Where(m => m.Categories.Any());
        }

        var mediaList = await query
            .Select(m => new {
                m.Id,
                m.Title,
                m.Description,
                m.LanguageId,
                m.VideoUrl,
                m.Level,
                CategoryIds = m.Categories.Select(c => c.Id).ToList(),
                m.ThumbnailUrl,
                m.DurationalMinutes,
                m.IsFilm,
                EpisodeCount = m.Episodes.Count()
            })
            .ToListAsync();
        return Ok(mediaList);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories([FromServices] AppDbContext context)
    {
        var categories = await context.Categories.ToListAsync();
        return Ok(categories);
    }

    public record CreateCategoryRequest(string Name);

    [HttpPost("categories")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request, [FromServices] AppDbContext context)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest();
        var category = new Category { Name = request.Name };
        context.Categories.Add(category);
        await context.SaveChangesAsync();
        return Ok(category);
    }

    [HttpPut("categories/{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateCategory(long id, [FromBody] CreateCategoryRequest request, [FromServices] AppDbContext context)
    {
        var category = await context.Categories.FindAsync(id);
        if (category == null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest();
        
        category.Name = request.Name;
        await context.SaveChangesAsync();
        return Ok(category);
    }

    [HttpDelete("categories/{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteCategory(long id, [FromServices] AppDbContext context)
    {
        var category = await context.Categories.FindAsync(id);
        if (category == null) return NotFound();

        context.Categories.Remove(category);
        await context.SaveChangesAsync();
        return Ok(new { message = "Category deleted" });
    }

    [HttpDelete("{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteMedia(long id, [FromServices] AppDbContext context)
    {
        var media = await context.Medias.FindAsync(id);
        if (media == null) return NotFound();

        context.Medias.Remove(media);
        await context.SaveChangesAsync();

        return Ok(new { message = "Media deleted successfully" });
    }

    public record CreateMediaRequest(string Title, string Description, bool IsFilm, string ThumbnailUrl, long? LanguageId, string? Level, System.Collections.Generic.List<long>? CategoryIds);

    [HttpPost]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateMedia([FromBody] CreateMediaRequest request, [FromServices] AppDbContext context)
    {
        var newMedia = new Media
        {
            Title = request.Title,
            Description = request.Description,
            IsFilm = request.IsFilm,
            ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=3540&auto=format&fit=crop" : request.ThumbnailUrl,
            LanguageId = request.LanguageId ?? 2,
            Level = request.Level ?? "A1",
            VideoUrl = ""
        };

        if (request.CategoryIds != null && request.CategoryIds.Any())
        {
            var categories = await context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync();
            newMedia.Categories = categories;
        }
        else
        {
            // Default category fallback
            var defaultCategory = await context.Categories.FirstOrDefaultAsync();
            if (defaultCategory != null) newMedia.Categories.Add(defaultCategory);
        }

        context.Medias.Add(newMedia);
        await context.SaveChangesAsync();

        return Ok(newMedia);
    }

    [HttpPut("{id}/toggle-type")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleType(long id, [FromServices] AppDbContext context)
    {
        var media = await context.Medias.FindAsync(id);
        if (media == null) return NotFound();

        media.IsFilm = !media.IsFilm;
        await context.SaveChangesAsync();

        return Ok(new { message = "Media type toggled", isFilm = media.IsFilm });
    }

    public record UpdateMediaRequest(string Title, string Description, bool IsFilm, string ThumbnailUrl, long? LanguageId, string? Level, System.Collections.Generic.List<long>? CategoryIds);

    [HttpPut("{id}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateMedia(long id, [FromBody] UpdateMediaRequest request, [FromServices] AppDbContext context)
    {
        var media = await context.Medias.Include(m => m.Categories).FirstOrDefaultAsync(m => m.Id == id);
        if (media == null) return NotFound();

        media.Title = request.Title;
        media.Description = request.Description;
        media.IsFilm = request.IsFilm;
        if (!string.IsNullOrWhiteSpace(request.ThumbnailUrl))
        {
            media.ThumbnailUrl = request.ThumbnailUrl;
        }
        
        if (request.LanguageId.HasValue && request.LanguageId > 0)
        {
            media.LanguageId = request.LanguageId.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.Level))
        {
            media.Level = request.Level;
        }

        if (request.CategoryIds != null)
        {
            media.Categories.Clear();
            var categories = await context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync();
            foreach (var cat in categories)
            {
                media.Categories.Add(cat);
            }
        }

        await context.SaveChangesAsync();

        return Ok(media);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(long id, [FromServices] AppDbContext context)
    {
        var media = await context.Medias
            .Include(m => m.Episodes)
            .Include(m => m.Categories)
            .FirstOrDefaultAsync(m => m.Id == id);
            
        if (media == null) return NotFound();
        
        // For TV series, return ordered episodes directly as a convenience
        var episodes = media.Episodes.OrderBy(e => e.EpisodeNumber).ToList();
        
        var result = new {
            media.Id,
            media.Title,
            media.Description,
            media.VideoUrl,
            media.ThumbnailUrl,
            media.IsFilm,
            media.DurationalMinutes,
            CategoryIds = media.Categories.Select(c => c.Id).ToList(),
            Episodes = episodes.Select(e => new {
                e.Id,
                e.EpisodeNumber,
                e.Title,
                e.VideoUrl,
                e.DurationalMinutes
            })
        };
        
        return Ok(result);
    }
}
