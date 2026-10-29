using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
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
    public async Task<IActionResult> GetMediaComments(long mediaId, [FromQuery] long? userId = null)
    {
        long? currentUserId = userId;
        if (!currentUserId.HasValue || currentUserId.Value <= 0)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdStr, out var parsedId))
            {
                currentUserId = parsedId;
            }
        }

        var comments = await _context.Comments
            .Include(c => c.User)
            .Include(c => c.Likes)
            .Include(c => c.Replies)
                .ThenInclude(r => r.User)
            .Include(c => c.Replies)
                .ThenInclude(r => r.Likes)
            .Where(c => c.MediaId == mediaId && c.ParentCommentId == null)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        var result = comments.Select(c => {
            var myReaction = currentUserId.HasValue
                ? c.Likes.FirstOrDefault(l => l.UserId == currentUserId.Value)
                : null;

            return new {
                c.Id,
                c.Text,
                c.CreatedAt,
                LikesCount = c.Likes.Count(l => !l.IsDislike),
                DislikesCount = c.Likes.Count(l => l.IsDislike),
                UserReaction = myReaction == null ? null : (myReaction.IsDislike ? "dislike" : "like"),
                User = new {
                    c.User?.Id,
                    c.User?.FullName,
                    c.User?.ProfileImage,
                    c.User?.AvatarUrl,
                    c.User?.Role,
                    c.User?.IsAdmin
                },
                Replies = c.Replies.Select(r => {
                    var myReplyReaction = currentUserId.HasValue
                        ? r.Likes.FirstOrDefault(l => l.UserId == currentUserId.Value)
                        : null;

                    return new {
                        r.Id,
                        r.Text,
                        r.CreatedAt,
                        r.ParentCommentId,
                        LikesCount = r.Likes.Count(l => !l.IsDislike),
                        DislikesCount = r.Likes.Count(l => l.IsDislike),
                        UserReaction = myReplyReaction == null ? null : (myReplyReaction.IsDislike ? "dislike" : "like"),
                        User = new {
                            r.User?.Id,
                            r.User?.FullName,
                            r.User?.ProfileImage,
                            r.User?.AvatarUrl,
                            r.User?.Role,
                            r.User?.IsAdmin
                        }
                    };
                }).OrderBy(r => r.CreatedAt).ToList()
            };
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> AddComment([FromBody] AddCommentRequest request)
    {
        long userId = request.UserId;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdStr, out var parsedId))
        {
            userId = parsedId;
        }

        if (userId <= 0) userId = 1; // Default fallback for guests

        var comment = new Comment
        {
            MediaId = request.MediaId,
            UserId = userId,
            Text = request.Text.Trim(),
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
            createdComment?.ParentCommentId,
            LikesCount = 0,
            DislikesCount = 0,
            UserReaction = (string?)null,
            User = new {
                createdComment?.User?.Id,
                createdComment?.User?.FullName,
                createdComment?.User?.ProfileImage,
                createdComment?.User?.AvatarUrl,
                createdComment?.User?.Role,
                createdComment?.User?.IsAdmin
            },
            Replies = new object[] { }
        });
    }

    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(long id, [FromBody] ReactionRequest? request)
    {
        return await HandleReaction(id, request?.UserId, isDislike: false);
    }

    [HttpPost("{id}/dislike")]
    public async Task<IActionResult> ToggleDislike(long id, [FromBody] ReactionRequest? request)
    {
        return await HandleReaction(id, request?.UserId, isDislike: true);
    }

    [HttpPost("{id}/react")]
    public async Task<IActionResult> React(long id, [FromBody] ReactRequest request)
    {
        bool isDislike = string.Equals(request.Reaction, "dislike", StringComparison.OrdinalIgnoreCase);
        return await HandleReaction(id, request.UserId, isDislike);
    }

    private async Task<IActionResult> HandleReaction(long commentId, long? requestUserId, bool isDislike)
    {
        long userId = requestUserId ?? 0;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(userIdStr, out var parsedId))
        {
            userId = parsedId;
        }

        if (userId <= 0) userId = 1;

        var existingReaction = await _context.CommentLikes
            .FirstOrDefaultAsync(cl => cl.CommentId == commentId && cl.UserId == userId);

        if (existingReaction != null)
        {
            if (existingReaction.IsDislike == isDislike)
            {
                // Clicking the same active reaction toggles it off
                _context.CommentLikes.Remove(existingReaction);
            }
            else
            {
                // Clicking opposite reaction switches it
                existingReaction.IsDislike = isDislike;
                existingReaction.UpdatedAt = DateTime.UtcNow;
            }
        }
        else
        {
            // Adding fresh reaction
            _context.CommentLikes.Add(new CommentLike
            {
                CommentId = commentId,
                UserId = userId,
                IsDislike = isDislike,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        var likesCount = await _context.CommentLikes.CountAsync(cl => cl.CommentId == commentId && !cl.IsDislike);
        var dislikesCount = await _context.CommentLikes.CountAsync(cl => cl.CommentId == commentId && cl.IsDislike);
        var currentReaction = await _context.CommentLikes.FirstOrDefaultAsync(cl => cl.CommentId == commentId && cl.UserId == userId);
        string? userReaction = currentReaction == null ? null : (currentReaction.IsDislike ? "dislike" : "like");

        return Ok(new {
            commentId,
            likesCount,
            dislikesCount,
            userReaction,
            liked = userReaction == "like",
            disliked = userReaction == "dislike"
        });
    }
}

public class AddCommentRequest
{
    public long UserId { get; set; }
    public long MediaId { get; set; }
    public string Text { get; set; } = null!;
    public long? ParentCommentId { get; set; }
}

public class ReactionRequest
{
    public long UserId { get; set; }
}

public class ReactRequest
{
    public long UserId { get; set; }
    public string Reaction { get; set; } = "like"; // "like" or "dislike"
}
