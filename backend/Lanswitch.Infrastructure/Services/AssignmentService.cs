using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Telegram.Bot;
using Telegram.Bot.Types.ReplyMarkups;

namespace Lanswitch.Infrastructure.Services;

public class AssignmentService : IAssignmentService
{
    private readonly AppDbContext _db;
    private readonly ITelegramBotClient _botClient;
    private readonly IConfiguration _config;

    public AssignmentService(AppDbContext db, ITelegramBotClient botClient, IConfiguration config)
    {
        _db = db;
        _botClient = botClient;
        _config = config;
    }

    public async Task<Assignment> CreateAssignmentAsync(long teacherId, CreateAssignmentDto dto)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == dto.GroupId);

        if (group == null)
            throw new InvalidOperationException("Guruh topilmadi!");

        bool canCreate = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanCreateHomework);
        if (!canCreate)
            throw new UnauthorizedAccessException("Sizda ushbu guruhga vazifa qo'shish huquqi yo'q!");

        var assignment = new Assignment
        {
            GroupId = dto.GroupId,
            CreatorId = teacherId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? $"{DateTime.UtcNow:dd.MM.yyyy} Lesson" : dto.Title,
            Deadline = dto.Deadline,
            Status = "Published"
        };

        int order = 1;
        foreach (var item in dto.Items)
        {
            assignment.Items.Add(new AssignmentItem
            {
                OrderIndex = order++,
                ItemType = item.ItemType,
                Title = item.Title,
                Instructions = item.Instructions,
                TargetUnitId = item.TargetUnitId
            });
        }

        _db.Assignments.Add(assignment);
        await _db.SaveChangesAsync();

        // Guruhga va o'quvchilarga bildirishnoma yuborish
        await PublishAssignmentAsync(assignment.Id, teacherId);

        return assignment;
    }

    public async Task<bool> PublishAssignmentAsync(long assignmentId, long teacherId)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group).ThenInclude(g => g.Members).ThenInclude(m => m.Student)
            .Include(a => a.Items)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return false;

        var webAppUrl = _config["Frontend:TmaUrl"] ?? "https://lanswitch.uz/tma";
        var tmaButtonUrl = $"{webAppUrl}?assignment_id={assignment.Id}&group_id={assignment.GroupId}";

        var inlineKeyboard = new InlineKeyboardMarkup(new[]
        {
            new[] { InlineKeyboardButton.WithWebApp("📝 Vazifani Bajarish", new Telegram.Bot.Types.WebAppInfo { Url = tmaButtonUrl }) }
        });

        var messageText = $"📢 <b>YANGI UYGA VAZIFA!</b>\n\n" +
                          $"📚 <b>Guruh:</b> {assignment.Group.Title}\n" +
                          $"📌 <b>Dars:</b> {assignment.Title}\n" +
                          $"⏰ <b>Topshirish muddati:</b> {assignment.Deadline:dd.MM.yyyy HH:mm}\n" +
                          $"🔢 <b>Qismlar soni:</b> {assignment.Items.Count} ta qism\n\n" +
                          $"<i>Bajarish uchun quyidagi tugmani bosing 👇</i>";

        // 1. Telegram guruhga yuborish
        try
        {
            await _botClient.SendMessage(
                chatId: assignment.Group.TelegramChatId,
                text: messageText,
                parseMode: Telegram.Bot.Types.Enums.ParseMode.Html,
                replyMarkup: inlineKeyboard);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Guruhga xabar yuborishda xatolik: {ex.Message}");
        }

        // 2. Start bosgan o'quvchilarning shaxsiy chatiga yuborish
        var activeMembers = assignment.Group.Members.Where(m => m.IsActive).ToList();
        foreach (var member in activeMembers)
        {
            if (long.TryParse(member.Student.TelegramId, out long studentTelegramId))
            {
                try
                {
                    await _botClient.SendMessage(
                        chatId: studentTelegramId,
                        text: messageText,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Html,
                        replyMarkup: inlineKeyboard);
                }
                catch
                {
                    // Foydalanuvchi botni bloklagan bo'lishi mumkin, davom etaveradi
                }
            }
        }

        return true;
    }

    public async Task<List<AssignmentDetailDto>> GetStudentAssignmentsAsync(long groupId, long studentId, string filter)
    {
        var query = _db.Assignments
            .Include(a => a.Group)
            .Include(a => a.Items).ThenInclude(i => i.TargetUnit).ThenInclude(u => u!.Part).ThenInclude(p => p.Book)
            .Include(a => a.Items).ThenInclude(i => i.Submissions.Where(s => s.StudentId == studentId)).ThenInclude(s => s.Attachments)
            .Where(a => a.GroupId == groupId && a.Status == "Published");

        var assignments = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();

        var result = new List<AssignmentDetailDto>();

        foreach (var a in assignments)
        {
            var itemDtos = new List<AssignmentItemDetailDto>();
            foreach (var item in a.Items.OrderBy(i => i.OrderIndex))
            {
                var mySub = item.Submissions.FirstOrDefault(s => s.StudentId == studentId);
                itemDtos.Add(new AssignmentItemDetailDto
                {
                    Id = item.Id,
                    OrderIndex = item.OrderIndex,
                    ItemType = item.ItemType,
                    Title = item.Title,
                    Instructions = item.Instructions,
                    TargetUnitId = item.TargetUnitId,
                    TargetUnitTitle = item.TargetUnit?.Title,
                    BookTitle = item.TargetUnit?.Part?.Book?.Title,
                    SubmissionId = mySub?.Id,
                    MySubmissionStatus = mySub?.Status,
                    MySubmissionComment = mySub?.Comment,
                    MySubmittedAt = mySub?.SubmittedAt,
                    Attachments = mySub?.Attachments.Select(att => new AttachmentDto
                    {
                        Id = att.Id,
                        TelegramFileId = att.TelegramFileId,
                        FileType = att.FileType,
                        FileSizeBytes = att.FileSizeBytes,
                        TelegramDeepLink = att.TelegramDeepLink,
                        StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
                    }).ToList() ?? new()
                });
            }

            var dto = new AssignmentDetailDto
            {
                Id = a.Id,
                GroupId = a.GroupId,
                GroupTitle = a.Group.Title,
                Title = a.Title,
                Deadline = a.Deadline,
                Status = a.Status,
                Items = itemDtos
            };

            // 5 Filtr turlari bo'yicha saralash
            if (string.Equals(filter, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                // Barcha qismlari Bajarildi (1) yoki Jarima Bajarildi (2) bo'lganlar
                if (itemDtos.All(i => i.MySubmissionStatus == 1 || i.MySubmissionStatus == 2))
                    result.Add(dto);
            }
            else if (string.Equals(filter, "Penalty", StringComparison.OrdinalIgnoreCase))
            {
                // Kamida bitta qismida Jarima (0) bo'lganlar
                if (itemDtos.Any(i => i.MySubmissionStatus == 0))
                    result.Add(dto);
            }
            else if (string.Equals(filter, "Unchecked", StringComparison.OrdinalIgnoreCase))
            {
                // Topshirilgan, lekin statusi hali belgilanmagan (null)
                if (itemDtos.Any(i => i.MySubmittedAt.HasValue && !i.MySubmissionStatus.HasValue))
                    result.Add(dto);
            }
            else if (string.Equals(filter, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                // Hali topshirilmagan qismi bor bo'lganlar
                if (itemDtos.Any(i => !i.MySubmittedAt.HasValue))
                    result.Add(dto);
            }
            else // "All"
            {
                result.Add(dto);
            }
        }

        return result;
    }

    public async Task<List<SubmissionReviewDto>> GetTeacherSubmissionsAsync(long groupId, long teacherId, string? filter)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return new();
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return new();

        var query = _db.AssignmentItemSubmissions
            .Include(s => s.Assignment)
            .Include(s => s.AssignmentItem)
            .Include(s => s.Student)
            .Include(s => s.Attachments)
            .Where(s => s.Assignment.GroupId == groupId);

        if (string.Equals(filter, "Unchecked", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == null);
        }
        else if (string.Equals(filter, "Penalty", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == 0);
        }
        else if (string.Equals(filter, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == 1 || s.Status == 2);
        }

        var submissions = await query.OrderByDescending(s => s.SubmittedAt).ToListAsync();

        return submissions.Select(s => new SubmissionReviewDto
        {
            SubmissionId = s.Id,
            AssignmentId = s.AssignmentId,
            AssignmentTitle = s.Assignment.Title,
            AssignmentItemId = s.AssignmentItemId,
            ItemTitle = s.AssignmentItem.Title,
            ItemType = s.AssignmentItem.ItemType,
            StudentId = s.StudentId,
            StudentName = s.Student.FullName,
            StudentAvatarUrl = s.Student.AvatarUrl,
            Status = s.Status,
            Comment = s.Comment,
            SubmittedAt = s.SubmittedAt,
            Attachments = s.Attachments.Select(att => new AttachmentDto
            {
                Id = att.Id,
                TelegramFileId = att.TelegramFileId,
                FileType = att.FileType,
                FileSizeBytes = att.FileSizeBytes,
                TelegramDeepLink = att.TelegramDeepLink,
                StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
            }).ToList()
        }).ToList();
    }

    public async Task<bool> GradeItemSubmissionAsync(long submissionId, long teacherId, GradeSubmissionDto dto)
    {
        var sub = await _db.AssignmentItemSubmissions
            .Include(s => s.Assignment).ThenInclude(a => a.Group).ThenInclude(g => g.Admins)
            .Include(s => s.AssignmentItem)
            .Include(s => s.Student)
            .FirstOrDefaultAsync(s => s.Id == submissionId);

        if (sub == null) return false;

        var group = sub.Assignment.Group;
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        if (dto.Status == 0 && string.IsNullOrWhiteSpace(dto.Comment))
        {
            throw new InvalidOperationException("Punishment (Jarima) belgilash uchun jazo izohi yozilishi shart!");
        }

        sub.Status = dto.Status; // 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi
        sub.Comment = dto.Comment?.Trim();
        sub.ReviewedById = teacherId;
        sub.ReviewedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // O'quvchiga Telegram bot orqali natijani yuborish
        if (long.TryParse(sub.Student.TelegramId, out long studentTelegramId))
        {
            string statusIcon = dto.Status switch
            {
                1 => "✅ Bajarildi (1)",
                0 => "❌ Jarima (0)",
                2 => "⚠️ Jarima Bajarildi (2)",
                _ => "Tekshirildi"
            };

            var notifyText = $"📢 <b>VAZIFANGIZ TEKSHIRILDI!</b>\n\n" +
                             $"📌 <b>Dars:</b> {sub.Assignment.Title}\n" +
                             $"📝 <b>Qism:</b> {sub.AssignmentItem.Title}\n" +
                             $"🎯 <b>Natija:</b> {statusIcon}\n";

            if (!string.IsNullOrWhiteSpace(dto.Comment))
            {
                notifyText += $"💬 <b>O'qituvchi izohi:</b> {dto.Comment}\n";
            }

            try
            {
                await _botClient.SendMessage(
                    chatId: studentTelegramId,
                    text: notifyText,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Html);
            }
            catch { }
        }

        return true;
    }

    public async Task<AssignmentItemSubmission> SubmitMediaItemAsync(long studentId, long assignmentItemId, List<AttachmentDto> attachments)
    {
        var item = await _db.AssignmentItems
            .Include(i => i.Assignment)
            .FirstOrDefaultAsync(i => i.Id == assignmentItemId);

        if (item == null)
            throw new InvalidOperationException("Topshiriq qismi topilmadi!");

        var sub = await _db.AssignmentItemSubmissions
            .Include(s => s.Attachments)
            .FirstOrDefaultAsync(s => s.AssignmentItemId == assignmentItemId && s.StudentId == studentId);

        if (sub != null && sub.Status == 1)
        {
            throw new InvalidOperationException("Ushbu topshiriq o'qituvchi tomonidan 'Bajarildi' deb qabul qilingan. Unga qayta kontent yuklab bo'lmaydi!");
        }

        if (sub == null)
        {
            sub = new AssignmentItemSubmission
            {
                AssignmentId = item.AssignmentId,
                AssignmentItemId = assignmentItemId,
                StudentId = studentId,
                Status = null, // Tekshirilmagan
                SubmittedAt = DateTime.UtcNow
            };
            _db.AssignmentItemSubmissions.Add(sub);
        }
        else
        {
            // Jarima bo'lsa yoki tekshirilmagan bo'lsa, qayta topshirilganda tekshirish uchun qoldiriladi
            if (sub.Status != 2)
            {
                sub.Status = null;
            }
            sub.SubmittedAt = DateTime.UtcNow;
        }

        var me = await _botClient.GetMe();
        var botUsername = me.Username ?? "lanswitchbot";

        foreach (var att in attachments)
        {
            var actualFileId = !string.IsNullOrWhiteSpace(att.TelegramFileId) ? att.TelegramFileId : att.TelegramDeepLink;
            var attachmentEntity = new ItemSubmissionAttachment
            {
                TelegramFileId = actualFileId,
                FileType = att.FileType,
                FileSizeBytes = att.FileSizeBytes,
                TelegramDeepLink = att.TelegramDeepLink ?? $"https://t.me/{botUsername}?start=view_att_{actualFileId}"
            };
            sub.Attachments.Add(attachmentEntity);
        }

        await _db.SaveChangesAsync();

        // Update deep links with actual database IDs
        bool needUpdate = false;
        foreach (var att in sub.Attachments)
        {
            var correctLink = $"https://t.me/{botUsername}?start=view_att_{att.Id}";
            if (att.TelegramDeepLink != correctLink)
            {
                att.TelegramDeepLink = correctLink;
                needUpdate = true;
            }
        }
        if (needUpdate)
        {
            await _db.SaveChangesAsync();
        }

        return sub;
    }

    public async Task<AssignmentItemSubmission> SubmitQuizResultAsync(long studentId, SubmitQuizResultDto dto)
    {
        var item = await _db.AssignmentItems
            .Include(i => i.Assignment)
            .FirstOrDefaultAsync(i => i.Id == dto.AssignmentItemId);

        if (item == null)
            throw new InvalidOperationException("Topshiriq qismi topilmadi!");

        var sub = await _db.AssignmentItemSubmissions
            .FirstOrDefaultAsync(s => s.AssignmentItemId == dto.AssignmentItemId && s.StudentId == studentId);

        double percent = dto.TotalQuestions > 0 ? (double)dto.CorrectAnswers / dto.TotalQuestions * 100 : 0;

        if (sub == null)
        {
            sub = new AssignmentItemSubmission
            {
                AssignmentId = item.AssignmentId,
                AssignmentItemId = dto.AssignmentItemId,
                StudentId = studentId,
                Status = null, // Student topshirishi statusni Bajarildi ga o'tkazmaydi (ustoz tekshiradi)
                Comment = $"Test natijasi: {dto.CorrectAnswers}/{dto.TotalQuestions} ({percent:F0}%)",
                SubmittedAt = DateTime.UtcNow
            };
            _db.AssignmentItemSubmissions.Add(sub);
        }
        else
        {
            // Status o'qituvchi tomonidan qo'yilgan bo'lsa tegilmaydi, aks holda null
            sub.Comment = $"Test natijasi: {dto.CorrectAnswers}/{dto.TotalQuestions} ({percent:F0}%)";
            sub.SubmittedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return sub;
    }

    public async Task<bool> CheckTextReminderAsync(long assignmentItemId, long studentId, long teacherId)
    {
        var item = await _db.AssignmentItems
            .Include(i => i.Assignment).ThenInclude(a => a.Group).ThenInclude(g => g.Admins)
            .FirstOrDefaultAsync(i => i.Id == assignmentItemId);

        if (item == null) return false;

        var group = item.Assignment.Group;
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        var sub = await _db.AssignmentItemSubmissions
            .FirstOrDefaultAsync(s => s.AssignmentItemId == assignmentItemId && s.StudentId == studentId);

        if (sub == null)
        {
            sub = new AssignmentItemSubmission
            {
                AssignmentId = item.AssignmentId,
                AssignmentItemId = assignmentItemId,
                StudentId = studentId,
                Status = 1, // Bajarildi
                Comment = "O'qituvchi tomonidan tasdiqlandi",
                ReviewedById = teacherId,
                ReviewedAt = DateTime.UtcNow,
                SubmittedAt = DateTime.UtcNow
            };
            _db.AssignmentItemSubmissions.Add(sub);
        }
        else
        {
            sub.Status = 1;
            sub.ReviewedById = teacherId;
            sub.ReviewedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<AssignmentSummaryDto>> GetGroupAssignmentsAsync(long groupId, long teacherId)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null) return new();
        bool hasAccess = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId);
        if (!hasAccess) return new();

        var activeMemberIds = await _db.GroupMembers
            .Where(m => m.GroupId == groupId && m.IsActive)
            .Select(m => m.StudentId)
            .ToListAsync();

        var totalMembers = activeMemberIds.Count;

        var assignments = await _db.Assignments
            .Include(a => a.Items)
            .Include(a => a.Submissions)
            .Where(a => a.GroupId == groupId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var result = new List<AssignmentSummaryDto>();

        foreach (var a in assignments)
        {
            int totalItems = a.Items.Count;
            int fullCount = 0;
            int partialCount = 0;
            int penaltyCount = 0;
            int submittedCount = 0;

            foreach (var studentId in activeMemberIds)
            {
                var studentSubs = a.Submissions.Where(s => s.StudentId == studentId).ToList();
                if (studentSubs.Any())
                {
                    submittedCount++;
                    if (studentSubs.Any(s => s.Status == 0))
                    {
                        penaltyCount++;
                    }

                    if (studentSubs.Count >= totalItems && studentSubs.All(s => s.Status == 1 || s.Status == 2))
                    {
                        fullCount++;
                    }
                    else
                    {
                        partialCount++;
                    }
                }
            }

            int missingCount = Math.Max(0, totalMembers - submittedCount);

            result.Add(new AssignmentSummaryDto
            {
                Id = a.Id,
                GroupId = a.GroupId,
                Title = a.Title,
                Deadline = a.Deadline,
                Status = a.Status,
                CreatedAt = a.CreatedAt,
                ItemsCount = a.Items.Count,
                TotalMembersCount = totalMembers,
                SubmittedCount = submittedCount,
                MissingCount = missingCount,
                FullCount = fullCount,
                PartialCount = partialCount,
                PenaltyCount = penaltyCount
            });
        }

        return result;
    }

    public async Task<AssignmentReportDto?> GetAssignmentReportAsync(long assignmentId, long teacherId)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group).ThenInclude(g => g.Admins)
            .Include(a => a.Group).ThenInclude(g => g.Members).ThenInclude(m => m.Student)
            .Include(a => a.Items)
            .Include(a => a.Submissions).ThenInclude(s => s.Student)
            .Include(a => a.Submissions).ThenInclude(s => s.Attachments)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return null;

        var group = assignment.Group;
        bool hasAccess = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId);
        if (!hasAccess) return null;

        var activeMembers = group.Members.Where(m => m.IsActive).ToList();
        var totalMembers = activeMembers.Count;

        var submittedList = new List<StudentAssignmentStatusDto>();
        var missingList = new List<StudentAssignmentStatusDto>();

        foreach (var member in activeMembers)
        {
            var student = member.Student;
            var studentSubs = assignment.Submissions.Where(s => s.StudentId == student.Id).ToList();

            var studentItems = assignment.Items.OrderBy(i => i.OrderIndex).Select(item =>
            {
                var sub = studentSubs.FirstOrDefault(s => s.AssignmentItemId == item.Id);
                return new AssignmentItemDetailDto
                {
                    Id = item.Id,
                    OrderIndex = item.OrderIndex,
                    ItemType = item.ItemType,
                    Title = item.Title,
                    Instructions = item.Instructions,
                    TargetUnitId = item.TargetUnitId,
                    SubmissionId = sub?.Id,
                    MySubmissionStatus = sub?.Status,
                    MySubmissionComment = sub?.Comment,
                    MySubmittedAt = sub?.SubmittedAt,
                    Attachments = sub != null ? sub.Attachments.Select(att => new AttachmentDto
                    {
                        Id = att.Id,
                        TelegramFileId = att.TelegramFileId,
                        FileType = att.FileType,
                        FileSizeBytes = att.FileSizeBytes,
                        TelegramDeepLink = att.TelegramDeepLink,
                        StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
                    }).ToList() : new()
                };
            }).ToList();

            int totalItemsCount = assignment.Items.Count;
            int completedItemsCount = studentItems.Count(i => i.MySubmissionStatus == 1 || i.MySubmissionStatus == 2);
            bool hasPenalty = studentItems.Any(i => i.MySubmissionStatus == 0);

            int? overallStatus = null;
            if (hasPenalty)
            {
                overallStatus = 0; // Jarima (Punishment)
            }
            else if (totalItemsCount > 0 && completedItemsCount == totalItemsCount)
            {
                overallStatus = studentItems.Any(i => i.MySubmissionStatus == 2) ? 2 : 1;
            }
            else
            {
                overallStatus = null; // Tekshirilmagan / to'liq emas
            }

            if (studentSubs.Any())
            {
                // Topshirganlar

                var allAttachments = studentSubs.SelectMany(s => s.Attachments).Select(att => new AttachmentDto
                {
                    Id = att.Id,
                    TelegramFileId = att.TelegramFileId,
                    FileType = att.FileType,
                    FileSizeBytes = att.FileSizeBytes,
                    TelegramDeepLink = att.TelegramDeepLink,
                    StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
                }).ToList();

                var latestSub = studentSubs.OrderByDescending(s => s.SubmittedAt).First();
                var penaltyComment = studentSubs.FirstOrDefault(s => s.Status == 0)?.Comment;

                submittedList.Add(new StudentAssignmentStatusDto
                {
                    StudentId = student.Id,
                    FullName = student.FullName,
                    Username = student.Username,
                    AvatarUrl = student.AvatarUrl,
                    TelegramId = student.TelegramId,
                    HasSubmitted = true,
                    Status = overallStatus,
                    Comment = penaltyComment ?? latestSub.Comment,
                    SubmittedAt = latestSub.SubmittedAt,
                    ItemsCompleted = studentSubs.Count(s => s.Status == 1 || s.Status == 2),
                    TotalItems = assignment.Items.Count,
                    Attachments = allAttachments,
                    Items = studentItems
                });
            }
            else
            {
                // Topshirmaganlar (Qilmaganlar)
                missingList.Add(new StudentAssignmentStatusDto
                {
                    StudentId = student.Id,
                    FullName = student.FullName,
                    Username = student.Username,
                    AvatarUrl = student.AvatarUrl,
                    TelegramId = student.TelegramId,
                    HasSubmitted = false,
                    Status = null,
                    Comment = null,
                    SubmittedAt = null,
                    ItemsCompleted = 0,
                    TotalItems = assignment.Items.Count,
                    Attachments = new(),
                    Items = studentItems
                });
            }
        }

        var allStatuses = submittedList.Concat(missingList).Select(s => s.Status).ToList();
        int fullCount = allStatuses.Count(s => s == 1);
        int punishmentCount = allStatuses.Count(s => s == 0);
        int punishedCount = allStatuses.Count(s => s == 2);

        return new AssignmentReportDto
        {
            AssignmentId = assignment.Id,
            GroupId = assignment.GroupId,
            GroupTitle = group.Title,
            Title = assignment.Title,
            Deadline = assignment.Deadline,
            Status = assignment.Status,
            CreatedAt = assignment.CreatedAt,
            TotalMembersCount = totalMembers,
            SubmittedCount = submittedList.Count,
            MissingCount = missingList.Count,
            FullCount = fullCount,
            PunishmentCount = punishmentCount,
            PunishedCount = punishedCount,
            SubmittedStudents = submittedList.OrderByDescending(s => s.SubmittedAt).ToList(),
            MissingStudents = missingList.OrderBy(s => s.FullName).ToList()
        };
    }

    public async Task<bool> RemindMissingStudentsAsync(long assignmentId, long teacherId)
    {
        var report = await GetAssignmentReportAsync(assignmentId, teacherId);
        if (report == null) return false;

        string frontendHost = _db.TelegramGroups
            .Where(g => g.Id == report.GroupId)
            .Select(g => "lanswitch.developerlogic.uz")
            .FirstOrDefault() ?? "lanswitch.developerlogic.uz";

        var tmaUrl = $"https://{frontendHost}/tma";

        var keyboard = new Telegram.Bot.Types.ReplyMarkups.InlineKeyboardMarkup(new[]
        {
            new[] { Telegram.Bot.Types.ReplyMarkups.InlineKeyboardButton.WithWebApp("📱 Vazifani Bajarish (Mini App)", new Telegram.Bot.Types.WebAppInfo { Url = tmaUrl }) }
        });

        foreach (var student in report.MissingStudents)
        {
            if (long.TryParse(student.TelegramId, out long tgId))
            {
                try
                {
                    var text = $"⚠️ <b>ESLATMA: UYGA VAZIFA BAJARILMAGAN!</b>\n\n" +
                               $"📚 <b>Guruh:</b> {report.GroupTitle}\n" +
                               $"📌 <b>Dars:</b> {report.Title}\n" +
                               $"⏰ <b>Topshirish muddati:</b> {report.Deadline:dd.MM.yyyy HH:mm}\n\n" +
                               $"<i>Iltimos, muddat o'tishidan oldin Mini App orqali topshiring 👇</i>";

                    await _botClient.SendMessage(
                        chatId: tgId,
                        text: text,
                        parseMode: Telegram.Bot.Types.Enums.ParseMode.Html,
                        replyMarkup: keyboard);
                }
                catch { }
            }
        }

        return true;
    }

    public async Task<List<StudentReviewGroupDto>> GetTeacherReviewGroupsAsync(long groupId, long teacherId, string? filter)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return new();
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return new();

        var query = _db.AssignmentItemSubmissions
            .Include(s => s.Assignment)
            .Include(s => s.AssignmentItem)
            .Include(s => s.Student)
            .Include(s => s.Attachments)
            .Where(s => s.Assignment.GroupId == groupId);

        if (string.Equals(filter, "Unchecked", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == null);
        }
        else if (string.Equals(filter, "Penalty", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == 0);
        }
        else if (string.Equals(filter, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == 1 || s.Status == 2);
        }

        var submissions = await query.ToListAsync();

        var grouped = submissions
            .GroupBy(s => new { s.StudentId, s.AssignmentId })
            .Select(g =>
            {
                var first = g.First();
                var latestTime = g.Max(s => s.SubmittedAt);
                int? overallStatus = null;
                if (g.Any(s => s.Status == 0)) overallStatus = 0;
                else if (g.All(s => s.Status == 1 || s.Status == 2)) overallStatus = g.Any(s => s.Status == 2) ? 2 : 1;
                else if (g.Any(s => s.Status == null)) overallStatus = null;

                return new StudentReviewGroupDto
                {
                    StudentId = g.Key.StudentId,
                    StudentName = first.Student.FullName,
                    StudentAvatarUrl = first.Student.AvatarUrl ?? first.Student.ProfileImage,
                    AssignmentId = g.Key.AssignmentId,
                    AssignmentTitle = first.Assignment.Title,
                    LatestSubmittedAt = latestTime,
                    OverallStatus = overallStatus,
                    Items = g.OrderBy(s => s.AssignmentItem.OrderIndex).Select(s => new ReviewItemDetailDto
                    {
                        SubmissionId = s.Id,
                        AssignmentItemId = s.AssignmentItemId,
                        ItemTitle = s.AssignmentItem.Title,
                        ItemType = s.AssignmentItem.ItemType,
                        Status = s.Status,
                        Comment = s.Comment,
                        SubmittedAt = s.SubmittedAt,
                        Attachments = s.Attachments.Select(att => new AttachmentDto
                        {
                            Id = att.Id,
                            TelegramFileId = att.TelegramFileId,
                            FileType = att.FileType,
                            FileSizeBytes = att.FileSizeBytes,
                            TelegramDeepLink = att.TelegramDeepLink,
                            StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
                        }).ToList()
                    }).ToList()
                };
            })
            .OrderByDescending(g => g.LatestSubmittedAt) // Eng oxirgi topshirgan talaba birinchi
            .ToList();

        return grouped;
    }

    public async Task<List<StudentTimelineAssignmentDto>> GetStudentTimelineHistoryAsync(long groupId, long studentId)
    {
        var assignments = await _db.Assignments
            .Include(a => a.Items)
            .Include(a => a.Submissions.Where(s => s.StudentId == studentId)).ThenInclude(s => s.Attachments)
            .Where(a => a.GroupId == groupId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var result = new List<StudentTimelineAssignmentDto>();

        foreach (var a in assignments)
        {
            var itemDtos = new List<AssignmentItemDetailDto>();
            foreach (var item in a.Items.OrderBy(i => i.OrderIndex))
            {
                var mySub = item.Submissions.FirstOrDefault(s => s.StudentId == studentId);
                itemDtos.Add(new AssignmentItemDetailDto
                {
                    Id = item.Id,
                    OrderIndex = item.OrderIndex,
                    ItemType = item.ItemType,
                    Title = item.Title,
                    Instructions = item.Instructions,
                    SubmissionId = mySub?.Id,
                    MySubmissionStatus = mySub?.Status,
                    MySubmissionComment = mySub?.Comment,
                    MySubmittedAt = mySub?.SubmittedAt,
                    Attachments = mySub?.Attachments.Select(att => new AttachmentDto
                    {
                        Id = att.Id,
                        TelegramFileId = att.TelegramFileId,
                        FileType = att.FileType,
                        FileSizeBytes = att.FileSizeBytes,
                        TelegramDeepLink = att.TelegramDeepLink,
                        StreamUrl = $"/api/v1/assignments/attachments/{att.Id}/content"
                    }).ToList() ?? new()
                });
            }

            int? overallStatus = null;
            if (itemDtos.Any(i => i.MySubmissionStatus == 0))
            {
                overallStatus = 0; // Jarima
            }
            else if (itemDtos.Count > 0 && itemDtos.All(i => i.MySubmissionStatus == 1 || i.MySubmissionStatus == 2))
            {
                overallStatus = itemDtos.Any(i => i.MySubmissionStatus == 2) ? 2 : 1;
            }
            else if (itemDtos.Any(i => i.MySubmittedAt.HasValue && !i.MySubmissionStatus.HasValue))
            {
                overallStatus = null; // Tekshirilmoqda
            }

            result.Add(new StudentTimelineAssignmentDto
            {
                AssignmentId = a.Id,
                Title = a.Title,
                CreatedAt = a.CreatedAt,
                Deadline = a.Deadline,
                OverallStatus = overallStatus,
                Items = itemDtos
            });
        }

        return result;
    }

    public async Task<bool> ToggleStudentAssignmentStatusAsync(long assignmentId, long studentId, bool isCompleted, long teacherId)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group).ThenInclude(g => g.Admins)
            .Include(a => a.Items)
            .Include(a => a.Submissions.Where(s => s.StudentId == studentId))
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return false;
        bool canReview = assignment.Group.OwnerId == teacherId || assignment.Group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        if (isCompleted)
        {
            // Barcha qismlarni Bajarildi (1) deb belgilash
            foreach (var item in assignment.Items)
            {
                var sub = assignment.Submissions.FirstOrDefault(s => s.AssignmentItemId == item.Id && s.StudentId == studentId);
                if (sub == null)
                {
                    sub = new AssignmentItemSubmission
                    {
                        AssignmentId = assignment.Id,
                        AssignmentItemId = item.Id,
                        StudentId = studentId,
                        Status = 1,
                        Comment = "O'qituvchi tomonidan tasdiqlandi",
                        ReviewedById = teacherId,
                        ReviewedAt = DateTime.UtcNow,
                        SubmittedAt = DateTime.UtcNow
                    };
                    _db.AssignmentItemSubmissions.Add(sub);
                }
                else
                {
                    sub.Status = 1;
                    sub.Comment = "O'qituvchi tomonidan tasdiqlandi";
                    sub.ReviewedById = teacherId;
                    sub.ReviewedAt = DateTime.UtcNow;
                }
            }
        }
        else
        {
            // Qaytarish / O'chirish
            var subs = await _db.AssignmentItemSubmissions
                .Where(s => s.AssignmentId == assignmentId && s.StudentId == studentId)
                .ToListAsync();

            _db.AssignmentItemSubmissions.RemoveRange(subs);
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetStudentAssignmentStatusAsync(long assignmentId, long studentId, int status, long teacherId, string? comment = null)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group).ThenInclude(g => g.Admins)
            .Include(a => a.Items)
            .Include(a => a.Submissions.Where(s => s.StudentId == studentId))
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return false;
        bool canReview = assignment.Group.OwnerId == teacherId || assignment.Group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        if (status == 0 && string.IsNullOrWhiteSpace(comment))
        {
            throw new InvalidOperationException("Punishment (Jarima) qo'llash uchun jazo izohi kiritilishi shart!");
        }

        if (status == -1)
        {
            var subs = await _db.AssignmentItemSubmissions
                .Where(s => s.AssignmentId == assignmentId && s.StudentId == studentId)
                .ToListAsync();
            _db.AssignmentItemSubmissions.RemoveRange(subs);
        }
        else
        {
            string finalComment = !string.IsNullOrWhiteSpace(comment)
                ? comment.Trim()
                : (status == 1 ? "Bajarildi deb baholandi" : status == 0 ? "Jarima deb baholandi" : "Jarima bajardi deb baholandi");

            foreach (var item in assignment.Items)
            {
                var sub = assignment.Submissions.FirstOrDefault(s => s.AssignmentItemId == item.Id && s.StudentId == studentId);
                if (sub == null)
                {
                    sub = new AssignmentItemSubmission
                    {
                        AssignmentId = assignment.Id,
                        AssignmentItemId = item.Id,
                        StudentId = studentId,
                        Status = status,
                        Comment = finalComment,
                        ReviewedById = teacherId,
                        ReviewedAt = DateTime.UtcNow,
                        SubmittedAt = DateTime.UtcNow
                    };
                    _db.AssignmentItemSubmissions.Add(sub);
                }
                else
                {
                    sub.Status = status;
                    sub.Comment = finalComment;
                    sub.ReviewedById = teacherId;
                    sub.ReviewedAt = DateTime.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync();

        // O'quvchiga Telegram bot orqali xabar yuborish
        try
        {
            var student = await _db.Users.FindAsync(studentId);
            if (student != null && long.TryParse(student.TelegramId, out long studentTelegramId))
            {
                string statusIcon = status switch
                {
                    1 => "✅ Full Done (1)",
                    0 => "❌ Punishment (0) - Jarima",
                    2 => "⚠️ Punished (2) - Jarima bajarildi",
                    _ => "Bekor qilindi"
                };

                var notifyText = $"📢 <b>VAZIFANGIZ TEKSHIRILDI!</b>\n\n" +
                                 $"📌 <b>Dars:</b> {assignment.Title}\n" +
                                 $"📊 <b>Holat:</b> {statusIcon}\n";

                if (!string.IsNullOrWhiteSpace(comment))
                {
                    notifyText += $"💬 <b>O'qituvchi izohi / Jazo:</b> {comment.Trim()}\n";
                }

                await _botClient.SendMessage(
                    chatId: studentTelegramId,
                    text: notifyText,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Html
                );
            }
        }
        catch { }

        return true;
    }

    public async Task<bool> GradeStudentItemAsync(long assignmentId, long itemId, long studentId, int status, long teacherId, string? comment = null)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group).ThenInclude(g => g.Admins)
            .Include(a => a.Items)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return false;

        var group = assignment.Group;
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        var item = assignment.Items.FirstOrDefault(i => i.Id == itemId);
        if (item == null) return false;

        if (status == 0 && string.IsNullOrWhiteSpace(comment))
        {
            throw new InvalidOperationException("Punishment (Jarima) qo'llash uchun jazo izohi kiritilishi shart!");
        }

        var sub = await _db.AssignmentItemSubmissions
            .FirstOrDefaultAsync(s => s.AssignmentItemId == itemId && s.StudentId == studentId);

        if (sub == null)
        {
            if (status == -1) return true; // Already unreviewed

            string finalComment = !string.IsNullOrWhiteSpace(comment)
                ? comment.Trim()
                : (status == 1 ? "Bajarildi deb baholandi" : status == 0 ? "Jarima deb baholandi" : "Jarima bajardi deb baholandi");

            sub = new AssignmentItemSubmission
            {
                AssignmentId = assignmentId,
                AssignmentItemId = itemId,
                StudentId = studentId,
                Status = status,
                Comment = finalComment,
                ReviewedById = teacherId,
                ReviewedAt = DateTime.UtcNow,
                SubmittedAt = DateTime.UtcNow
            };
            await _db.AssignmentItemSubmissions.AddAsync(sub);
        }
        else
        {
            if (status == -1)
            {
                _db.AssignmentItemSubmissions.Remove(sub);
            }
            else
            {
                string finalComment = !string.IsNullOrWhiteSpace(comment)
                    ? comment.Trim()
                    : (status == 1 ? "Bajarildi deb baholandi" : status == 0 ? "Jarima deb baholandi" : "Jarima bajardi deb baholandi");

                sub.Status = status;
                sub.Comment = finalComment;
                sub.ReviewedById = teacherId;
                sub.ReviewedAt = DateTime.UtcNow;
                _db.AssignmentItemSubmissions.Update(sub);
            }
        }

        await _db.SaveChangesAsync();

        // O'quvchiga Telegram bot orqali xabar yuborish
        try
        {
            var student = await _db.Users.FindAsync(studentId);
            if (student != null && long.TryParse(student.TelegramId, out long studentTelegramId))
            {
                string statusIcon = status switch
                {
                    1 => "✅ Bajarildi (1)",
                    0 => "❌ Jarima (0)",
                    2 => "⚠️ Jarima Bajarildi (2)",
                    _ => "Status bekor qilindi"
                };

                var notifyText = $"📢 <b>TOPSHIRIQ QISMI TEKSHIRILDI!</b>\n\n" +
                                 $"📌 <b>Dars:</b> {assignment.Title}\n" +
                                 $"📝 <b>Qism:</b> {item.Title}\n" +
                                 $"📊 <b>Holat:</b> {statusIcon}\n";

                if (!string.IsNullOrWhiteSpace(comment))
                {
                    notifyText += $"💬 <b>O'qituvchi izohi / Jazo:</b> {comment.Trim()}\n";
                }

                await _botClient.SendMessage(
                    chatId: studentTelegramId,
                    text: notifyText,
                    parseMode: Telegram.Bot.Types.Enums.ParseMode.Html
                );
            }
        }
        catch { }

        return true;
    }

    public async Task<bool> DeleteAttachmentAsync(long attachmentId, long studentOrTeacherId)
    {
        var att = await _db.ItemSubmissionAttachments
            .Include(a => a.ItemSubmission)
            .FirstOrDefaultAsync(a => a.Id == attachmentId);

        if (att == null) return false;

        // Student o'z faylini o'chira oladi, yoki o'qituvchi/admin
        if (att.ItemSubmission.StudentId != studentOrTeacherId)
        {
            var user = await _db.Users.FindAsync(studentOrTeacherId);
            if (user == null || (!user.IsAdmin && user.Role != "Teacher")) return false;
        }
        else if (att.ItemSubmission.Status == 1)
        {
            throw new InvalidOperationException("Qabul qilingan topshiriq fayllarini o'chirib bo'lmaydi!");
        }

        _db.ItemSubmissionAttachments.Remove(att);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAssignmentAsync(long assignmentId, long teacherId)
    {
        var assignment = await _db.Assignments
            .Include(a => a.Group)
                .ThenInclude(g => g.Admins)
            .Include(a => a.Items)
            .Include(a => a.Submissions)
                .ThenInclude(s => s.Attachments)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null) return false;

        var teacher = await _db.Users.FindAsync(teacherId);
        bool hasAccess = (teacher != null && (teacher.IsAdmin || teacher.Role == "Teacher"))
                         || assignment.CreatorId == teacherId
                         || (assignment.Group != null && (assignment.Group.OwnerId == teacherId || assignment.Group.Admins.Any(ga => ga.UserId == teacherId)));

        if (!hasAccess)
        {
            throw new UnauthorizedAccessException("Ushbu vazifani o'chirish uchun sizda ruxsat yo'q!");
        }

        // 1. Remove attachments
        foreach (var sub in assignment.Submissions)
        {
            if (sub.Attachments != null && sub.Attachments.Count > 0)
            {
                _db.ItemSubmissionAttachments.RemoveRange(sub.Attachments);
            }
        }

        // 2. Remove submissions
        if (assignment.Submissions != null && assignment.Submissions.Count > 0)
        {
            _db.AssignmentItemSubmissions.RemoveRange(assignment.Submissions);
        }

        // 3. Remove items
        if (assignment.Items != null && assignment.Items.Count > 0)
        {
            _db.AssignmentItems.RemoveRange(assignment.Items);
        }

        // 4. Remove assignment
        _db.Assignments.Remove(assignment);

        await _db.SaveChangesAsync();
        return true;
    }
}


