using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Book : BaseEntity
{
    public string Title { get; set; } = null!; // e.g. "Destination B1", "4000 Essential English Words"
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<BookPart> Parts { get; set; } = new List<BookPart>();
}
