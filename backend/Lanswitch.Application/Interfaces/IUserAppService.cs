using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IUserAppService
{
    Task<User?> GetUserByIdAsync(long id);
    Task<User> CreateUserAsync(User user);
    Task<IEnumerable<User>> GetAllUsersAsync();
    Task UpdateUserAsync(User user);
}
