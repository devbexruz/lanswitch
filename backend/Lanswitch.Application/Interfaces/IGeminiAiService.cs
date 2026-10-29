using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;
using Lanswitch.Application.Models;

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

public class GroupMessageIntentResult
{
    public string Intent { get; set; } = "CasualChat"; // "AssignHomework", "AskHomework", "AskEnglishQuestion", "CasualChat"
    public bool IsDirectlyAddressingAi { get; set; } = false;
    public string? Reason { get; set; }
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
    Task<string> TranscribeVoiceAudioAsync(byte[] audioBytes, string mimeType = "audio/ogg");
    Task<AiHomeworkAnalysisResult> AnalyzeAndGenerateHomeworkAsync(string text, string? teacherContext);
    Task<AiHomeworkAnalysisResult> RefineHomeworkDraftAsync(AiHomeworkAnalysisResult currentDraft, string modificationPrompt, string? teacherContext = null);
    Task<string> LearnAndUpdateTeacherContextAsync(string currentContext, string publishedHomeworkSummary);
    Task<string> LearnContextFromModificationPromptAsync(string currentContext, string modificationPrompt);
    Task<string> AnswerStudentProQuestionAsync(string question, string groupTitle);
    Task<string> AnswerStudentWithGroupContextAsync(string studentMessage, string groupTitle, string groupContext, string studentName);
    Task<GroupMessageIntentResult> ClassifyGroupMessageIntentAsync(string text, bool isTeacher);
    Task<string> ExplainHomeworkToStudentAsync(string assignmentTitle, DateTime deadline, List<AssignmentItem> items, string studentQuestion, string studentName, string groupTitle);
}
