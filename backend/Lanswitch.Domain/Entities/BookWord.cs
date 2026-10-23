namespace Lanswitch.Domain.Entities;

public class BookWord : BaseEntity
{
    public long UnitId { get; set; }
    public string Word { get; set; } = null!;
    public string? Ipa { get; set; } // /ˈfæm.əl.i/
    public string TranslationUz { get; set; } = null!; // O'zbekcha tarjimasi
    public string? PartOfSpeech { get; set; } // noun, verb, adjective...
    public string? ExampleSentence { get; set; }
    public string? AudioTelegramFileId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual BookUnit Unit { get; set; } = null!;
}
