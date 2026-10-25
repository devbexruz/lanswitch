using System;
using System.Collections.Generic;

namespace Lanswitch.Domain.Entities;

public class User : BaseEntity
{
    public long NativeLanguageId { get; set; } = 1;
    public string TelegramId { get; set; } = null!;
    public string? Username { get; set; }
    public string FullName { get; set; } = null!;
    public string? ProfileImage { get; set; }
    public string? AvatarUrl { get; set; } // Dinamik Telegram profile photo URL
    public string Role { get; set; } = "Student"; // "Student", "Teacher", "Admin"
    public bool IsAdmin { get; set; } = false;
    public decimal Balance { get; set; } = 0; // Foydalanuvchi hisob balansi (so'm)
    public bool HasReceivedInitialBonus { get; set; } = false; // 25,000 so'm boshlang'ich bonus berilganmi
    
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

    // Telegram Groups & Assignments
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<TelegramGroup> OwnedGroups { get; set; } = new List<TelegramGroup>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<GroupAdmin> GroupAdmins { get; set; } = new List<GroupAdmin>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<GroupMember> GroupMembers { get; set; } = new List<GroupMember>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<Assignment> CreatedAssignments { get; set; } = new List<Assignment>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<AssignmentItemSubmission> Submissions { get; set; } = new List<AssignmentItemSubmission>();

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual ICollection<UserSubscription> Subscriptions { get; set; } = new List<UserSubscription>();
}
