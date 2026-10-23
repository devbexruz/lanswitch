using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly IUserAppService _userService;

    public UserController(IUserAppService userService)
    {
        _userService = userService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] User user)
    {
        var created = await _userService.CreateUserAsync(user);
        return Ok(created);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpGet("by-telegram/{telegramId}")]
    public async Task<IActionResult> GetByTelegramId(string telegramId)
    {
        var user = await _userService.GetByTelegramIdAsync(telegramId);
        if (user == null)
        {
            return NotFound(new { message = "Foydalanuvchi topilmadi" });
        }

        return Ok(new {
            user.Id,
            user.FullName,
            user.TelegramId,
            user.ProfileImage,
            user.NativeLanguageId,
            user.Role,
            user.IsAdmin,
            user.CreatedAt
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !long.TryParse(userIdString, out var userId))
        {
            return Unauthorized(new { message = "Tasdiqlanmagan foydalanuvchi" });
        }

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Foydalanuvchi topilmadi" });
        }

        return Ok(new {
            user.Id,
            user.FullName,
            user.TelegramId,
            user.ProfileImage,
            user.NativeLanguageId,
            user.Role,
            user.IsAdmin,
            user.CreatedAt
        });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest req)
    {
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !long.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null) return NotFound();

        if (!string.IsNullOrEmpty(req.FullName))
        {
            user.FullName = req.FullName;
        }
        
        await _userService.UpdateUserAsync(user);

        return Ok(new {
            user.Id,
            user.FullName,
            user.TelegramId,
            user.ProfileImage,
            user.NativeLanguageId,
            user.Role,
            user.IsAdmin
        });
    }

    /// <summary>
    /// Foydalanuvchining aktiv rolini (O'qituvchi / Talaba) database darajasida yangilash
    /// </summary>
    [HttpPost("role")]
    [HttpPut("role")]
    public async Task<IActionResult> UpdateRole([FromBody] UpdateRoleRequest req)
    {
        long targetUserId = 0;
        var userIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdString) && long.TryParse(userIdString, out var uid))
        {
            targetUserId = uid;
        }
        else if (req.UserId.HasValue && req.UserId.Value > 0)
        {
            targetUserId = req.UserId.Value;
        }

        if (targetUserId == 0)
        {
            return Unauthorized(new { message = "Foydalanuvchi identifikatsiya qilinmadi" });
        }

        var normalizedRole = req.Role?.Trim();
        if (string.Equals(normalizedRole, "Teacher", StringComparison.OrdinalIgnoreCase))
            normalizedRole = "Teacher";
        else
            normalizedRole = "Student";

        var updatedUser = await _userService.UpdateUserRoleAsync(targetUserId, normalizedRole);
        if (updatedUser == null) return NotFound(new { message = "Foydalanuvchi topilmadi" });

        return Ok(new {
            message = "Foydalanuvchi roli muvaffaqiyatli yangilandi",
            role = updatedUser.Role,
            user = new {
                updatedUser.Id,
                updatedUser.FullName,
                updatedUser.TelegramId,
                updatedUser.ProfileImage,
                updatedUser.NativeLanguageId,
                updatedUser.Role,
                updatedUser.IsAdmin,
                updatedUser.CreatedAt
            }
        });
    }
}

public class UpdateProfileRequest
{
    public string? FullName { get; set; }
}

public class UpdateRoleRequest
{
    public string Role { get; set; } = "Student";
    public long? UserId { get; set; }
}