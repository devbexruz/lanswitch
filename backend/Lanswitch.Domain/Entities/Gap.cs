namespace Lanswitch.Domain.Entities;

public class Gap : BaseEntity
{
    public string Text { get; set; } = null!;
    public long GrammarContextId { get; set; }
    public long SubtitleId { get; set; }
    public int Index { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual GrammarContext? GrammarContext { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public virtual Subtitle? Subtitle { get; set; }
}
