using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class Language : BaseEntity
{
    public string Title { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<LearningLanguage> LearningLanguages { get; set; } = new List<LearningLanguage>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<User> NativeUsers { get; set; } = new List<User>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Word> Words { get; set; } = new List<Word>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Media> Medias { get; set; } = new List<Media>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<GrammarContext> GrammarContexts { get; set; } = new List<GrammarContext>();
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<WordTranslate> WordTranslates { get; set; } = new List<WordTranslate>();
}
