using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Media : BaseEntity
{
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public long LanguageId { get; set; }
    public string VideoUrl { get; set; } = null!;
    public string Level { get; set; } = null!;
    public long CategoryId { get; set; }
    public string ThumbnailUrl { get; set; } = null!;
    public int? DurationalMinutes { get; set; }
    public bool IsFilm { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? Language { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Category? Category { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Season> Seasons { get; set; } = new List<Season>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Subtitle> Subtitles { get; set; } = new List<Subtitle>();
}
