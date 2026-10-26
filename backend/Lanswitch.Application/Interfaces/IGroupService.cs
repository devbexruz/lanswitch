using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IGroupService
{
    Task<List<TeacherGroupDto>> GetTeacherGroupsAsync(long teacherId, string tab);
    Task<TelegramGroup?> GetGroupDetailsAsync(long groupId, long userId);
    Task<List<GroupMember>> GetGroupMembersAsync(long groupId);
    Task<List<GroupMemberDto>> GetGroupMembersListAsync(long groupId, bool includeInactive = false);
    Task<bool> ManageAdminAsync(long groupId, long ownerId, long targetUserId, bool canCreate, bool canReview, bool canManage);
    Task<bool> RemoveMemberAsync(long groupId, long teacherId, long studentId);
    Task<bool> RestoreMemberAsync(long groupId, long teacherId, long studentId);
    Task<List<StudentGroupDto>> GetStudentGroupsAsync(long studentId);
    Task<SyncMembersResultDto> SyncGroupMembersAsync(long groupId, long teacherId);
    Task<bool> DeleteGroupAsync(long groupId, long teacherId);
}

