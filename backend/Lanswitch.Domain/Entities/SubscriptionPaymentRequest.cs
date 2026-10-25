using System;

namespace Lanswitch.Domain.Entities;

public class SubscriptionPaymentRequest : BaseEntity
{
    public long UserId { get; set; }
    public string PlanId { get; set; } = null!;
    public string PlanName { get; set; } = null!;
    public decimal Amount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public decimal CalculatedDurationHours { get; set; }
    public int CalculatedDurationMinutes { get; set; }
    public string ReceiptImageUrl { get; set; } = null!;
    public string Status { get; set; } = "Pending"; // "Pending", "Approved", "Rejected"
    public string? AdminNotes { get; set; }
    public int? AdminTelegramMessageId { get; set; }
    public long? AdminChatId { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? ProcessedBy { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
