using Lanswitch.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Jadvallarni ro'yxatdan o'tkazish
    public DbSet<User> Users { get; set; }
    public DbSet<Vocabulary> Vocabularies { get; set; }
}