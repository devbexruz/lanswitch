using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class BookPart : BaseEntity
{
    public long BookId { get; set; }
    public int PartNumber { get; set; } // 1, 2, 3...
    public string? Title { get; set; } // e.g. "Part 1"

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Book Book { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<BookUnit> Units { get; set; } = new List<BookUnit>();
}
