using System;

namespace Lanswitch.Domain.Entities;

public class CardPaymentSetting : BaseEntity
{
    public string CardNumber { get; set; } = "9860 0000 0000 0000";
    public string CardHolder { get; set; } = "ADMINISTRATOR";
    public string BankName { get; set; } = "Humo / Uzcard";
    public decimal MinAmount { get; set; } = 15000;
    public string? Instructions { get; set; } = "Xohlagancha pul o'tkazing, minimum 15,000 so'm. Tarifingizga mos ravishda muddat soat va minutlarigacha hisoblab qo'shiladi.";
    public bool IsActive { get; set; } = true;
}
