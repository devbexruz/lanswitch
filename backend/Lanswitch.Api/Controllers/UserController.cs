using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

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

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
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
            user.IsAdmin,
            user.CreatedAt
        });
    }

    [HttpPut("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
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
            user.IsAdmin
        });
    }
}

public class UpdateProfileRequest
{
    public string? FullName { get; set; }
}