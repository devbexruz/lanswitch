namespace Lanswitch.Domain.Entities;

public class CommentLike : BaseEntity
{
    public long CommentId { get; set; }
    public long UserId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Comment? Comment { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
