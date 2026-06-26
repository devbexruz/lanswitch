namespace Lanswitch.Domain.Entities;

public class WordTranslate : BaseEntity
{
    public long WordId { get; set; }
    public long LanguageId { get; set; }
    public string TranslateText { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Word? Word { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? Language { get; set; }
}
