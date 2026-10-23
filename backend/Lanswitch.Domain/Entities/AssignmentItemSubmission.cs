using System;
using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class AssignmentItemSubmission : BaseEntity
{
    public long AssignmentId { get; set; }
    public long AssignmentItemId { get; set; }
    public long StudentId { get; set; }
    
    // Status: null = Tekshirilmagan, 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi
    public int? Status { get; set; }
    public string? Comment { get; set; }
    public long? ReviewedById { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Assignment Assignment { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual AssignmentItem AssignmentItem { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Student { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? ReviewedBy { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<ItemSubmissionAttachment> Attachments { get; set; } = new List<ItemSubmissionAttachment>();
}
