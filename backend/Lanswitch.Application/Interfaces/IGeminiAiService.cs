using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public class GeminiAnalysisResult
{
    public bool IsNewRule { get; set; }
    public long? MatchedRuleId { get; set; }
    
    // For new rules
    public string? NewRuleName { get; set; }
    public string? NewRuleDescription { get; set; }
    public string? NewRuleContent { get; set; }
    
    // The exact word or phrase in the subtitle that represents the grammar target
    public string? GapWord { get; set; }
}

public interface IGeminiAiService
{
    Task<List<Subtitle>> TranscribeAudioAsync(string audioFilePath, long mediaId);
    Task<GeminiAnalysisResult?> AnalyzeGrammarAsync(string subtitleText, List<GrammarContext> existingContexts);
}
