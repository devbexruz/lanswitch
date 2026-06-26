using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Category : BaseEntity
{
    public string Name { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Media> Medias { get; set; } = new List<Media>();
}
