using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public class RootWordDto
{
    public string Word { get; set; } = null!;
    public string Translation { get; set; } = null!;
}

public class SentenceAnalysisResult
{
    public long SubtitleId { get; set; }
    public string SentenceText { get; set; } = null!;
    public string AiAnalysis { get; set; } = null!;
    public List<RootWordDto> RootWords { get; set; } = new List<RootWordDto>();
    public List<long> GrammarContextIds { get; set; } = new List<long>();
}

public interface IGeminiAiService
{
    Task<List<Subtitle>> TranscribeAudioAsync(List<string> audioFilePaths, long mediaId, int chunkMinutes = 11, int overlapMinutes = 1);
    Task<List<Subtitle>> MergeOverlappingSubtitlesAsync(List<Subtitle> firstPart, List<Subtitle> secondPart, TimeSpan overlapStart, TimeSpan overlapEnd);
    Task<List<SentenceAnalysisResult>?> AnalyzeGrammarAsync(string subtitlesJson, string targetLanguage = "Ingliz");
    Task<float[]> GenerateEmbeddingAsync(string text);
    Task<string> ChatWithContextAsync(string userMessage, List<EpisodeChatMessage> history, List<Subtitle> contextSubtitles, long? currentSubtitleId = null, string targetLanguage = "Ingliz");
    Task<string> ChatWithContextAsync(string userMessage, List<MediaChatMessage> history, List<Subtitle> contextSubtitles, long? currentSubtitleId = null, string targetLanguage = "Ingliz");
    Task<string> TranslateWordAsync(string word);
}
