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
    public DbSet<Season> Seasons { get; set; }
    public DbSet<Episode> Episodes { get; set; }
    public DbSet<Subtitle> Subtitles { get; set; }
    public DbSet<GrammarContext> GrammarContexts { get; set; }
    public DbSet<Gap> Gaps { get; set; }
    public DbSet<Word> Words { get; set; }
    public DbSet<WordTranslate> WordTranslates { get; set; }
    public DbSet<UserWord> UserWords { get; set; }
    public DbSet<UserGrammar> UserGrammars { get; set; }
    public DbSet<UserSession> UserSessions { get; set; }
}