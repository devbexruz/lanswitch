using System;

namespace Lanswitch.Domain.Entities;

public class UserSubscription : BaseEntity
{
    public long UserId { get; set; }
    public string PlanId { get; set; } = null!; // "student_monthly", "teacher_standart", "teacher_pro", "teacher_max"
    public string PlanName { get; set; } = null!; // "Student Premium", "Ustoz - Standart", etc.
    public string TargetRole { get; set; } = "Student"; // "Student" or "Teacher"
    public int MaxGroups { get; set; } = 0; // 0 for student, 3, 10, 20 for teachers
    public decimal Price { get; set; } // 50000, 99000, 189000, 249000
    public bool IsTrial { get; set; } = false; // true if 14 days free trial
    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = "Active"; // "Active", "Expired", "Cancelled"
    public string? Notes { get; set; }
    public DateTime? LastActivatedAt { get; set; }
    public decimal TotalPaidAmount { get; set; } = 0;

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? User { get; set; }
}
