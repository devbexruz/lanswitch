using System;

namespace Lanswitch.Domain.Entities;

public class GroupMember : BaseEntity
{
    public long GroupId { get; set; }
    public long StudentId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup Group { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Student { get; set; } = null!;
}
