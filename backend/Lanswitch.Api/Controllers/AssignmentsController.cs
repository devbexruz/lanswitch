using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Telegram.Bot;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/v1/assignments")]
public class AssignmentsController : ControllerBase
{
    private readonly IAssignmentService _assignmentService;
    private readonly AppDbContext _db;
    private readonly IGeminiAiService _gemini;

    public AssignmentsController(IAssignmentService assignmentService, AppDbContext db, IGeminiAiService gemini)
    {
        _assignmentService = assignmentService;
        _db = db;
        _gemini = gemini;
    }

    private long GetUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(idClaim) && long.TryParse(idClaim, out var id))
            return id;

        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && long.TryParse(headerVal, out var headerId))
            return headerId;

        return 0;
    }

    /// <summary>
    /// O'qituvchi tomonidan yangi uyga vazifa yaratish ($K$ ta qismlar bilan)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAssignment([FromBody] CreateAssignmentDto dto, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var created = await _assignmentService.CreateAssignmentAsync(tId, dto);
        return Ok(created);
    }

    /// <summary>
    /// O'quvchining "Uyga vazifalar" paneli (5 ta filtr: All, Completed, Penalty, Unchecked, Pending)
    /// </summary>
    [HttpGet("student")]
    public async Task<IActionResult> GetStudentAssignments([FromQuery] long groupId, [FromQuery] string filter = "All", [FromQuery] long? studentId = null)
    {
        var sId = studentId ?? GetUserId();
        if (sId == 0) return Unauthorized(new { message = "Student ID not identified" });

        var assignments = await _assignmentService.GetStudentAssignmentsAsync(groupId, sId, filter);
        return Ok(assignments);
    }

    /// <summary>
    /// O'qituvchining tekshirish navbati (Review Queue)
    /// </summary>
    [HttpGet("review")]
    public async Task<IActionResult> GetTeacherSubmissions([FromQuery] long groupId, [FromQuery] string? filter = null, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var queue = await _assignmentService.GetTeacherSubmissionsAsync(groupId, tId, filter);
        return Ok(queue);
    }

    /// <summary>
    /// Qism topshirig'ini baholash: 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi + izoh
    /// </summary>
    [HttpPost("submissions/{submissionId}/grade")]
    public async Task<IActionResult> GradeSubmission(long submissionId, [FromBody] GradeSubmissionDto dto, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var success = await _assignmentService.GradeItemSubmissionAsync(submissionId, tId, dto);
            if (!success) return BadRequest(new { message = "Failed to grade submission" });
            return Ok(new { success = true });
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// 3-tur: Media topshiriqqa audio, video yoki rasm biriktirish
    /// </summary>
    [HttpPost("items/{itemId}/submit-media")]
    public async Task<IActionResult> SubmitMedia(long itemId, [FromBody] List<AttachmentDto> attachments, [FromQuery] long? studentId = null)
    {
        var sId = studentId ?? GetUserId();
        if (sId == 0) return Unauthorized(new { message = "Student ID not identified" });

        var sub = await _assignmentService.SubmitMediaItemAsync(sId, itemId, attachments);
        return Ok(sub);
    }

    /// <summary>
    /// 2-tur: Lug'at testi natijasini topshirish (avtomatik foiz hisoblash va status belgilash)
    /// </summary>
    [HttpPost("items/submit-quiz")]
    public async Task<IActionResult> SubmitQuiz([FromBody] SubmitQuizResultDto dto, [FromQuery] long? studentId = null)
    {
        var sId = studentId ?? GetUserId();
        if (sId == 0) return Unauthorized(new { message = "Student ID not identified" });

        var sub = await _assignmentService.SubmitQuizResultAsync(sId, dto);
        return Ok(sub);
    }

    /// <summary>
    /// 1-tur: Oddiy matnli eslatmani o'qituvchi tomonidan tasdiqlash (Check)
    /// </summary>
    [HttpPost("items/{itemId}/check-reminder")]
    public async Task<IActionResult> CheckReminder(long itemId, [FromQuery] long studentId, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var success = await _assignmentService.CheckTextReminderAsync(itemId, studentId, tId);
            if (!success) return BadRequest(new { message = "Failed to check reminder" });
            return Ok(new { success = true });
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Guruhdagi barcha dars vazifalari (Qilganlar va Qilmaganlar statistikasi bilan)
    /// </summary>
    [HttpGet("group/{groupId}")]
    public async Task<IActionResult> GetGroupAssignments(long groupId, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var assignments = await _assignmentService.GetGroupAssignmentsAsync(groupId, tId);
        return Ok(assignments);
    }

    /// <summary>
    /// Uyga vazifa bo'yicha to'liq hisobot: Qilganlar va Qilmaganlar (Missing students) ro'yxati
    /// </summary>
    [HttpGet("{id}/report")]
    public async Task<IActionResult> GetAssignmentReport(long id, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var report = await _assignmentService.GetAssignmentReportAsync(id, tId);
            if (report == null) return NotFound(new { message = "Assignment not found or access denied" });
            return Ok(report);
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Vazifani hali topshirmagan (qilmagan) o'quvchilarga Telegram Bot orqali eslatma yuborish
    /// </summary>
    [HttpPost("{id}/remind-missing")]
    public async Task<IActionResult> RemindMissingStudents(long id, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var success = await _assignmentService.RemindMissingStudentsAsync(id, tId);
        return Ok(new { success });
    }

    /// <summary>
    /// O'qituvchining tekshirish navbati: Talabalar bo'yicha guruhlangan (eng oxirgi topshirgan birinchi)
    /// </summary>
    [HttpGet("review-groups")]
    public async Task<IActionResult> GetTeacherReviewGroups([FromQuery] long groupId, [FromQuery] string? filter = null, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        var groups = await _assignmentService.GetTeacherReviewGroupsAsync(groupId, tId, filter);
        return Ok(groups);
    }

    /// <summary>
    /// Talabaning guruh bo'yicha barcha topshiriqlari va submissionlari tarixi (Timeline)
    /// </summary>
    [HttpGet("groups/{groupId}/students/{studentId}/history")]
    public async Task<IActionResult> GetStudentTimelineHistory(long groupId, long studentId)
    {
        var history = await _assignmentService.GetStudentTimelineHistoryAsync(groupId, studentId);
        return Ok(history);
    }

    /// <summary>
    /// O'qituvchi tomonidan o'quvchining vazifasini qo'lda Bajarildi yoki Bajarilmadi deb belgilash (Toggle status)
    /// </summary>
    [HttpPost("{id}/students/{studentId}/toggle-status")]
    public async Task<IActionResult> ToggleStudentAssignmentStatus(long id, long studentId, [FromQuery] bool isCompleted = true, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var success = await _assignmentService.ToggleStudentAssignmentStatusAsync(id, studentId, isCompleted, tId);
            if (!success) return BadRequest(new { message = "Failed to toggle assignment status" });
            return Ok(new { success = true });
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// O'qituvchi tomonidan o'quvchining vazifasini aniq statusga o'tkazish (1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajardi, -1 = Bekor qilish)
    /// </summary>
    [HttpPost("{id}/students/{studentId}/set-status")]
    public async Task<IActionResult> SetStudentAssignmentStatus(
        long id, 
        long studentId, 
        [FromQuery] int status, 
        [FromQuery] string? comment = null, 
        [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        if (status == 0 && string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { message = "Jarima (punishment) holatiga o'tkazish uchun jazo izohi kiritilishi shart!" });
        }

        try
        {
            var success = await _assignmentService.SetStudentAssignmentStatusAsync(id, studentId, status, tId, comment);
            if (!success) return BadRequest(new { message = "Failed to update assignment status" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// O'qituvchi tomonidan ma'lum bir topshiriq qismiga (AssignmentItem) alohida status belgilash
    /// status: 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajardi, -1 = Bekor qilish
    /// </summary>
    [HttpPost("{id}/items/{itemId}/students/{studentId}/grade")]
    public async Task<IActionResult> GradeStudentItem(
        long id,
        long itemId,
        long studentId,
        [FromQuery] int status,
        [FromQuery] string? comment = null,
        [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        if (status == 0 && string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { message = "Jarima (punishment) holatiga o'tkazish uchun jazo izohi kiritilishi shart!" });
        }

        try
        {
            var success = await _assignmentService.GradeStudentItemAsync(id, itemId, studentId, status, tId, comment);
            if (!success) return BadRequest(new { message = "Failed to update item status" });
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Vazifani tahrirlash (Title, Deadline, Items izohlari)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAssignment(long id, [FromBody] UpdateAssignmentDto dto, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var ok = await _assignmentService.UpdateAssignmentAsync(id, tId, dto);
            if (!ok) return NotFound(new { message = "Vazifa topilmadi yoki tahrirlab bo'lmadi" });
            return Ok(new { success = true, message = "Vazifa muvaffaqiyatli yangilandi" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Vazifani to'liq o'chirish (Assignment, unga tegishli items va submissions)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAssignment(long id, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        if (tId == 0) return Unauthorized(new { message = "Teacher ID not identified" });

        try
        {
            var ok = await _assignmentService.DeleteAssignmentAsync(id, tId);
            if (!ok) return NotFound(new { message = "Vazifa topilmadi yoki o'chirib bo'lmadi" });
            return Ok(new { success = true, message = "Vazifa muvaffaqiyatli o'chirildi" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Biriktirilgan faylni o'chirish
    /// </summary>
    [HttpDelete("attachments/{id}")]
    public async Task<IActionResult> DeleteAttachment(long id, [FromQuery] long? userId = null)
    {
        var uId = userId ?? GetUserId();
        if (uId == 0) return Unauthorized(new { message = "User ID not identified" });

        var ok = await _assignmentService.DeleteAttachmentAsync(id, uId);
        if (!ok) return BadRequest(new { message = "Failed to delete attachment" });

        return Ok(new { success = true });
    }

    /// <summary>
    /// Media faylni ko'rish yoki yuklab olish (Audio, Video, Rasm)
    /// </summary>
    [HttpGet("attachments/{id}/content")]
    public async Task<IActionResult> GetAttachmentContent(
        long id,
        [FromServices] Lanswitch.Infrastructure.Data.AppDbContext db,
        [FromServices] Telegram.Bot.ITelegramBotClient botClient,
        [FromServices] Microsoft.Extensions.Configuration.IConfiguration config)
    {
        var att = await db.ItemSubmissionAttachments.FindAsync(id);
        if (att == null) return NotFound("Attachment not found");

        try
        {
            var file = await botClient.GetFile(att.TelegramFileId);
            if (!string.IsNullOrEmpty(file.FilePath))
            {
                var botToken = config["BotConfiguration:BotToken"];
                var telegramFileUrl = $"https://api.telegram.org/file/bot{botToken}/{file.FilePath}";
                return Redirect(telegramFileUrl);
            }
        }
        catch (System.Exception)
        {
            // If file is > 20MB, redirect to Telegram Bot start link
            try
            {
                var me = await botClient.GetMe();
                return Redirect($"https://t.me/{me.Username ?? "lanswitchbot"}?start=view_att_{id}");
            }
            catch {}
        }

        return NotFound();
    }

    /// <summary>
    /// Student uchun botga media topshiriq yuklash holatini tayyorlash va bot orqali xabar yuborish
    /// </summary>
    [HttpPost("items/{itemId}/prepare-upload")]
    public async Task<IActionResult> PrepareMediaUpload([FromRoute] long itemId, [FromQuery] long? studentId = null)
    {
        var sId = studentId ?? GetUserId();
        if (sId == 0) return Unauthorized(new { message = "Student ID not identified" });

        try
        {
            var res = await _assignmentService.PrepareMediaUploadAsync(itemId, sId);
            if (!res.Success)
            {
                return BadRequest(new { message = res.Message });
            }
            return Ok(res);
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Biriktirilgan faylni (video, audio, voice, photo) to'g'ridan-to'g'ri Telegram bot orqali foydalanuvchiga yuborish
    /// </summary>
    [HttpPost("attachments/{id}/send-to-bot")]
    public async Task<IActionResult> SendAttachmentToBot([FromRoute] long id, [FromQuery] long? userId = null)
    {
        var uId = userId ?? GetUserId();
        if (uId == 0) return Unauthorized(new { message = "User ID not identified" });

        try
        {
            var res = await _assignmentService.SendAttachmentToTelegramAsync(id, uId);
            if (!res.Success)
            {
                return BadRequest(new { message = res.Message });
            }
            return Ok(res);
        }
        catch (System.Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Yangi bo'sh AI qoralama yaratish
    /// </summary>
    [HttpPost("draft/init")]
    public async Task<IActionResult> InitHomeworkDraft([FromQuery] long groupId, [FromQuery] long? teacherId = null)
    {
        var tId = teacherId ?? GetUserId();
        var draftCode = System.Guid.NewGuid().ToString("N")[..8];
        var group = await _db.TelegramGroups.FindAsync(groupId);
        var draft = new AiHomeworkDraft
        {
            DraftCode = draftCode,
            TeacherId = tId,
            GroupId = groupId,
            RawInputText = "",
            Title = $"{System.DateTime.UtcNow:dd.MM.yyyy} Darsi",
            Deadline = System.DateTime.UtcNow.AddDays(2),
            ItemsJson = "[]",
            Status = "PendingConfirm"
        };
        _db.AiHomeworkDrafts.Add(draft);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            draftCode = draft.DraftCode,
            groupId = draft.GroupId,
            groupTitle = group?.Title ?? "Dars guruhi",
            title = draft.Title,
            deadline = draft.Deadline,
            items = new List<AiHomeworkAnalysisItem>(),
            status = draft.Status
        });
    }

    /// <summary>
    /// AI Uyga vazifa qoralamasini olish (DraftCode orqali)
    /// </summary>
    [HttpGet("draft/{draftCode}")]
    public async Task<IActionResult> GetHomeworkDraft([FromRoute] string draftCode)
    {
        var draft = await _db.AiHomeworkDrafts
            .Include(d => d.Group)
            .FirstOrDefaultAsync(d => d.DraftCode == draftCode);

        if (draft == null)
            return NotFound(new { message = "Qoralama topilmadi" });

        var items = JsonSerializer.Deserialize<List<AiHomeworkAnalysisItem>>(draft.ItemsJson) ?? new();

        return Ok(new
        {
            draftCode = draft.DraftCode,
            groupId = draft.GroupId,
            groupTitle = draft.Group?.Title ?? "Dars guruhi",
            title = draft.Title,
            deadline = draft.Deadline,
            items = items,
            status = draft.Status,
            explanation = draft.Explanation
        });
    }

    /// <summary>
    /// AI orqali qoralamani matnli ko'rsatma bilan o'zgartirish (Refine)
    /// </summary>
    [HttpPost("draft/{draftCode}/refine")]
    public async Task<IActionResult> RefineHomeworkDraft([FromRoute] string draftCode, [FromBody] RefineDraftDto request)
    {
        var draft = await _db.AiHomeworkDrafts
            .Include(d => d.Group)
            .FirstOrDefaultAsync(d => d.DraftCode == draftCode);

        if (draft == null)
            return NotFound(new { message = "Qoralama topilmadi" });

        var currentItems = JsonSerializer.Deserialize<List<AiHomeworkAnalysisItem>>(draft.ItemsJson) ?? new();
        var currentAnalysis = new AiHomeworkAnalysisResult
        {
            Title = draft.Title,
            DeadlineDays = Math.Max(1, (int)Math.Ceiling((draft.Deadline - System.DateTime.UtcNow.Date).TotalDays)),
            DeadlineTime = draft.Deadline.ToString("HH:mm"),
            Explanation = draft.Explanation,
            Items = currentItems
        };

        var teacherContextEntity = await _db.TeacherHomeworkContexts
            .Where(c => c.TeacherId == draft.TeacherId && (c.GroupId == draft.GroupId || c.GroupId == null))
            .OrderByDescending(c => c.GroupId)
            .FirstOrDefaultAsync();

        var refined = await _gemini.RefineHomeworkDraftAsync(currentAnalysis, request.Prompt, teacherContextEntity?.LearnedContext);
        await Lanswitch.Infrastructure.Services.HomeworkUnitResolver.ResolveAndValidateUnitsAsync(_db, refined.Items);

        draft.Title = refined.Title;
        draft.Deadline = System.DateTime.UtcNow.Date.AddDays(refined.DeadlineDays).Add(refined.GetDeadlineTimeSpan());
        draft.ItemsJson = JsonSerializer.Serialize(refined.Items);
        draft.Explanation = refined.Explanation;
        draft.Status = "DraftReady";

        // AI dan context matn olish va uni saqlab borish (har safar generda foydalanish uchun)
        try
        {
            if (teacherContextEntity == null)
            {
                teacherContextEntity = new TeacherHomeworkContext
                {
                    TeacherId = draft.TeacherId,
                    GroupId = draft.GroupId,
                    LearnedContext = ""
                };
                _db.TeacherHomeworkContexts.Add(teacherContextEntity);
            }

            var updatedContext = await _gemini.LearnContextFromModificationPromptAsync(teacherContextEntity.LearnedContext, request.Prompt);
            teacherContextEntity.LearnedContext = updatedContext;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error learning context in RefineHomeworkDraft: {ex.Message}");
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            draftCode = draft.DraftCode,
            groupId = draft.GroupId,
            groupTitle = draft.Group?.Title ?? "Dars guruhi",
            title = draft.Title,
            deadline = draft.Deadline,
            items = refined.Items,
            status = draft.Status,
            explanation = draft.Explanation,
            unsupportedRequests = refined.UnsupportedRequests
        });
    }

    /// <summary>
    /// O'qituvchi tomonidan qoralamani qo'lda tahrirlash (Title, Deadline, Items)
    /// </summary>
    [HttpPost("draft/{draftCode}/update")]
    public async Task<IActionResult> UpdateHomeworkDraft([FromRoute] string draftCode, [FromBody] UpdateDraftDto request)
    {
        var draft = await _db.AiHomeworkDrafts
            .Include(d => d.Group)
            .FirstOrDefaultAsync(d => d.DraftCode == draftCode);

        if (draft == null)
            return NotFound(new { message = "Qoralama topilmadi" });

        if (!string.IsNullOrWhiteSpace(request.Title))
            draft.Title = request.Title;

        if (request.Deadline != default)
            draft.Deadline = request.Deadline;

        if (request.Items != null)
        {
            var analysisItems = request.Items.Select(it => new AiHomeworkAnalysisItem
            {
                ItemType = it.ItemType,
                Title = it.Title,
                Instructions = it.Instructions,
                TargetUnitId = it.TargetUnitId
            }).ToList();
            await Lanswitch.Infrastructure.Services.HomeworkUnitResolver.ResolveAndValidateUnitsAsync(_db, analysisItems);
            draft.ItemsJson = JsonSerializer.Serialize(analysisItems);
        }

        draft.Status = "DraftReady";
        await _db.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Qoralamani rasmiy e'lon qilish (Guruhga chiqarish)
    /// </summary>
    [HttpPost("draft/{draftCode}/publish")]
    public async Task<IActionResult> PublishHomeworkDraft([FromRoute] string draftCode, [FromQuery] long? teacherId = null)
    {
        var draft = await _db.AiHomeworkDrafts
            .Include(d => d.Group)
            .FirstOrDefaultAsync(d => d.DraftCode == draftCode);

        if (draft == null)
            return NotFound(new { message = "Qoralama topilmadi" });

        var tId = teacherId ?? draft.TeacherId;
        var items = JsonSerializer.Deserialize<List<AiHomeworkAnalysisItem>>(draft.ItemsJson) ?? new();
        await Lanswitch.Infrastructure.Services.HomeworkUnitResolver.ResolveAndValidateUnitsAsync(_db, items);

        var dto = new CreateAssignmentDto
        {
            GroupId = draft.GroupId,
            Title = draft.Title,
            Deadline = draft.Deadline,
            Items = items.Select((it, i) => new CreateAssignmentItemDto
            {
                OrderIndex = i + 1,
                ItemType = it.ItemType,
                Title = it.Title,
                Instructions = it.Instructions,
                TargetUnitId = it.TargetUnitId
            }).ToList()
        };

        var created = await _assignmentService.CreateAssignmentAsync(tId, dto);
        draft.Status = "Published";
        await _db.SaveChangesAsync();

        try
        {
            var context = await _db.TeacherHomeworkContexts
                .FirstOrDefaultAsync(c => c.TeacherId == tId && (c.GroupId == draft.GroupId || c.GroupId == null));

            if (context == null)
            {
                context = new TeacherHomeworkContext
                {
                    TeacherId = tId,
                    GroupId = draft.GroupId,
                    LearnedContext = "",
                    TotalAssignmentsCreated = 0
                };
                _db.TeacherHomeworkContexts.Add(context);
            }

            var itemsDesc = string.Join("; ", created.Items.Select(i => $"{i.Title} ({i.ItemType}: {i.Instructions})"));
            var summary = $"Mavzu: {created.Title}, Muddat: {created.Deadline:dd.MM.yyyy HH:mm}, Topshiriqlar: {itemsDesc}";
            var newLearned = await _gemini.LearnAndUpdateTeacherContextAsync(context.LearnedContext, summary);
            context.LearnedContext = newLearned;
            context.TotalAssignmentsCreated++;
            context.LastTemplateJson = draft.ItemsJson;
            await _db.SaveChangesAsync();
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"Error updating learned teacher context: {ex.Message}");
        }

        return Ok(created);
    }
}

public class RefineDraftDto
{
    public string Prompt { get; set; } = null!;
}

public class UpdateDraftDto
{
    public string? Title { get; set; }
    public System.DateTime Deadline { get; set; }
    public List<AiHomeworkAnalysisItem>? Items { get; set; }
}
