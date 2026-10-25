using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface ISubscriptionService
{
    Task<List<SubscriptionPlanConfig>> GetPlansAsync();
    Task<SubscriptionPlanConfig> UpdatePlanAsync(string planId, SubscriptionPlanConfig updated);
    Task<CardPaymentSetting> GetCardSettingsAsync();
    Task<CardPaymentSetting> UpdateCardSettingsAsync(CardPaymentSetting updated);
    
    Task<object> CalculateSwitchAsync(long userId, string targetPlanId, decimal additionalAmount);
    
    Task<SubscriptionPaymentRequest> SubmitReceiptAsync(long userId, string planId, decimal amount, string receiptUrl);
    Task<SubscriptionPaymentRequest> ApprovePaymentRequestAsync(long requestId, decimal? correctedAmount, string? adminNotes, string? processedBy);
    Task<SubscriptionPaymentRequest> RejectPaymentRequestAsync(long requestId, string? reason, string? processedBy);
    
    Task<UserSubscription> GrantSubscriptionAsync(long userId, string planId, int durationDays, string? notes, string? processedBy);
    Task<object> GetLogsAndStatsAsync();
}
