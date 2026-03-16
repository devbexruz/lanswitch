namespace backend.Models;

using System.ComponentModel.DataAnnotations;

public class User : Base
{
    [Required] // Bu maydon bo'sh bo'lishi mumkin emas
    [MaxLength(255)] // Uzunligi cheklangan
    public string Username { get; set; } = string.Empty;

    [Required] // Bu maydon bo'sh bo'lishi mumkin emas
    [MaxLength(255)] // Uzunligi cheklangan
    public string Email { get; set; } = string.Empty;

    [Required] // Bu maydon bo'sh bo'lishi mumkin emas
    public string Password { get; set; } = string.Empty;
}