using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;

namespace Lanswitch.Infrastructure.Services;

public class GroupService : IGroupService
{
    private readonly AppDbContext _db;
    private readonly ITelegramBotClient _botClient;

    public GroupService(AppDbContext db, ITelegramBotClient botClient)
    {
        _db = db;
        _botClient = botClient;
    }

    public async Task<List<TeacherGroupDto>> GetTeacherGroupsAsync(long teacherId, string tab)
    {
        var query = _db.TelegramGroups
            .Include(g => g.Admins)
            .Include(g => g.Members)
            .Include(g => g.Assignments)
            .Where(g => g.IsActive);

        if (string.Equals(tab, "Owned", System.StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(g => g.OwnerId == teacherId);
        }
        else if (string.Equals(tab, "Admin", System.StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(g => g.OwnerId != teacherId && g.Admins.Any(a => a.UserId == teacherId));
        }
        else // "All"
        {
            query = query.Where(g => g.OwnerId == teacherId || g.Admins.Any(a => a.UserId == teacherId));
        }

        var groups = await query.ToListAsync();

        var now = System.DateTime.UtcNow;
        var ownerIds = groups.Select(g => g.OwnerId).Distinct().ToList();

        var adminOwnerIds = await _db.Users
            .Where(u => ownerIds.Contains(u.Id) && u.IsAdmin)
            .Select(u => u.Id)
            .ToListAsync();

        var activeTeacherSubOwnerIds = await _db.UserSubscriptions
            .Where(s => ownerIds.Contains(s.UserId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .Select(s => s.UserId)
            .ToListAsync();

        var validOwnerIds = new HashSet<long>(adminOwnerIds.Concat(activeTeacherSubOwnerIds));

        return groups.Select(g => new TeacherGroupDto
        {
            Id = g.Id,
            TelegramChatId = g.TelegramChatId,
            Title = g.Title,
            IsOwner = g.OwnerId == teacherId,
            MemberCount = g.Members.Count(m => m.IsActive),
            ActiveAssignmentsCount = g.Assignments.Count(a => a.Status == "Published"),
            IsSubscriptionExpired = !validOwnerIds.Contains(g.OwnerId)
        }).ToList();
    }

    public async Task<TelegramGroup?> GetGroupDetailsAsync(long groupId, long userId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Owner)
            .Include(g => g.Admins).ThenInclude(a => a.User)
            .Include(g => g.Members).ThenInclude(m => m.Student)
            .Include(g => g.Assignments).ThenInclude(a => a.Items)
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null) return null;

        bool hasAccess = group.OwnerId == userId || group.Admins.Any(a => a.UserId == userId);
        return hasAccess ? group : null;
    }

    public async Task<List<GroupMember>> GetGroupMembersAsync(long groupId)
    {
        return await _db.GroupMembers
            .Include(gm => gm.Student)
            .Where(gm => gm.GroupId == groupId && gm.IsActive)
            .OrderBy(gm => gm.Student.FullName)
            .ToListAsync();
    }

    public async Task<List<GroupMemberDto>> GetGroupMembersListAsync(long groupId, bool includeInactive = false)
    {
        var query = _db.GroupMembers
            .Include(gm => gm.Student)
            .Where(gm => gm.GroupId == groupId);

        if (!includeInactive)
        {
            query = query.Where(gm => gm.IsActive);
        }

        var members = await query.OrderBy(gm => gm.Student.FullName).ToListAsync();

        return members.Select(gm => new GroupMemberDto
        {
            StudentId = gm.StudentId,
            FullName = gm.Student.FullName,
            Username = gm.Student.Username,
            AvatarUrl = gm.Student.AvatarUrl ?? gm.Student.ProfileImage,
            TelegramId = gm.Student.TelegramId,
            IsActive = gm.IsActive,
            JoinedAt = gm.JoinedAt
        }).ToList();
    }

    public async Task<bool> ManageAdminAsync(long groupId, long ownerId, long targetUserId, bool canCreate, bool canReview, bool canManage)
    {
        var group = await _db.TelegramGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.OwnerId == ownerId);
        if (group == null) return false;

        var admin = await _db.GroupAdmins.FirstOrDefaultAsync(ga => ga.GroupId == groupId && ga.UserId == targetUserId);
        if (admin == null)
        {
            admin = new GroupAdmin
            {
                GroupId = groupId,
                UserId = targetUserId,
                IsOwner = false,
                CanCreateHomework = canCreate,
                CanReviewHomework = canReview,
                CanManageMembers = canManage
            };
            _db.GroupAdmins.Add(admin);
        }
        else
        {
            admin.CanCreateHomework = canCreate;
            admin.CanReviewHomework = canReview;
            admin.CanManageMembers = canManage;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveMemberAsync(long groupId, long teacherId, long studentId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return false;
        bool canManage = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanManageMembers);
        if (!canManage) return false;

        var member = await _db.GroupMembers.FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.StudentId == studentId);
        if (member != null)
        {
            member.IsActive = false;
            await _db.SaveChangesAsync();
        }

        return true;
    }

    public async Task<bool> RestoreMemberAsync(long groupId, long teacherId, long studentId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return false;
        bool canManage = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanManageMembers);
        if (!canManage) return false;

        var member = await _db.GroupMembers.FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.StudentId == studentId);
        if (member != null)
        {
            member.IsActive = true;
            await _db.SaveChangesAsync();
        }
        else
        {
            _db.GroupMembers.Add(new GroupMember
            {
                GroupId = groupId,
                StudentId = studentId,
                IsActive = true,
                JoinedAt = System.DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        return true;
    }

    public async Task<List<StudentGroupDto>> GetStudentGroupsAsync(long studentId)
    {
        var members = await _db.GroupMembers
            .Include(gm => gm.Group)
            .Where(gm => gm.StudentId == studentId && gm.IsActive && gm.Group.IsActive)
            .ToListAsync();

        var now = System.DateTime.UtcNow;
        var ownerIds = members.Select(gm => gm.Group.OwnerId).Distinct().ToList();

        var adminOwnerIds = await _db.Users
            .Where(u => ownerIds.Contains(u.Id) && u.IsAdmin)
            .Select(u => u.Id)
            .ToListAsync();

        var activeTeacherSubOwnerIds = await _db.UserSubscriptions
            .Where(s => ownerIds.Contains(s.UserId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .Select(s => s.UserId)
            .ToListAsync();

        var validOwnerIds = new HashSet<long>(adminOwnerIds.Concat(activeTeacherSubOwnerIds));

        return members.Select(gm => new StudentGroupDto
        {
            Id = gm.Group.Id,
            TelegramChatId = gm.Group.TelegramChatId,
            Title = gm.Group.Title,
            IsTeacherSubscriptionExpired = !validOwnerIds.Contains(gm.Group.OwnerId)
        }).ToList();
    }

    public async Task<SyncMembersResultDto> SyncGroupMembersAsync(long groupId, long teacherId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null)
            throw new System.InvalidOperationException("Guruh topilmadi!");

        bool hasAccess = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId);
        if (!hasAccess)
            throw new System.UnauthorizedAccessException("Sizda bu guruh a'zolarini yangilash huquqi yo'q!");

        int syncedCount = 0;
        var usersWithTg = await _db.Users
            .Where(u => !string.IsNullOrEmpty(u.TelegramId))
            .ToListAsync();

        foreach (var u in usersWithTg)
        {
            if (!long.TryParse(u.TelegramId, out long tgUserId)) continue;

            try
            {
                var member = await _botClient.GetChatMember(group.TelegramChatId, tgUserId);
                if (member.Status == Telegram.Bot.Types.Enums.ChatMemberStatus.Member ||
                    member.Status == Telegram.Bot.Types.Enums.ChatMemberStatus.Administrator ||
                    member.Status == Telegram.Bot.Types.Enums.ChatMemberStatus.Creator)
                {
                    var existing = group.Members.FirstOrDefault(m => m.StudentId == u.Id);
                    if (existing == null)
                    {
                        var newMember = new GroupMember
                        {
                            GroupId = group.Id,
                            StudentId = u.Id,
                            IsActive = true,
                            JoinedAt = System.DateTime.UtcNow
                        };
                        _db.GroupMembers.Add(newMember);
                        group.Members.Add(newMember);
                        syncedCount++;
                    }
                    // If existing is inactive, do NOT auto-resurrect during bulk sync (teacher intentionally removed them)
                }
            }
            catch
            {
                // Not in group or chat not accessible
            }
        }

        await _db.SaveChangesAsync();

        int totalCount = group.Members.Count(m => m.IsActive);
        return new SyncMembersResultDto
        {
            SyncedCount = syncedCount,
            TotalCount = totalCount,
            Message = syncedCount > 0 
                ? $"{syncedCount} ta yangi o'quvchi guruhga muvaffaqiyatli qo'shildi!" 
                : "Barcha yangi start bosgan o'quvchilar allaqachon sinxronlangan."
        };
    }
}

