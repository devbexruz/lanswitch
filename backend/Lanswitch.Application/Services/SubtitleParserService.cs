using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Services;

public class SubtitleParserService : ISubtitleParserService
{
    public List<Subtitle> ParseSrt(string srtContent, long mediaId)
    {
        return ParseSubtitles(srtContent, mediaId, null);
    }

    public List<Subtitle> ParseSubtitles(string content, long? mediaId, long? episodeId)
    {
        var subtitles = new List<Subtitle>();
        
        if (string.IsNullOrWhiteSpace(content))
            return subtitles;

        // Clean WebVTT header if present
        var cleanContent = content;
        if (cleanContent.StartsWith("WEBVTT", StringComparison.OrdinalIgnoreCase))
        {
            var firstBlankLine = cleanContent.IndexOf("\n\n");
            if (firstBlankLine == -1) firstBlankLine = cleanContent.IndexOf("\r\n\r\n");
            if (firstBlankLine != -1)
            {
                cleanContent = cleanContent.Substring(firstBlankLine).Trim();
            }
        }

        var blocks = cleanContent.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);
        int autoIndex = 1;

        foreach (var block in blocks)
        {
            var lines = block.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
            if (lines.Length == 0) continue;

            int timeLineIndex = -1;
            int cueIndex = autoIndex;

            // Check if first line is a numeric cue or time
            if (Regex.IsMatch(lines[0], @"-->"))
            {
                timeLineIndex = 0;
            }
            else if (lines.Length > 1 && Regex.IsMatch(lines[1], @"-->"))
            {
                timeLineIndex = 1;
                if (int.TryParse(lines[0].Trim(), out var parsedIndex))
                {
                    cueIndex = parsedIndex;
                }
            }

            if (timeLineIndex != -1 && lines.Length > timeLineIndex + 1)
            {
                var timeLine = lines[timeLineIndex];
                var timeMatch = Regex.Match(timeLine, @"(?:(\d{2}:)?(\d{2}:\d{2}[,\.]\d{3}))\s*-->\s*(?:(\d{2}:)?(\d{2}:\d{2}[,\.]\d{3}))");
                if (timeMatch.Success)
                {
                    var startTimeStr = timeLine.Substring(0, timeLine.IndexOf("-->")).Trim();
                    var endTimePart = timeLine.Substring(timeLine.IndexOf("-->") + 3).Trim();
                    var endTimeStr = endTimePart.Split(' ')[0].Trim();

                    var startTime = ParseFlexibleTime(startTimeStr);
                    var endTime = ParseFlexibleTime(endTimeStr);

                    var textLines = lines.Skip(timeLineIndex + 1);
                    var text = string.Join(" ", textLines).Trim();
                    text = Regex.Replace(text, "<.*?>", string.Empty).Trim();

                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        subtitles.Add(new Subtitle
                        {
                            MediaId = mediaId ?? 0,
                            EpisodeId = episodeId,
                            Index = cueIndex,
                            StartTime = startTime,
                            EndTime = endTime,
                            Text = text
                        });
                        autoIndex++;
                    }
                }
            }
        }

        return subtitles;
    }

    public List<string> ExtractUniqueWords(List<Subtitle> subtitles)
    {
        var allText = string.Join(" ", subtitles.Select(s => s.Text));
        allText = Regex.Replace(allText, "<.*?>", string.Empty);
        
        var matches = Regex.Matches(allText.ToLowerInvariant(), @"\b[a-z']+\b");
        
        return matches.Select(m => m.Value)
            .Distinct()
            .OrderBy(w => w)
            .ToList();
    }

    private TimeSpan ParseFlexibleTime(string timeStr)
    {
        // Replace comma with dot
        var normalized = timeStr.Replace(',', '.').Trim();
        // Format could be: mm:ss.fff or hh:mm:ss.fff
        var parts = normalized.Split(':');
        if (parts.Length == 2)
        {
            normalized = "00:" + normalized;
        }

        if (TimeSpan.TryParse(normalized, out var time))
        {
            return time;
        }
        return TimeSpan.Zero;
    }
}
