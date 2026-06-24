namespace Lanswitch.Domain.Entities;

public class Vocabulary
{
    public int Id { get; set; }
    public string Word { get; set; } = string.Empty;
    public string Translation { get; set; } = string.Empty;
    public string GrammarContext { get; set; } = string.Empty;
    public int AnimeEpisodeId { get; set; }
}