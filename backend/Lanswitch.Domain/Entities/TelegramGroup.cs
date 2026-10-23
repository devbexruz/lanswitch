using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class TelegramGroup : BaseEntity
{
    public long TelegramChatId { get; set; }
    public long OwnerId { get; set; }
    public string Title { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Owner { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<GroupAdmin> Admins { get; set; } = new List<GroupAdmin>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();
}
