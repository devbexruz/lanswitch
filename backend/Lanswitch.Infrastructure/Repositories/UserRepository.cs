using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Infrastructure.Repositories;

public class UserRepository : GenericRepository<User>, IUserRepository
{
    public UserRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByTelegramIdAsync(string telegramId)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.TelegramId == telegramId);
    }

    public async Task<User?> GetByLoginTokenAsync(string token)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.LoginToken == token && u.LoginTokenExpiry > DateTime.UtcNow);
    }
}
