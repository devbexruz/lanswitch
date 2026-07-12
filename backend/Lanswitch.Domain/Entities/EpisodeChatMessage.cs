namespace Lanswitch.Domain.Entities;

public class EpisodeChatMessage : BaseEntity
{
    
    // "User" or "AI"
    public string Role { get; set; } = null!;
    
    public string Content { get; set; } = null!;
    
    // The specific subtitle the user asked about (optional)
    public long? ContextSubtitleId { get; set; }

    public long EpisodeId { get; set; }
    
    public long UserId { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User User { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Episode ChatEpisode { get; set; } = null!;
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Subtitle? ContextSubtitle { get; set; } = null!;
}
