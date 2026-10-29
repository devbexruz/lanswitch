namespace Lanswitch.Domain.Entities;

public class MediaLike : BaseEntity
{
    public long MediaId { get; set; }
    public long UserId { get; set; }
    public bool IsDislike { get; set; } = false;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Media? Media { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
