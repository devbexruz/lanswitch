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
public class CommentController : ControllerBase
{
    private readonly AppDbContext _context;

    public CommentController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("media/{mediaId}")]
    public async Task<IActionResult> GetMediaComments(long mediaId)
    {
        var comments = await _context.Comments
            .Include(c => c.User)
            .Include(c => c.Likes)
            .Include(c => c.Replies)
                .ThenInclude(r => r.User)
            .Where(c => c.MediaId == mediaId && c.ParentCommentId == null)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        var result = comments.Select(c => new {
            c.Id,
            c.Text,
            c.CreatedAt,
            LikesCount = c.Likes.Count,
            User = new {
                c.User?.Id,
                c.User?.FullName,
                c.User?.ProfileImage
            },
            Replies = c.Replies.Select(r => new {
                r.Id,
                r.Text,
                r.CreatedAt,
                User = new {
                    r.User?.Id,
                    r.User?.FullName,
                    r.User?.ProfileImage
                }
            }).OrderBy(r => r.CreatedAt).ToList()
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> AddComment([FromBody] AddCommentRequest request)
    {
        long userId = request.UserId > 0 ? request.UserId : 1; // Default for testing

        var comment = new Comment
        {
            MediaId = request.MediaId,
            UserId = userId,
            Text = request.Text,
            ParentCommentId = request.ParentCommentId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Comments.Add(comment);
        await _context.SaveChangesAsync();

        var createdComment = await _context.Comments
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Id == comment.Id);

        return Ok(new {
            createdComment?.Id,
            createdComment?.Text,
            createdComment?.CreatedAt,
            LikesCount = 0,
            User = new {
                createdComment?.User?.Id,
                createdComment?.User?.FullName,
                createdComment?.User?.ProfileImage
            },
            Replies = new object[] { }
        });
    }

    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(long id, [FromBody] LikeRequest request)
    {
        long userId = request.UserId > 0 ? request.UserId : 1;

        var existingLike = await _context.CommentLikes
            .FirstOrDefaultAsync(cl => cl.CommentId == id && cl.UserId == userId);

        if (existingLike != null)
        {
            _context.CommentLikes.Remove(existingLike);
            await _context.SaveChangesAsync();
            return Ok(new { Liked = false });
        }
        else
        {
            _context.CommentLikes.Add(new CommentLike
            {
                CommentId = id,
                UserId = userId
            });
            await _context.SaveChangesAsync();
            return Ok(new { Liked = true });
        }
    }
}

public class AddCommentRequest
{
    public long UserId { get; set; }
    public long MediaId { get; set; }
    public string Text { get; set; } = null!;
    public long? ParentCommentId { get; set; }
}

public class LikeRequest
{
    public long UserId { get; set; }
}
