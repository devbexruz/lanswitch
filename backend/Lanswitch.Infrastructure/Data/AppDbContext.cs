using Lanswitch.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Jadvallarni ro'yxatdan o'tkazish
    public DbSet<User> Users { get; set; }
    public DbSet<Language> Languages { get; set; }
    public DbSet<LearningLanguage> LearningLanguages { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Media> Medias { get; set; }

    public DbSet<Episode> Episodes { get; set; }
    public DbSet<Subtitle> Subtitles { get; set; }
    public DbSet<GrammarContext> GrammarContexts { get; set; }
    public DbSet<Gap> Gaps { get; set; }
    public DbSet<Word> Words { get; set; }
    public DbSet<WordTranslate> WordTranslates { get; set; }
    public DbSet<UserWord> UserWords { get; set; }
    public DbSet<UserGrammar> UserGrammars { get; set; }
    public DbSet<UserSession> UserSessions { get; set; }
    public DbSet<SubtitleWord> SubtitleWords { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<CommentLike> CommentLikes { get; set; }
    public DbSet<WatchHistory> WatchHistories { get; set; }
    public DbSet<AppNotification> AppNotifications { get; set; }
    // public DbSet<EpisodeChatSession> EpisodeChatSessions { get; set; }
    public DbSet<EpisodeChatMessage> EpisodeChatMessages { get; set; }
    // public DbSet<MediaChatSession> MediaChatSessions { get; set; }
    public DbSet<MediaChatMessage> MediaChatMessages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}