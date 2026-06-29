namespace Lanswitch.Domain.Entities;

public class SubtitleWord : BaseEntity
{
    public long SubtitleId { get; set; }
    public long WordId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Subtitle? Subtitle { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Word? Word { get; set; }
}
