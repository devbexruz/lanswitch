using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IAuthAppService
{
    string GenerateJwtToken(User user, long? sessionId = null);
    string GenerateRefreshToken();
    string HashRefreshToken(string refreshToken);
}
