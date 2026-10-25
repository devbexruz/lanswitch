using System;

namespace Lanswitch.Domain.Entities;

public class SubscriptionPlanConfig : BaseEntity
{
    public string PlanId { get; set; } = null!; // "student_monthly", "teacher_standart", "teacher_pro", "teacher_max"
    public string Name { get; set; } = null!;
    public string TargetRole { get; set; } = "Student"; // "Student" or "Teacher"
    public decimal MonthlyPrice { get; set; }
    public string Period { get; set; } = "1 oy";
    public int MaxGroups { get; set; } = 0;
    public bool HasTrial { get; set; } = false;
    public int TrialDays { get; set; } = 0;
    public string Badge { get; set; } = "";
    public string FeaturesJson { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
    public int OrderIndex { get; set; } = 0;
}
