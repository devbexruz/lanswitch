using System.Security.Claims;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/v1/groups")]
public class GroupsController : ControllerBase
{
    private readonly IGroupService _groupService;
    private readonly IArchiveDatabaseService _archiveDb;

    public GroupsController(IGroupService groupService, IArchiveDatabaseService archiveDb)
    {
        _groupService = groupService;
        _archiveDb = archiveDb;
    }

    private long GetUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(idClaim) && long.TryParse(idClaim, out var id))
            return id;

        // Agar query yoki headerda userId uzatilgan bo'lsa (TMA / dev rejim uchun)
        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && long.TryParse(headerVal, out var headerId))
            return headerId;

        return 0;
    }

    /// <summary>
    /// O'qituvchi guruhlari: All, Owned, Admin
    /// </summary>
    [HttpGet("teacher")]
    public async Task<IActionResult> GetTeacherGroups([FromQuery] string tab = "All", [FromQuery] long? teacherId = null)
    {
        var id = teacherId ?? GetUserId();
        if (id == 0) return Unauthorized(new { message = "User ID not identified" });

        var groups = await _groupService.GetTeacherGroupsAsync(id, tab);
        return Ok(groups);
    }

    /// <summary>
    /// Guruh detallari va o'quvchilar ro'yxati
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetGroupDetails(long id, [FromQuery] long? userId = null)
    {
        var uId = userId ?? GetUserId();
        var details = await _groupService.GetGroupDetailsAsync(id, uId);
        if (details == null) return NotFound(new { message = "Group not found or access denied" });

        return Ok(details);
    }

    /// <summary>
    /// Guruhdagi barcha o'quvchilar
    /// </summary>
    [HttpGet("{id}/members")]
    public async Task<IActionResult> GetGroupMembers(long id)
    {
        var members = await _groupService.GetGroupMembersAsync(id);
        return Ok(members);
    }

    /// <summary>
    /// Guruhdagi barcha o'quvchilar DTO ro'yxati (o'chirilganlarni ham ko'rish imkoni bilan)
    /// </summary>
    [HttpGet("{id}/members-list")]
    public async Task<IActionResult> GetGroupMembersList(long id, [FromQuery] bool includeInactive = false)
    {
        var members = await _groupService.GetGroupMembersListAsync(id, includeInactive);
        return Ok(members);
    }

    /// <summary>
    /// O'quvchi a'zo bo'lgan guruhlar ro'yxati (TMA Switcher uchun)
    /// </summary>
    [HttpGet("student")]
    public async Task<IActionResult> GetStudentGroups([FromQuery] long? studentId = null)
    {
        var id = studentId ?? GetUserId();
        if (id == 0) return Unauthorized(new { message = "Student ID not identified" });

        var groups = await _groupService.GetStudentGroupsAsync(id);
        return Ok(groups);
    }

    /// <summary>
    /// Admin ruxsatlarini boshqarish yoki yangi admin tayinlash
    /// </summary>
    [HttpPost("{id}/admins")]
    public async Task<IActionResult> ManageAdmin(long id, [FromBody] ManageAdminRequest req, [FromQuery] long? ownerId = null)
    {
        var oId = ownerId ?? GetUserId();
        var success = await _groupService.ManageAdminAsync(id, oId, req.TargetUserId, req.CanCreateHomework, req.CanReviewHomework, req.CanManageMembers);
        if (!success) return BadRequest(new { message = "Failed to update admin permissions" });

        return Ok(new { success = true });
    }

    /// <summary>
    /// Guruhni o'chirish (Soft delete va barcha ma'lumotlarni alohida SQLite arxiv bazaga saqlash)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGroup(long id, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var success = await _groupService.DeleteGroupAsync(id, tId);
        if (!success) return BadRequest(new { message = "Guruh topilmadi yoki uni o'chirish uchun sizda ruxsat yo'q!" });

        return Ok(new { success = true });
    }

    /// <summary>
    /// O'quvchini guruhdan chiqarish (soft delete - tizimda ko'rinmaydi)
    /// </summary>
    [HttpDelete("{id}/members/{studentId}")]
    public async Task<IActionResult> RemoveMember(long id, long studentId, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        var success = await _groupService.RemoveMemberAsync(id, tId, studentId);
        if (!success) return BadRequest(new { message = "Failed to remove member" });

        return Ok(new { success = true });
    }

    /// <summary>
    /// O'chirilgan o'quvchini guruhga qayta qo'shish (restore)
    /// </summary>
    [HttpPost("{id}/members/{studentId}/restore")]
    public async Task<IActionResult> RestoreMember(long id, long studentId, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        var success = await _groupService.RestoreMemberAsync(id, tId, studentId);
        if (!success) return BadRequest(new { message = "Failed to restore member" });

        return Ok(new { success = true });
    }

    /// <summary>
    /// Guruhdagi yangi start bosgan o'quvchilarni sinxronlab bazaga qo'shish
    /// </summary>
    [HttpPost("{id}/sync-members")]
    public async Task<IActionResult> SyncMembers(long id, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var result = await _groupService.SyncGroupMembersAsync(id, tId);
            return Ok(result);
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// O'chirilgan ma'lumotlar arxivini ko'rish (SQLite DB dan)
    /// </summary>
    [HttpGet("archives")]
    public async Task<IActionResult> GetArchives([FromQuery] string? entityType = null, [FromQuery] int limit = 50)
    {
        var archives = await _archiveDb.GetArchivesAsync(entityType, limit);
        return Ok(archives);
    }

    /// <summary>
    /// Arxivdagi eski yozuvlarni tozalash (masalan, 30 yoki 90 kundan oshganlarni qo'lda tozalash)
    /// </summary>
    [HttpPost("archives/cleanup")]
    public async Task<IActionResult> CleanupArchives([FromQuery] int olderThanDays = 30)
    {
        var count = await _archiveDb.CleanupArchivesOlderThanDaysAsync(olderThanDays);
        return Ok(new { deletedCount = count, message = $"{olderThanDays} kundan eski bo'lgan {count} ta arxiv yozuvi tozalandi." });
    }
}

public class ManageAdminRequest
{
    public long TargetUserId { get; set; }
    public bool CanCreateHomework { get; set; } = true;
    public bool CanReviewHomework { get; set; } = true;
    public bool CanManageMembers { get; set; } = true;
}
