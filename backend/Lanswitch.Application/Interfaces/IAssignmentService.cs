using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IAssignmentService
{
    Task<Assignment> CreateAssignmentAsync(long teacherId, CreateAssignmentDto dto);
    Task<bool> PublishAssignmentAsync(long assignmentId, long teacherId);
    Task<List<AssignmentDetailDto>> GetStudentAssignmentsAsync(long groupId, long studentId, string filter);
    Task<List<SubmissionReviewDto>> GetTeacherSubmissionsAsync(long groupId, long teacherId, string? filter);
    Task<bool> GradeItemSubmissionAsync(long submissionId, long teacherId, GradeSubmissionDto dto);
    Task<AssignmentItemSubmission> SubmitMediaItemAsync(long studentId, long assignmentItemId, List<AttachmentDto> attachments);
    Task<AssignmentItemSubmission> SubmitQuizResultAsync(long studentId, SubmitQuizResultDto dto);
    Task<bool> CheckTextReminderAsync(long assignmentItemId, long studentId, long teacherId);
    Task<List<AssignmentSummaryDto>> GetGroupAssignmentsAsync(long groupId, long teacherId);
    Task<AssignmentReportDto?> GetAssignmentReportAsync(long assignmentId, long teacherId);
    Task<bool> RemindMissingStudentsAsync(long assignmentId, long teacherId);
    Task<List<StudentReviewGroupDto>> GetTeacherReviewGroupsAsync(long groupId, long teacherId, string? filter);
    Task<List<StudentTimelineAssignmentDto>> GetStudentTimelineHistoryAsync(long groupId, long studentId);
    Task<bool> ToggleStudentAssignmentStatusAsync(long assignmentId, long studentId, bool isCompleted, long teacherId);
    Task<bool> SetStudentAssignmentStatusAsync(long assignmentId, long studentId, int status, long teacherId, string? comment = null);
    Task<bool> GradeStudentItemAsync(long assignmentId, long itemId, long studentId, int status, long teacherId, string? comment = null);
    Task<bool> DeleteAttachmentAsync(long attachmentId, long studentOrTeacherId);
    Task<bool> UpdateAssignmentAsync(long assignmentId, long teacherId, UpdateAssignmentDto dto);
    Task<bool> DeleteAssignmentAsync(long assignmentId, long teacherId);
    Task<PrepareUploadResultDto> PrepareMediaUploadAsync(long itemId, long studentId);
    Task<SendAttachmentResultDto> SendAttachmentToTelegramAsync(long attachmentId, long userId);
}


