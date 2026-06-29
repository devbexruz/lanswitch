namespace Lanswitch.Domain.Entities;

public class Gap : BaseEntity
{
    public string Text { get; set; } = null!;
    public long SubtitleId { get; set; }
    public int Index { get; set; }
    public string? AiAnalysis { get; set; } // Stores markdown analysis from Gemini

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Subtitle? Subtitle { get; set; }
}
