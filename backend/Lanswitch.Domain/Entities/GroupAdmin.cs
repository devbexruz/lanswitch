namespace Lanswitch.Domain.Entities;

public class GroupAdmin : BaseEntity
{
    public long GroupId { get; set; }
    public long UserId { get; set; }
    public bool IsOwner { get; set; } = false;
    public bool CanCreateHomework { get; set; } = true;
    public bool CanReviewHomework { get; set; } = true;
    public bool CanManageMembers { get; set; } = true;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup Group { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User User { get; set; } = null!;
}
