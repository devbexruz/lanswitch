using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class User : BaseEntity
{
    public long NativeLanguageId { get; set; }
    public string TelegramId { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImage { get; set; }
    public bool IsAdmin { get; set; } = false;
    
    // Auth Magic Link
    public string? LoginToken { get; set; }
    public DateTime? LoginTokenExpiry { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Language? NativeLanguage { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<LearningLanguage> LearningLanguages { get; set; } = new List<LearningLanguage>();
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserWord> UserWords { get; set; } = new List<UserWord>();
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserGrammar> UserGrammars { get; set; } = new List<UserGrammar>();
    
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserSession> UserSessions { get; set; } = new List<UserSession>();
}
