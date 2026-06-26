namespace Lanswitch.Domain.Entities;

public class LearningLanguage : BaseEntity
{
    public long UserId { get; set; }
    public long LanguageId { get; set; }
    public string Level { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? Language { get; set; }
}
