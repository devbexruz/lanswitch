namespace Lanswitch.Domain.Entities;

public class ItemSubmissionAttachment : BaseEntity
{
    public long ItemSubmissionId { get; set; }
    public string TelegramFileId { get; set; } = null!;
    public long? TelegramMessageId { get; set; }
    public string FileType { get; set; } = null!; // "voice", "video", "photo"
    public long FileSizeBytes { get; set; }
    public string TelegramDeepLink { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual AssignmentItemSubmission ItemSubmission { get; set; } = null!;
}
