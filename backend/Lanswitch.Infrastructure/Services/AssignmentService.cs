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
    private readonly IBotStateManager _stateManager;
    private readonly IArchiveDatabaseService _archiveDb;

    public AssignmentService(AppDbContext db, ITelegramBotClient botClient, IConfiguration config, IBotStateManager stateManager, IArchiveDatabaseService archiveDb)
    {
        _db = db;
        _botClient = botClient;
        _config = config;
        _stateManager = stateManager;
        _archiveDb = archiveDb;
    }

    public async Task<Assignment> CreateAssignmentAsync(long teacherId, CreateAssignmentDto dto)
    {
        var group = await _db.TelegramGroups
            .Include(g => g.Admins)
            .Include(g => g.Owner)
            .FirstOrDefaultAsync(g => g.Id == dto.GroupId);

        if (group == null)
            throw new InvalidOperationException("Guruh topilmadi!");

        bool canCreate = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanCreateHomework);
        if (!canCreate)
            throw new UnauthorizedAccessException("Sizda ushbu guruhga vazifa qo'shish huquqi yo'q!");

        var now = DateTime.UtcNow;
        var owner = group.Owner ?? await _db.Users.FindAsync(group.OwnerId);
        var creator = await _db.Users.FindAsync(teacherId);
        bool isOwnerAdmin = owner?.IsAdmin == true || creator?.IsAdmin == true;

        var activeSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => (s.UserId == group.OwnerId || s.UserId == teacherId) && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeSub == null)
            throw new InvalidOperationException("Guruhda yangi vazifa yaratish uchun hisobingizda faol obuna (kamida Student Premium yoki Ustoz tarifi) bo'lishi lozim. Iltimos, balansingizni to'ldiring!");

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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
        var group = await _db.TelegramGroups
            .Include(g => g.Owner)
            .FirstOrDefaultAsync(g => g.Id == groupId && g.IsActive);

        if (group == null) return new List<AssignmentDetailDto>();

        var now = DateTime.UtcNow;
        bool isOwnerAdmin = group.Owner?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        // Agar ustozni obuna tarifi ustoz bo'lmasa yoki tugagan bo'lsa topshiriqlar studentlarga ko'rinmaydi
        if (!isOwnerAdmin && activeTeacherSub == null)
        {
            return new List<AssignmentDetailDto>();
        }

        // Agar guruhlar soni tarif limitidan oshib ketgan bo'lsa hech qaysi guruh topshiriqlari ko'rinmaydi
        if (!isOwnerAdmin && activeTeacherSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeTeacherSub.MaxGroups)
            {
                return new List<AssignmentDetailDto>();
            }
        }

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
            .Include(g => g.Owner)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return new();
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return new();

        var now = DateTime.UtcNow;
        var owner = group.Owner ?? await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null) return new();

        if (!isOwnerAdmin && activeTeacherSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeTeacherSub.MaxGroups) return new();
        }

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

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Vazifalarni tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Tekshirish va baholash uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Vazifalarni tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Tekshirish va baholash uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Hisobotlarni ko'rish va tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Hisobotlarni ko'rish va tekshirish uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hisobotlar ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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
            .Include(g => g.Owner)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return new();
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return new();

        var now = DateTime.UtcNow;
        var owner = group.Owner ?? await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeTeacherSub = isOwnerAdmin ? null : await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now && s.TargetRole == "Teacher")
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        if (!isOwnerAdmin && activeTeacherSub == null) return new();

        if (!isOwnerAdmin && activeTeacherSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeTeacherSub.MaxGroups) return new();
        }

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
        var group = assignment.Group;
        bool canReview = group.OwnerId == teacherId || group.Admins.Any(a => a.UserId == teacherId && a.CanReviewHomework);
        if (!canReview) return false;

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Vazifa holatini o'zgartirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Tekshirish va baholash uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(assignment.Group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == assignment.Group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Vazifalarni tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Tekshirish va baholash uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == assignment.Group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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

        var now = DateTime.UtcNow;
        var owner = await _db.Users.FindAsync(group.OwnerId);
        bool isOwnerAdmin = owner?.IsAdmin == true;
        var activeSub = await _db.UserSubscriptions
            .Where(s => s.UserId == group.OwnerId && (s.Status == "Active" || s.IsActive) && s.EndDate > now)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        bool hasActiveTeacherSub = isOwnerAdmin || (activeSub != null && activeSub.TargetRole == "Teacher");

        if (!hasActiveTeacherSub)
        {
            if (activeSub != null && activeSub.TargetRole == "Student")
            {
                throw new InvalidOperationException("Vazifalarni tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
            }
            throw new InvalidOperationException("Tekshirish va baholash uchun hisobingizga pul tashlang va 'Ustoz Standart' tarifini faollashtiring!");
        }

        if (!isOwnerAdmin && activeSub != null)
        {
            var activeCount = await _db.TelegramGroups.CountAsync(g => g.OwnerId == group.OwnerId && g.IsActive);
            if (activeCount > activeSub.MaxGroups)
            {
                throw new InvalidOperationException($"Guruhlaringiz soni ({activeCount} ta) tarifingizdagi limitdan ({activeSub.MaxGroups} ta) ko'p bo'lganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
            }
        }

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

        // 0. Boshqa bazaga arxivlash (Archive before deleting)
        var snapshot = new
        {
            assignment.Id,
            assignment.GroupId,
            GroupTitle = assignment.Group?.Title,
            assignment.CreatorId,
            assignment.Title,
            assignment.Deadline,
            assignment.Status,
            assignment.CreatedAt,
            Items = assignment.Items.Select(i => new
            {
                i.Id,
                i.OrderIndex,
                i.ItemType,
                i.Title,
                i.Instructions,
                i.TargetUnitId
            }),
            Submissions = assignment.Submissions.Select(s => new
            {
                s.Id,
                s.AssignmentItemId,
                s.StudentId,
                s.Status,
                s.Comment,
                s.SubmittedAt,
                s.ReviewedAt,
                Attachments = s.Attachments?.Select(att => new
                {
                    att.Id,
                    att.TelegramFileId,
                    att.FileType,
                    att.FileSizeBytes
                })
            })
        };

        await _archiveDb.ArchiveAsync(
            entityType: "Assignment",
            entityId: assignment.Id,
            entityTitle: assignment.Title,
            ownerId: assignment.Group?.OwnerId ?? teacherId,
            deletedById: teacherId,
            data: snapshot,
            reason: "TeacherDeletedAssignment"
        );

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

    public async Task<PrepareUploadResultDto> PrepareMediaUploadAsync(long itemId, long studentId)
    {
        var student = await _db.Users.FindAsync(studentId);
        if (student == null)
            throw new InvalidOperationException("Talaba topilmadi!");

        if (string.IsNullOrWhiteSpace(student.TelegramId) || !long.TryParse(student.TelegramId, out var chatId))
            throw new InvalidOperationException("Foydalanuvchining Telegram ma'lumotlari aniqlanmadi.");

        var item = await _db.AssignmentItems
            .Include(i => i.Assignment)
            .FirstOrDefaultAsync(i => i.Id == itemId);

        if (item == null)
            throw new InvalidOperationException("Topshiriq topilmadi!");

        var existingSub = await _db.AssignmentItemSubmissions
            .FirstOrDefaultAsync(s => s.AssignmentItemId == itemId && s.StudentId == studentId);

        if (existingSub != null && existingSub.Status == 1)
        {
            throw new InvalidOperationException("Ushbu topshiriq o'qituvchi tomonidan 'Bajarildi' deb qabul qilingan va unga qayta fayl yuklab bo'lmaydi.");
        }

        // Set state in BotStateManager so that next media received from this user is linked to this item
        var state = new AdminState { CurrentStep = AdminStep.WaitingMediaSubmission };
        state.Data["ItemId"] = itemId;
        _stateManager.SetState(chatId, state);

        var botUsername = _config["BotConfiguration:BotUsername"]?.TrimStart('@') ?? "lanswitchbot";
        var botUrl = $"tg://resolve?domain={botUsername}";

        string frontendHost = _config.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        var tmaUrl = _config["Frontend:TmaUrl"] ?? $"https://{frontendHost}/tma";

        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithWebApp("📱 Mini App ga qaytish", new Telegram.Bot.Types.WebAppInfo { Url = $"{tmaUrl}?user_id={student.Id}" }),
                InlineKeyboardButton.WithCallbackData("❌ Bekor qilish", $"cancel_sub_{itemId}")
            }
        });

        var text = $"📌 <b>Topshiriq:</b> {item.Title}\n" +
                   $"📝 <b>Yo'riqnoma:</b> {item.Instructions ?? "Javobingizni audio, video yoki rasm sifatida yuboring"}\n\n" +
                   $"👇 <i>Iltimos, ushbu topshiriq uchun javobingizni (voice, video yoki rasm) shu yerga yuboring:</i>";

        try
        {
            await _botClient.SendMessage(
                chatId: chatId,
                text: text,
                parseMode: Telegram.Bot.Types.Enums.ParseMode.Html,
                replyMarkup: keyboard);
        }
        catch (Exception ex)
        {
            return new PrepareUploadResultDto
            {
                Success = false,
                BotUsername = botUsername,
                BotUrl = botUrl,
                Message = $"Telegram botga xabar yuborib bo'lmadi: {ex.Message}. Iltimos, avval botni ishga tushirganingiz va bloklamaganingizni tekshiring."
            };
        }

        return new PrepareUploadResultDto
        {
            Success = true,
            BotUsername = botUsername,
            BotUrl = botUrl,
            Message = "Tayyorlandi"
        };
    }

    public async Task<SendAttachmentResultDto> SendAttachmentToTelegramAsync(long attachmentId, long userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            throw new InvalidOperationException("Foydalanuvchi topilmadi!");

        if (string.IsNullOrWhiteSpace(user.TelegramId) || !long.TryParse(user.TelegramId, out var chatId))
            throw new InvalidOperationException("Foydalanuvchining Telegram ID si aniqlanmadi.");

        var att = await _db.ItemSubmissionAttachments
            .Include(a => a.ItemSubmission).ThenInclude(s => s.AssignmentItem)
            .Include(a => a.ItemSubmission).ThenInclude(s => s.Student)
            .FirstOrDefaultAsync(a => a.Id == attachmentId);

        if (att == null)
            throw new InvalidOperationException("Fayl topilmadi!");

        var sub = att.ItemSubmission;
        var item = sub.AssignmentItem;
        var caption = $"📌 <b>Topshiriq:</b> {item.Title}\n👤 <b>Talaba:</b> {sub.Student.FullName}";

        var botUsername = _config["BotConfiguration:BotUsername"]?.TrimStart('@') ?? "lanswitchbot";
        var botUrl = $"tg://resolve?domain={botUsername}";

        var keyboardList = new List<InlineKeyboardButton[]>();
        if (user.IsAdmin || user.Role == "Teacher")
        {
            keyboardList.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("✅ 1 Bajarildi", $"grade_sub_{sub.Id}_1"),
                InlineKeyboardButton.WithCallbackData("❌ 0 Jarima", $"grade_sub_{sub.Id}_0"),
                InlineKeyboardButton.WithCallbackData("⚠️ 2 Jarima", $"grade_sub_{sub.Id}_2")
            });
        }

        string frontendHost = _config.GetValue<string>("Frontend:Host", "lanswitch.developerlogic.uz");
        var attTmaUrl = _config["Frontend:TmaUrl"] ?? $"https://{frontendHost}/tma";
        keyboardList.Add(new[]
        {
            InlineKeyboardButton.WithWebApp("📱 Mini App da ochish", new Telegram.Bot.Types.WebAppInfo { Url = $"{attTmaUrl}?user_id={user.Id}" })
        });

        var replyKb = new InlineKeyboardMarkup(keyboardList);

        try
        {
            var inputFile = new Telegram.Bot.Types.InputFileId(att.TelegramFileId);
            if (att.FileType == "video")
            {
                await _botClient.SendVideo(chatId, inputFile, caption: caption, parseMode: Telegram.Bot.Types.Enums.ParseMode.Html, replyMarkup: replyKb);
            }
            else if (att.FileType == "voice")
            {
                await _botClient.SendVoice(chatId, inputFile, caption: caption, parseMode: Telegram.Bot.Types.Enums.ParseMode.Html, replyMarkup: replyKb);
            }
            else if (att.FileType == "audio")
            {
                await _botClient.SendAudio(chatId, inputFile, caption: caption, parseMode: Telegram.Bot.Types.Enums.ParseMode.Html, replyMarkup: replyKb);
            }
            else if (att.FileType == "photo")
            {
                await _botClient.SendPhoto(chatId, inputFile, caption: caption, parseMode: Telegram.Bot.Types.Enums.ParseMode.Html, replyMarkup: replyKb);
            }
            else
            {
                await _botClient.SendDocument(chatId, inputFile, caption: caption, parseMode: Telegram.Bot.Types.Enums.ParseMode.Html, replyMarkup: replyKb);
            }
        }
        catch (Exception ex)
        {
            return new SendAttachmentResultDto
            {
                Success = false,
                BotUsername = botUsername,
                BotUrl = botUrl,
                Message = $"Telegram botga fayl yuborib bo'lmadi: {ex.Message}. Iltimos, avval botni ishga tushirganingiz va bloklamaganingizni tekshiring."
            };
        }

        return new SendAttachmentResultDto
        {
            Success = true,
            BotUsername = botUsername,
            BotUrl = botUrl,
            Message = "Fayl Telegram botingizga yuborildi!"
        };
    }
}


