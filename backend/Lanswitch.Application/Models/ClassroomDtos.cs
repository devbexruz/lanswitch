using System;
using System.Collections.Generic;

namespace Lanswitch.Application.Models;

public class TeacherGroupDto
{
    public long Id { get; set; }
    public long TelegramChatId { get; set; }
    public string Title { get; set; } = null!;
    public bool IsOwner { get; set; }
    public int MemberCount { get; set; }
    public int ActiveAssignmentsCount { get; set; }
}

public class StudentGroupDto
{
    public long Id { get; set; }
    public long TelegramChatId { get; set; }
    public string Title { get; set; } = null!;
}

public class CreateAssignmentItemDto
{
    public int OrderIndex { get; set; }
    public string ItemType { get; set; } = null!; // "TextReminder", "Vocabulary", "MediaSubmission"
    public string Title { get; set; } = null!;
    public string? Instructions { get; set; }
    public long? TargetUnitId { get; set; }
}

public class CreateAssignmentDto
{
    public long GroupId { get; set; }
    public string Title { get; set; } = null!; // Sana yoki Custom Title
    public DateTime Deadline { get; set; }
    public List<CreateAssignmentItemDto> Items { get; set; } = new();
}

public class AssignmentDetailDto
{
    public long Id { get; set; }
    public long GroupId { get; set; }
    public string GroupTitle { get; set; } = null!;
    public string Title { get; set; } = null!;
    public DateTime Deadline { get; set; }
    public string Status { get; set; } = null!;
    public List<AssignmentItemDetailDto> Items { get; set; } = new();
}

public class AssignmentItemDetailDto
{
    public long Id { get; set; }
    public int OrderIndex { get; set; }
    public string ItemType { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Instructions { get; set; }
    public long? TargetUnitId { get; set; }
    public string? TargetUnitTitle { get; set; }
    public string? BookTitle { get; set; }

    // O'quvchi uchun submission holati
    public long? SubmissionId { get; set; }
    public int? MySubmissionStatus { get; set; } // null, 1, 0, 2
    public string? MySubmissionComment { get; set; }
    public DateTime? MySubmittedAt { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
}

public class AttachmentDto
{
    public long Id { get; set; }
    public string? TelegramFileId { get; set; }
    public string FileType { get; set; } = null!;
    public long FileSizeBytes { get; set; }
    public string TelegramDeepLink { get; set; } = null!;
    public string? StreamUrl { get; set; }
}

public class SubmissionReviewDto
{
    public long SubmissionId { get; set; }
    public long AssignmentId { get; set; }
    public string AssignmentTitle { get; set; } = null!;
    public long AssignmentItemId { get; set; }
    public string ItemTitle { get; set; } = null!;
    public string ItemType { get; set; } = null!;
    public long StudentId { get; set; }
    public string StudentName { get; set; } = null!;
    public string? StudentAvatarUrl { get; set; }
    public int? Status { get; set; } // null, 1, 0, 2
    public string? Comment { get; set; }
    public DateTime SubmittedAt { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
}

public class GradeSubmissionDto
{
    public int Status { get; set; } // 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi
    public string? Comment { get; set; }
}

// Vocabulary Quiz DTOs
public class QuizQuestionDto
{
    public long WordId { get; set; }
    public string QuestionText { get; set; } = null!; // English word or Uzbek translation
    public string Direction { get; set; } = "EN_TO_UZ"; // "EN_TO_UZ" or "UZ_TO_EN"
    public string? Ipa { get; set; }
    public List<QuizOptionDto> Options { get; set; } = new();
}

public class QuizOptionDto
{
    public string Text { get; set; } = null!;
    public bool IsCorrect { get; set; }
}

public class SubmitQuizResultDto
{
    public long AssignmentItemId { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectAnswers { get; set; }
}

public class AssignmentSummaryDto
{
    public long Id { get; set; }
    public long GroupId { get; set; }
    public string Title { get; set; } = null!;
    public DateTime Deadline { get; set; }
    public string Status { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public int ItemsCount { get; set; }
    public int TotalMembersCount { get; set; }
    public int SubmittedCount { get; set; }
    public int MissingCount { get; set; }
    public int FullCount { get; set; }
    public int PartialCount { get; set; }
    public int PenaltyCount { get; set; }
}

public class AssignmentReportDto
{
    public long AssignmentId { get; set; }
    public long GroupId { get; set; }
    public string GroupTitle { get; set; } = null!;
    public string Title { get; set; } = null!;
    public DateTime Deadline { get; set; }
    public string Status { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public int TotalMembersCount { get; set; }
    public int SubmittedCount { get; set; }
    public int MissingCount { get; set; }
    public int FullCount { get; set; }
    public int PunishmentCount { get; set; }
    public int PunishedCount { get; set; }
    public List<StudentAssignmentStatusDto> SubmittedStudents { get; set; } = new();
    public List<StudentAssignmentStatusDto> MissingStudents { get; set; } = new();
}

public class StudentAssignmentStatusDto
{
    public long StudentId { get; set; }
    public string FullName { get; set; } = null!;
    public string? Username { get; set; }
    public string? AvatarUrl { get; set; }
    public string? TelegramId { get; set; }
    public bool HasSubmitted { get; set; }
    public int? Status { get; set; } // null = Tekshirilmagan, 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi
    public string? Comment { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public int ItemsCompleted { get; set; }
    public int TotalItems { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<AssignmentItemDetailDto> Items { get; set; } = new();
}

public class SyncMembersResultDto
{
    public int SyncedCount { get; set; }
    public int TotalCount { get; set; }
    public string Message { get; set; } = null!;
}

public class GroupMemberDto
{
    public long StudentId { get; set; }
    public string FullName { get; set; } = null!;
    public string? Username { get; set; }
    public string? AvatarUrl { get; set; }
    public string? TelegramId { get; set; }
    public bool IsActive { get; set; }
    public DateTime JoinedAt { get; set; }
}

public class StudentReviewGroupDto
{
    public long StudentId { get; set; }
    public string StudentName { get; set; } = null!;
    public string? StudentAvatarUrl { get; set; }
    public long AssignmentId { get; set; }
    public string AssignmentTitle { get; set; } = null!;
    public DateTime LatestSubmittedAt { get; set; }
    public int? OverallStatus { get; set; }
    public List<ReviewItemDetailDto> Items { get; set; } = new();
}

public class ReviewItemDetailDto
{
    public long SubmissionId { get; set; }
    public long AssignmentItemId { get; set; }
    public string ItemTitle { get; set; } = null!;
    public string ItemType { get; set; } = null!;
    public int? Status { get; set; }
    public string? Comment { get; set; }
    public DateTime SubmittedAt { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
}

public class StudentTimelineAssignmentDto
{
    public long AssignmentId { get; set; }
    public string Title { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime Deadline { get; set; }
    public int? OverallStatus { get; set; }
    public List<AssignmentItemDetailDto> Items { get; set; } = new();
}

public class PrepareUploadResultDto
{
    public bool Success { get; set; }
    public string BotUsername { get; set; } = null!;
    public string BotUrl { get; set; } = null!;
    public string? Message { get; set; }
}



