using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class BookUnit : BaseEntity
{
    public long PartId { get; set; }
    public int UnitNumber { get; set; } // 1, 2, 3...
    public string Title { get; set; } = null!; // e.g. "Family and Friends"

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual BookPart Part { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<BookWord> Words { get; set; } = new List<BookWord>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<AssignmentItem> AssignmentItems { get; set; } = new List<AssignmentItem>();
}
