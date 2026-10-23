using System;
using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Assignment : BaseEntity
{
    public long GroupId { get; set; }
    public long CreatorId { get; set; }
    public string Title { get; set; } = null!; // Sana yoki Custom Title
    public DateTime Deadline { get; set; }
    public string Status { get; set; } = "Published"; // "Published", "Closed"

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup Group { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Creator { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<AssignmentItem> Items { get; set; } = new List<AssignmentItem>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<AssignmentItemSubmission> Submissions { get; set; } = new List<AssignmentItemSubmission>();
}
