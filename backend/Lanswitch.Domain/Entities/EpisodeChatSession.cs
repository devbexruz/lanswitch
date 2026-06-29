using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class EpisodeChatSession : BaseEntity
{
    public long EpisodeId { get; set; }
    public long? UserId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Episode? Episode { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<EpisodeChatMessage> Messages { get; set; } = new List<EpisodeChatMessage>();
}
