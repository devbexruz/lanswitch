using System;
using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Subtitle : BaseEntity
{
    public long MediaId { get; set; }
    public long? EpisodeId { get; set; }
    public int Index { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public string Text { get; set; } = null!;
    
    public float[]? Embedding { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Media? Media { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Episode? Episode { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Gap> Gaps { get; set; } = new List<Gap>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<SubtitleWord> SubtitleWords { get; set; } = new List<SubtitleWord>();
}
