using Lanswitch.Domain.Entities;

namespace Lanswitch.Domain.Interfaces;

public interface IUserRepository : IGenericRepository<User>
{
    Task<User?> GetByTelegramIdAsync(string telegramId);
    Task<User?> GetByLoginTokenAsync(string token);
}
