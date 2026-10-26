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
    private readonly IArchiveDatabaseService _archiveDb;

    public GroupService(AppDbContext db, ITelegramBotClient botClient, IArchiveDatabaseService archiveDb)
    {
        _db = db;
        _botClient = botClient;
        _archiveDb = archiveDb;
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

        var activeTeacherSubs = await _db.UserSubscriptions
            .Where(s => ownerIds.Contains(s.UserId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .ToListAsync();

        var allActiveGroupCounts = await _db.TelegramGroups
            .Where(g => g.IsActive && ownerIds.Contains(g.OwnerId))
            .GroupBy(g => g.OwnerId)
            .Select(g => new { OwnerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OwnerId, x => x.Count);

        return groups.Select(g =>
        {
            int currentCount = allActiveGroupCounts.GetValueOrDefault(g.OwnerId, 0);
            int maxLimit = 0;
            bool isLimitExceeded = false;
            bool isExpired = false;

            if (adminOwnerIds.Contains(g.OwnerId))
            {
                maxLimit = 9999;
                isLimitExceeded = false;
                isExpired = false;
            }
            else
            {
                var sub = activeTeacherSubs.FirstOrDefault(s => s.UserId == g.OwnerId);
                if (sub == null)
                {
                    maxLimit = 0;
                    isLimitExceeded = false;
                    isExpired = true; // Obuna faol emas yoki mavjud emas
                }
                else
                {
                    maxLimit = sub.MaxGroups;
                    // Tarif limitidan oshganda hech qaysi guruh ishlamasligi lozim!
                    if (currentCount > maxLimit)
                    {
                        isLimitExceeded = true;
                        isExpired = true;
                    }
                }
            }

            return new TeacherGroupDto
            {
                Id = g.Id,
                TelegramChatId = g.TelegramChatId,
                Title = g.Title,
                IsOwner = g.OwnerId == teacherId,
                MemberCount = g.Members.Count(m => m.IsActive),
                ActiveAssignmentsCount = g.Assignments.Count(a => a.Status == "Published"),
                IsSubscriptionExpired = isExpired,
                IsGroupLimitExceeded = isLimitExceeded,
                GroupLimit = maxLimit,
                CurrentGroupCount = currentCount
            };
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
        var group = await _db.TelegramGroups.FirstOrDefaultAsync(g => g.Id == groupId && g.OwnerId == ownerId && g.IsActive);
        if (group == null) return false;

        var now = System.DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(ownerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => s.UserId == ownerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null)
            throw new System.InvalidOperationException("Guruh adminlarini boshqarish faqat 'Ustoz' tarifida mavjud!");

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
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null) return false;
        bool canManage = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanManageMembers);
        if (!canManage) return false;

        var now = System.DateTime.UtcNow;
        var caller = await _db.Users.FindAsync(teacherId);
        var owner = group.OwnerId == teacherId ? caller : await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true || caller?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => (s.UserId == group.OwnerId || s.UserId == teacherId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null)
            throw new System.InvalidOperationException("O'quvchilarni guruhdan chiqarish faqat 'Ustoz' tarifida mavjud!");

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
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null) return false;
        bool canManage = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanManageMembers);
        if (!canManage) return false;

        var now = System.DateTime.UtcNow;
        var caller = await _db.Users.FindAsync(teacherId);
        var owner = group.OwnerId == teacherId ? caller : await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true || caller?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => (s.UserId == group.OwnerId || s.UserId == teacherId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null)
            throw new System.InvalidOperationException("O'quvchilarni guruhga qayta qo'shish faqat 'Ustoz' tarifida mavjud!");

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

        var activeTeacherSubs = await _db.UserSubscriptions
            .Where(s => ownerIds.Contains(s.UserId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .ToListAsync();

        var allActiveGroupCounts = await _db.TelegramGroups
            .Where(g => g.IsActive && ownerIds.Contains(g.OwnerId))
            .GroupBy(g => g.OwnerId)
            .Select(g => new { OwnerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OwnerId, x => x.Count);

        return members.Select(gm =>
        {
            var ownerId = gm.Group.OwnerId;
            bool isExpired = true;

            if (adminOwnerIds.Contains(ownerId))
            {
                isExpired = false;
            }
            else
            {
                var sub = activeTeacherSubs.FirstOrDefault(s => s.UserId == ownerId);
                if (sub != null)
                {
                    int currentCount = allActiveGroupCounts.GetValueOrDefault(ownerId, 0);
                    // limitdan oshmagan bo'lsagina ishlaydi
                    isExpired = currentCount > sub.MaxGroups;
                }
            }

            return new StudentGroupDto
            {
                Id = gm.Group.Id,
                TelegramChatId = gm.Group.TelegramChatId,
                Title = gm.Group.Title,
                IsTeacherSubscriptionExpired = isExpired
            };
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

        var now = System.DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null)
        {
            var activeStudentSub = await _db.UserSubscriptions
                .Where(s => (s.UserId == group.OwnerId || s.UserId == teacherId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Student")
                .FirstOrDefaultAsync();

            if (activeStudentSub != null)
            {
                throw new System.InvalidOperationException("Guruh a'zolarini yangilash va sinxronlash faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new System.InvalidOperationException("Guruh egasining 'Ustoz' tarifi muddati tugagan yoki faol emas.");
        }

        if (!isOwnerAdmin && activeTeacherSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeTeacherSub.MaxGroups)
            {
                throw new System.InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeTeacherSub.MaxGroups} ta) ko'p! Guruhlarni ishlatish uchun ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling.");
            }
        }

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

    public async Task<bool> DeleteGroupAsync(long groupId, long teacherId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Owner)
            .Include(g => g.Admins)
            .Include(g => g.Members).ThenInclude(m => m.Student)
            .Include(g => g.Assignments).ThenInclude(a => a.Items).ThenInclude(i => i.Submissions).ThenInclude(s => s.Attachments)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
            throw new System.InvalidOperationException("Guruh topilmadi!");

        var user = await _db.Users.FindAsync(teacherId);
        bool isAdmin = user?.IsAdmin == true;
        bool isOwner = group.OwnerId == teacherId;

        if (!isOwner && !isAdmin)
            throw new System.UnauthorizedAccessException("Sizda faqat o'zingizga tegishli guruhni o'chirish huquqi mavjud!");

        // 1. Prepare archive snapshot of all related data
        var archiveSnapshot = new
        {
            GroupId = group.Id,
            TelegramChatId = group.TelegramChatId,
            Title = group.Title,
            OwnerId = group.OwnerId,
            OwnerName = group.Owner?.FullName,
            CreatedAt = group.CreatedAt,
            Admins = group.Admins.Select(a => new
            {
                a.Id,
                a.UserId,
                a.CanCreateHomework,
                a.CanReviewHomework
            }),
            Members = group.Members.Select(m => new
            {
                m.Id,
                m.StudentId,
                StudentName = m.Student?.FullName,
                m.IsActive,
                m.JoinedAt
            }),
            Assignments = group.Assignments.Select(a => new
            {
                a.Id,
                a.Title,
                a.Deadline,
                a.Status,
                a.CreatedAt,
                Items = a.Items.Select(i => new
                {
                    i.Id,
                    i.OrderIndex,
                    i.ItemType,
                    i.Title,
                    i.Instructions,
                    i.TargetUnitId,
                    Submissions = i.Submissions.Select(s => new
                    {
                        s.Id,
                        s.StudentId,
                        s.Status,
                        s.Comment,
                        s.ReviewedById,
                        s.ReviewedAt,
                        Attachments = s.Attachments.Select(att => new { att.Id, att.TelegramFileId, att.FileType, att.FileSizeBytes, att.TelegramDeepLink })
                    })
                })
            })
        };

        // 2. Save snapshot to separate archive SQLite database
        await _archiveDb.ArchiveAsync("TelegramGroup", group.Id, group.Title, group.OwnerId, teacherId, archiveSnapshot, "UserDeletedGroup");

        // 3. Mark as inactive in primary database so active limits decrement immediately
        group.IsActive = false;
        foreach (var m in group.Members)
        {
            m.IsActive = false;
        }
        foreach (var a in group.Assignments)
        {
            a.Status = "Archived";
        }

        await _db.SaveChangesAsync();

        // 4. Bot leaves Telegram group gracefully
        try
        {
            await _botClient.LeaveChat(group.TelegramChatId);
        }
        catch { }

        return true;
    }
}

