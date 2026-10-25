using System;

namespace Lanswitch.Domain.Entities;

public class SubscriptionLog : BaseEntity
{
    public long UserId { get; set; }
    public string PlanId { get; set; } = null!;
    public string PlanName { get; set; } = null!;
    public string ActionType { get; set; } = "Payment"; // "TrialActivated", "CardPaymentApproved", "AdminManualGrant", "TariffSwitched", "Expired", "Cancelled"
    public decimal AmountPaid { get; set; }
    public decimal DurationHours { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string? PreviousPlanId { get; set; }
    public long? PaymentRequestId { get; set; }
    public string? Notes { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
