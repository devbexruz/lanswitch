using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Episode : BaseEntity
{
    public long SeasonId { get; set; }
    public int EpisodeNumber { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string VideoUrl { get; set; } = null!;
    public string Level { get; set; } = null!;
    public string ThumbnailUrl { get; set; } = null!;
    public int? DurationalMinutes { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Season? Season { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Subtitle> Subtitles { get; set; } = new List<Subtitle>();
}
