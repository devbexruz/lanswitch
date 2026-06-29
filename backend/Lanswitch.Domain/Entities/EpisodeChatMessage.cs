namespace Lanswitch.Domain.Entities;

public class EpisodeChatMessage : BaseEntity
{
    public long SessionId { get; set; }
    
    // "User" or "AI"
    public string Role { get; set; } = null!;
    
    public string Content { get; set; } = null!;
    
    // The specific subtitle the user asked about (optional)
    public long? ContextSubtitleId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual EpisodeChatSession? Session { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Subtitle? ContextSubtitle { get; set; }
}
