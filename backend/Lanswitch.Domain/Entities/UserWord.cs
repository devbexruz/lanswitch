using System;

namespace Lanswitch.Domain.Entities;

public class UserWord : BaseEntity
{
    public long UserId { get; set; }
    public long WordId { get; set; }
    public int RepeatedCount { get; set; } = 0;
    public DateTime EndRepeatedDatetime { get; set; }
    public string Status { get; set; } = "new";

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Word? Word { get; set; }
}
