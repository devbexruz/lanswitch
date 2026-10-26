using System;
using System.Collections.Generic;

namespace Lanswitch.Application.Models;

public class AiHomeworkAnalysisItem
{
    public string ItemType { get; set; } = "TextReminder"; // "TextReminder", "Vocabulary", "MediaSubmission"
    public string Title { get; set; } = "";
    public string Instructions { get; set; } = "";
    public long? TargetUnitId { get; set; }
}

public class AiHomeworkAnalysisResult
{
    public bool IsHomework { get; set; } = true;
    public string Title { get; set; } = "Yangi Uyga Vazifa";
    public int DeadlineDays { get; set; } = 2;
    public string DeadlineTime { get; set; } = "20:00";
    public string? Explanation { get; set; }
    public string? UnsupportedRequests { get; set; }
    public List<AiHomeworkAnalysisItem> Items { get; set; } = new();

    public TimeSpan GetDeadlineTimeSpan()
    {
        if (TimeSpan.TryParse(DeadlineTime, out var ts))
            return ts;
        return new TimeSpan(20, 0, 0);
    }
}
