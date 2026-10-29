using Lanswitch.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Foydalanuvchilar va umumiy modellar
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
    public DbSet<EpisodeChatMessage> EpisodeChatMessages { get; set; }
    public DbSet<MediaChatMessage> MediaChatMessages { get; set; }

    // Telegram guruhlar va Uyga vazifalar (Lanswitch Classroom Engine)
    public DbSet<TelegramGroup> TelegramGroups { get; set; }
    public DbSet<GroupAdmin> GroupAdmins { get; set; }
    public DbSet<GroupMember> GroupMembers { get; set; }
    public DbSet<Assignment> Assignments { get; set; }
    public DbSet<AssignmentItem> AssignmentItems { get; set; }
    public DbSet<AssignmentItemSubmission> AssignmentItemSubmissions { get; set; }
    public DbSet<ItemSubmissionAttachment> ItemSubmissionAttachments { get; set; }
    public DbSet<TeacherHomeworkContext> TeacherHomeworkContexts { get; set; }
    public DbSet<AiHomeworkDraft> AiHomeworkDrafts { get; set; }
    public DbSet<GroupMessageContext> GroupMessageContexts { get; set; }

    // Darslik kitoblar va Lug'at (Books & Vocabulary Engine)
    public DbSet<Book> Books { get; set; }
    public DbSet<BookPart> BookParts { get; set; }
    public DbSet<BookUnit> BookUnits { get; set; }
    public DbSet<BookWord> BookWords { get; set; }

    // Obunalar va Tariflar (Subscriptions & Plans)
    public DbSet<UserSubscription> UserSubscriptions { get; set; }
    public DbSet<SubscriptionPlanConfig> SubscriptionPlanConfigs { get; set; }
    public DbSet<SubscriptionPaymentRequest> SubscriptionPaymentRequests { get; set; }
    public DbSet<SubscriptionLog> SubscriptionLogs { get; set; }
    public DbSet<CardPaymentSetting> CardPaymentSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserSubscription
        modelBuilder.Entity<UserSubscription>(entity =>
        {
            entity.HasOne(s => s.User)
                .WithMany(u => u.Subscriptions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SubscriptionPaymentRequest>(entity =>
        {
            entity.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SubscriptionLog>(entity =>
        {
            entity.HasOne(l => l.User)
                .WithMany()
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Word indeksi
        modelBuilder.Entity<Word>()
            .HasIndex(w => new { w.LanguageId, w.Text })
            .IsUnique();

        // TelegramGroup
        modelBuilder.Entity<TelegramGroup>(entity =>
        {
            entity.HasIndex(g => g.TelegramChatId).IsUnique();
            entity.HasOne(g => g.Owner)
                .WithMany(u => u.OwnedGroups)
                .HasForeignKey(g => g.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // GroupAdmin
        modelBuilder.Entity<GroupAdmin>(entity =>
        {
            entity.HasIndex(ga => new { ga.GroupId, ga.UserId }).IsUnique();
            entity.HasOne(ga => ga.Group)
                .WithMany(g => g.Admins)
                .HasForeignKey(ga => ga.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ga => ga.User)
                .WithMany(u => u.GroupAdmins)
                .HasForeignKey(ga => ga.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // GroupMember
        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasIndex(gm => new { gm.GroupId, gm.StudentId }).IsUnique();
            entity.HasOne(gm => gm.Group)
                .WithMany(g => g.Members)
                .HasForeignKey(gm => gm.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(gm => gm.Student)
                .WithMany(u => u.GroupMembers)
                .HasForeignKey(gm => gm.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Assignment
        modelBuilder.Entity<Assignment>(entity =>
        {
            entity.HasOne(a => a.Group)
                .WithMany(g => g.Assignments)
                .HasForeignKey(a => a.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(a => a.Creator)
                .WithMany(u => u.CreatedAssignments)
                .HasForeignKey(a => a.CreatorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // AssignmentItem
        modelBuilder.Entity<AssignmentItem>(entity =>
        {
            entity.HasOne(ai => ai.Assignment)
                .WithMany(a => a.Items)
                .HasForeignKey(ai => ai.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ai => ai.TargetUnit)
                .WithMany(u => u.AssignmentItems)
                .HasForeignKey(ai => ai.TargetUnitId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // AssignmentItemSubmission
        modelBuilder.Entity<AssignmentItemSubmission>(entity =>
        {
            entity.HasOne(s => s.Assignment)
                .WithMany(a => a.Submissions)
                .HasForeignKey(s => s.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.AssignmentItem)
                .WithMany(i => i.Submissions)
                .HasForeignKey(s => s.AssignmentItemId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.Student)
                .WithMany(u => u.Submissions)
                .HasForeignKey(s => s.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.ReviewedBy)
                .WithMany()
                .HasForeignKey(s => s.ReviewedById)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ItemSubmissionAttachment
        modelBuilder.Entity<ItemSubmissionAttachment>(entity =>
        {
            entity.HasOne(a => a.ItemSubmission)
                .WithMany(s => s.Attachments)
                .HasForeignKey(a => a.ItemSubmissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Book hierarchy
        modelBuilder.Entity<BookPart>(entity =>
        {
            entity.HasOne(p => p.Book)
                .WithMany(b => b.Parts)
                .HasForeignKey(p => p.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookUnit>(entity =>
        {
            entity.HasOne(u => u.Part)
                .WithMany(p => p.Units)
                .HasForeignKey(u => u.PartId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookWord>(entity =>
        {
            entity.HasOne(w => w.Unit)
                .WithMany(u => u.Words)
                .HasForeignKey(w => w.UnitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupMessageContext>(entity =>
        {
            entity.HasOne(g => g.Group)
                .WithMany()
                .HasForeignKey(g => g.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}