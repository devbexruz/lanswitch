using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class AssignmentItem : BaseEntity
{
    public long AssignmentId { get; set; }
    public int OrderIndex { get; set; } = 1;
    public string ItemType { get; set; } = null!; // "TextReminder", "Vocabulary", "MediaSubmission"
    public string Title { get; set; } = null!;
    public string? Instructions { get; set; }
    public long? TargetUnitId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Assignment Assignment { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual BookUnit? TargetUnit { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<AssignmentItemSubmission> Submissions { get; set; } = new List<AssignmentItemSubmission>();
}
