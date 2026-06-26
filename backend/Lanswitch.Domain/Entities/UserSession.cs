using System;

namespace Lanswitch.Domain.Entities;

public class UserSession : BaseEntity
{
    public long UserId { get; set; }
    public string Agent { get; set; } = null!;
    public string IpAddress { get; set; } = null!;
    public string Device { get; set; } = null!;
    public DateTime LoginedDatetime { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public string? RefreshTokenHash { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
