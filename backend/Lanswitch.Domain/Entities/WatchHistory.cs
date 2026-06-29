using System;

namespace Lanswitch.Domain.Entities;

public class WatchHistory : BaseEntity
{
    public long UserId { get; set; }
    public long MediaId { get; set; }
    public long? EpisodeId { get; set; }
    
    public int CurrentTimeSeconds { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime LastWatchedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Media? Media { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Episode? Episode { get; set; }
}
