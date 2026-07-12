using System;

namespace Lanswitch.Domain.Entities;

public class UserGrammar : BaseEntity
{
    public long GrammarId { get; set; }
    public long UserId { get; set; }
    public int RepeatedCount { get; set; } = 0;
    public DateTime EndRepeatedDatetime { get; set; }
    public bool IsKnown { get; set; } = true;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual GrammarContext? Grammar { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
