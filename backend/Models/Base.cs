namespace backend.Models;

using System.ComponentModel.DataAnnotations;

public abstract class Base 
{
    [Key] // Bu maydon Primary Key (ID) bo'lishini bildiradi
    public int Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; } = null;
}
