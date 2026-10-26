using System;

namespace Lanswitch.Domain.Entities;

public class TeacherHomeworkContext : BaseEntity
{
    public long TeacherId { get; set; }
    public long? GroupId { get; set; }
    public string LearnedContext { get; set; } = "";
    public string? LastTemplateJson { get; set; }
    public int TotalAssignmentsCreated { get; set; } = 0;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User Teacher { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup? Group { get; set; }
}
