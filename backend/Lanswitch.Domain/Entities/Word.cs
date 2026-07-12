using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Word : BaseEntity
{
    public long LanguageId { get; set; }
    
    public string Text { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? Language { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<WordTranslate> Translates { get; set; } = new List<WordTranslate>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserWord> UserWords { get; set; } = new List<UserWord>();
}
