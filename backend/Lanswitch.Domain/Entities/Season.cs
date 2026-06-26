using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Season : BaseEntity
{
    public long MediaId { get; set; }
    public int SeasonNumber { get; set; }
    public string? Title { get; set; }
    public string? About { get; set; }
    public string ThumbnailUrl { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Media? Media { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Episode> Episodes { get; set; } = new List<Episode>();
}
