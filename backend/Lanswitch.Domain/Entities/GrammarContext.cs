using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class GrammarContext : BaseEntity
{
    public long LanguageId { get; set; }
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Content { get; set; } = null!;
    public string? VideoUrl { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? Language { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserGrammar> UserGrammars { get; set; } = new List<UserGrammar>();
}
