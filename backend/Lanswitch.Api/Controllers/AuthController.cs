using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly IGenericRepository<UserSession> _sessionRepository;
    private readonly IAuthAppService _authService;
    private readonly IConfiguration _configuration;

    public AuthController(
        IUserRepository userRepository, 
        IGenericRepository<UserSession> sessionRepository,
        IAuthAppService authService, 
        IConfiguration configuration)
    {
        _userRepository = userRepository;
        _sessionRepository = sessionRepository;
        _authService = authService;
        _configuration = configuration;
    }

    public class MagicLoginRequest
    {
        public string Token { get; set; } = null!;
    }

    public class TelegramAutoLoginRequest
    {
        public string? TelegramId { get; set; }
        public long? UserId { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Username { get; set; }
        public string? PhotoUrl { get; set; }
        public string? InitData { get; set; }
        public string? Role { get; set; }
    }

    [HttpPost("telegram-auto-login")]
    public async Task<IActionResult> TelegramAutoLogin([FromBody] TelegramAutoLoginRequest req)
    {
        if (string.IsNullOrEmpty(req.TelegramId) && (!req.UserId.HasValue || req.UserId <= 0))
        {
            return BadRequest(new { message = "TelegramId or UserId is required" });
        }

        string? targetRole = null;
        if (!string.IsNullOrEmpty(req.Role))
        {
            var r = req.Role.Trim().ToLower();
            if (r == "teacher") targetRole = "Teacher";
            else if (r == "student") targetRole = "Student";
        }

        User? user = null;
        if (req.UserId.HasValue && req.UserId.Value > 0)
        {
            user = await _userRepository.GetByIdAsync(req.UserId.Value);
        }

        if (user == null && !string.IsNullOrEmpty(req.TelegramId))
        {
            user = await _userRepository.GetByTelegramIdAsync(req.TelegramId);
        }

        // Foydalanuvchi bazada bo'lmasa, uni avtomatik yaratamiz
        if (user == null)
        {
            var fullName = $"{req.FirstName} {req.LastName}".Trim();
            if (string.IsNullOrEmpty(fullName))
            {
                fullName = !string.IsNullOrEmpty(req.Username) ? req.Username : "Telegram User";
            }

            user = new User
            {
                TelegramId = req.TelegramId ?? "",
                FullName = fullName,
                ProfileImage = req.PhotoUrl,
                NativeLanguageId = 1,
                Role = targetRole ?? "Student",
                IsAdmin = false,
                CreatedAt = DateTime.UtcNow
            };
            await _userRepository.AddAsync(user);
        }
        else
        {
            bool updated = false;
            if (!string.IsNullOrEmpty(req.PhotoUrl) && user.ProfileImage != req.PhotoUrl)
            {
                user.ProfileImage = req.PhotoUrl;
                updated = true;
            }
            if (!string.IsNullOrEmpty(targetRole) && user.Role != targetRole)
            {
                user.Role = targetRole;
                updated = true;
            }
            if (updated)
            {
                _userRepository.Update(user);
            }
        }

        var refreshToken = _authService.GenerateRefreshToken();
        var refreshTokenHash = _authService.HashRefreshToken(refreshToken);

        var expiryHours = _configuration.GetValue<int>("JwtSettings:RefreshTokenExpiryInHours", 168);
        var expiryTime = DateTime.UtcNow.AddHours(expiryHours);

        var userSession = new UserSession
        {
            UserId = user.Id,
            Agent = Request.Headers["User-Agent"].ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            Device = "tma",
            IsActive = true,
            RefreshTokenHash = refreshTokenHash,
            RefreshTokenExpiryTime = expiryTime
        };

        await _sessionRepository.AddAsync(userSession);

        var accessToken = _authService.GenerateJwtToken(user, userSession.Id);
        SetTokensInCookies(accessToken, refreshToken, expiryTime);

        return Ok(new
        {
            message = "Auto login successful",
            userId = user.Id,
            accessToken = accessToken,
            user = new
            {
                user.Id,
                user.FullName,
                user.TelegramId,
                user.ProfileImage,
                user.NativeLanguageId,
                user.Role,
                user.IsAdmin,
                user.CreatedAt,
                user.Balance,
                user.HasReceivedInitialBonus
            }
        });
    }

    [HttpGet("redirect")]
    public IActionResult RedirectToFrontend([FromQuery] string token)
    {
        // Telegram bot localhost ssilkalarni qabul qilmaydi, shuning uchun API orqali redirect qilamiz
        string front_url = _configuration.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        return Redirect($"https://{front_url}/auth/login?token={token}");
    }

    [HttpPost("magic-login")]
    public async Task<IActionResult> MagicLogin([FromBody] MagicLoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Token)) return BadRequest(new { message = "Token kerak" });

        var user = await _userRepository.GetByLoginTokenAsync(request.Token);
        
        if (user == null)
        {
            return Unauthorized(new { message = "Yaroqsiz yoki muddati o'tgan token" });
        }

        // Tokenni yaroqsiz holatga keltiramiz (bir martalik)
        user.LoginToken = null;
        user.LoginTokenExpiry = null;
        _userRepository.Update(user);

        var refreshToken = _authService.GenerateRefreshToken();
        var refreshTokenHash = _authService.HashRefreshToken(refreshToken);

        var expiryHours = _configuration.GetValue<int>("JwtSettings:RefreshTokenExpiryInHours", 168);
        var expiryTime = DateTime.UtcNow.AddHours(expiryHours);

        var userSession = new UserSession
        {
            UserId = user.Id,
            Agent = Request.Headers["User-Agent"].ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            Device = "web",
            IsActive = true,
            RefreshTokenHash = refreshTokenHash,
            RefreshTokenExpiryTime = expiryTime
        };

        await _sessionRepository.AddAsync(userSession);

        var accessToken = _authService.GenerateJwtToken(user, userSession.Id);

        SetTokensInCookies(accessToken, refreshToken, expiryTime);

        return Ok(new { 
            message = "Muvaffaqiyatli login qildingiz", 
            userId = user.Id,
            accessToken = accessToken,
            user = new {
                user.Id,
                user.FullName,
                user.TelegramId,
                user.ProfileImage,
                user.NativeLanguageId,
                user.Role,
                user.IsAdmin,
                user.CreatedAt
            }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies["RefreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Unauthorized(new { message = "Refresh token topilmadi" });
        }

        var refreshTokenHash = _authService.HashRefreshToken(refreshToken);

        var session = await _sessionRepository.FirstOrDefaultAsync(s => s.RefreshTokenHash == refreshTokenHash && s.IsActive);

        if (session == null || session.RefreshTokenExpiryTime < DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Yaroqsiz yoki muddati o'tgan refresh token" });
        }

        // Yangi tokenlarni yaratamiz
        var user = await _userRepository.GetByIdAsync(session.UserId);
        if (user == null) return Unauthorized();

        var newAccessToken = _authService.GenerateJwtToken(user);
        var newRefreshToken = _authService.GenerateRefreshToken();
        var newRefreshTokenHash = _authService.HashRefreshToken(newRefreshToken);
        
        var expiryHours = _configuration.GetValue<int>("JwtSettings:RefreshTokenExpiryInHours", 168);
        var expiryTime = DateTime.UtcNow.AddHours(expiryHours);

        session.RefreshTokenHash = newRefreshTokenHash;
        session.RefreshTokenExpiryTime = expiryTime;
        session.UpdatedAt = DateTime.UtcNow;

        _sessionRepository.Update(session);

        SetTokensInCookies(newAccessToken, newRefreshToken, expiryTime);

        return Ok(new { message = "Tokenlar muvaffaqiyatli yangilandi" });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["RefreshToken"];
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var hash = _authService.HashRefreshToken(refreshToken);
            var session = await _sessionRepository.FirstOrDefaultAsync(s => s.RefreshTokenHash == hash);
            if (session != null)
            {
                session.IsActive = false;
                session.UpdatedAt = DateTime.UtcNow;
                _sessionRepository.Update(session);
            }
        }

        Response.Cookies.Delete("AccessToken");
        Response.Cookies.Delete("RefreshToken");

        return Ok(new { message = "Muvaffaqiyatli chiqildi" });
    }

    private void SetTokensInCookies(string accessToken, string refreshToken, DateTime refreshExpiryTime)
    {
        var accessCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true, 
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddMinutes(_configuration.GetValue<int>("JwtSettings:AccessTokenExpiryInMinutes", 60))
        };

        var refreshCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = refreshExpiryTime
        };

        Response.Cookies.Append("AccessToken", accessToken, accessCookieOptions);
        Response.Cookies.Append("RefreshToken", refreshToken, refreshCookieOptions);
    }
}
