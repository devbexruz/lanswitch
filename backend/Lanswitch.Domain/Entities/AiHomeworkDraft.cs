using System;

namespace Lanswitch.Domain.Entities;

public class AiHomeworkDraft : BaseEntity
{
    public string DraftCode { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public long TeacherId { get; set; }
    public long GroupId { get; set; }
    public string RawInputText { get; set; } = null!;
    public string? AudioFileId { get; set; }
    public string Title { get; set; } = "Yangi Uyga Vazifa";
    public DateTime Deadline { get; set; } = DateTime.UtcNow.AddDays(2);
    public string ItemsJson { get; set; } = "[]";
    public string? Explanation { get; set; }
    public string Status { get; set; } = "PendingConfirm"; // PendingConfirm, DraftReady, Published, Cancelled

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Teacher { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup Group { get; set; } = null!;
}
