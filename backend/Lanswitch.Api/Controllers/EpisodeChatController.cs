using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lanswitch.Infrastructure.Data;
using Lanswitch.Domain.Entities;
using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EpisodeChatController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IGeminiAiService _geminiService;

    public EpisodeChatController(AppDbContext context, IGeminiAiService geminiService)
    {
        _context = context;
        _geminiService = geminiService;
    }

    public class EpisodeChatRequest
    {
        public long EpisodeId { get; set; }
        public long? SubtitleId { get; set; }
        public string Message { get; set; } = null!;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> SendMessage([FromBody] EpisodeChatRequest request)
    {
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !long.TryParse(userIdString, out var userId))
        {
            return Unauthorized(new { message = "Ai bilan til o'rganish uchun tizimga kiring!" });
        }

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Ai bilan til o'rganish uchun tizimga kiring!" });
        }

        // Add user message to history
        var userMsg = new EpisodeChatMessage
        {
            EpisodeId = request.EpisodeId,
            UserId = userId,
            Role = "User",
            Content = request.Message,
            ContextSubtitleId = request.SubtitleId,
            CreatedAt = DateTime.UtcNow
        };
        _context.EpisodeChatMessages.Add(userMsg);
        await _context.SaveChangesAsync();

        // 1. Get exact context (current subtitle + 2 previous) if SubtitleId is provided
        var contextSubtitles = new List<Subtitle>();
        var episodeSubtitles = await _context.Subtitles
            .Where(s => s.EpisodeId == request.EpisodeId)
            .OrderBy(s => s.Index)
            .ToListAsync();
        var targetSub = episodeSubtitles.FirstOrDefault(s => s.Id == request.SubtitleId);
        if (targetSub != null)
        {
            // Take up to 2 previous subtitles + the current one
            var relevantSubs = episodeSubtitles
                .Where(s => s.Index <= targetSub.Index)
                .OrderByDescending(s => s.Index)
                .Take(3)
                .OrderBy(s => s.Index)
                .ToList();
                
            contextSubtitles.AddRange(relevantSubs);
        }

        // 2. Vector Search (In-memory C# Cosine Similarity)
        // Since we dropped PgVector, we load embeddings into memory and compute cosine distance.
        // Usually, an episode has 500-1500 subtitles, computing this in C# is instantaneous.
        var messageEmbedding = await _geminiService.GenerateEmbeddingAsync(request.Message);
        
        if (messageEmbedding != null && messageEmbedding.Length > 0)
        {
            var subtitlesWithEmbeddings = episodeSubtitles.Where(s => s.Embedding != null).ToList();
            if (subtitlesWithEmbeddings.Count > 0)
            {
                // Find top 3 most relevant subtitles using Cosine Similarity
                var topVectorSubs = subtitlesWithEmbeddings
                    .Select(s => new { Subtitle = s, Similarity = CosineSimilarity(messageEmbedding, s.Embedding!) })
                    .OrderByDescending(x => x.Similarity)
                    .Take(3)
                    .Select(x => x.Subtitle)
                    .ToList();

                // Merge and deduplicate context
                foreach (var vs in topVectorSubs)
                {
                    if (!contextSubtitles.Any(c => c.Id == vs.Id))
                    {
                        contextSubtitles.Add(vs);
                    }
                }
            }
        }
        
        // Ensure chronological order for Gemini context
        contextSubtitles = contextSubtitles.OrderBy(s => s.Index).ToList();

        // Get past chat history for LangChain-style context injection
        var chatHistory = await _context.EpisodeChatMessages
            .Where(m => m.EpisodeId == request.EpisodeId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .Take(20) // Last 20 messages
            .ToListAsync();

        // Fetch language title for AI context
        var episode = await _context.Episodes
            .Include(e => e.Media)
            .ThenInclude(m => m!.Language)
            .FirstOrDefaultAsync(e => e.Id == request.EpisodeId);
        string langTitle = episode?.Media?.Language?.Title ?? "Ingliz";

        // Send to Gemini
        var aiResponseText = await _geminiService.ChatWithContextAsync(
            request.Message,
            chatHistory,
            contextSubtitles,
            request.SubtitleId,
            langTitle
        );

        // Save AI response
        var aiMsg = new EpisodeChatMessage
        {
            EpisodeId = request.EpisodeId,
            UserId = userId,
            Role = "AI",
            Content = aiResponseText,
            CreatedAt = DateTime.UtcNow
        };
        _context.EpisodeChatMessages.Add(aiMsg);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            sessionId = episode!.Id,
            response = aiResponseText
        });
    }

    [HttpGet("episode/{episodeId}")]
    [Authorize]
    public async Task<IActionResult> GetChatHistory(long episodeId)
    {
        // Check User auth
        long userId;
        var sessionIdClaim = User.FindFirst("session_id")?.Value;
        if (string.IsNullOrEmpty(sessionIdClaim) || !long.TryParse(sessionIdClaim, out long sId))
        {
            return Unauthorized();
        }
        var userSession = await _context.UserSessions.FindAsync(sId);
        if (userSession == null){
            return Unauthorized(new { message = "Ai bilan til o'rganish uchun tizimga kiring!" });
        }
        userId = userSession.UserId;

        var messages = await _context.EpisodeChatMessages
            .Where(m => m.EpisodeId == episodeId && m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new {
                m.Id,
                m.Role,
                m.Content,
                m.ContextSubtitleId,
                m.CreatedAt
            })
            .ToListAsync();
            
        return Ok(messages);
    }

    private float CosineSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA.Length != vectorB.Length) return 0;
        
        float dotProduct = 0;
        float magnitudeA = 0;
        float magnitudeB = 0;

        for (int i = 0; i < vectorA.Length; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
            magnitudeA += vectorA[i] * vectorA[i];
            magnitudeB += vectorB[i] * vectorB[i];
        }

        magnitudeA = (float)Math.Sqrt(magnitudeA);
        magnitudeB = (float)Math.Sqrt(magnitudeB);

        if (magnitudeA == 0 || magnitudeB == 0) return 0;

        return dotProduct / (magnitudeA * magnitudeB);
    }
}
