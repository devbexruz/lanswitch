using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;

namespace Lanswitch.Application.Services;

public class UserAppService : IUserAppService
{
    private readonly IUserRepository _userRepository;

    public UserAppService(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<User?> GetUserByIdAsync(long id)
    {
        return await _userRepository.GetByIdAsync(id);
    }

    public async Task<User> CreateUserAsync(User user)
    {
        await _userRepository.AddAsync(user);
        return user;
    }

    public async Task<IEnumerable<User>> GetAllUsersAsync()
    {
        return await _userRepository.GetAllAsync();
    }
}
