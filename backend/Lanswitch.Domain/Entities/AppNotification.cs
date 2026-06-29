using System;

namespace Lanswitch.Domain.Entities;

public class AppNotification : BaseEntity
{
    public long UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string Type { get; set; } = "info"; // success, warning, info
    public bool IsRead { get; set; }
    public string? Link { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
