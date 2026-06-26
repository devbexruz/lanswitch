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
        var subtitles = new List<Subtitle>();
        
        if (string.IsNullOrWhiteSpace(srtContent))
            return subtitles;

        var blocks = srtContent.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var block in blocks)
        {
            var lines = block.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            if (lines.Length >= 3)
            {
                if (!int.TryParse(lines[0], out int index))
                    continue;

                var timeMatch = Regex.Match(lines[1], @"(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})");
                if (timeMatch.Success)
                {
                    var startTime = ParseSrtTime(timeMatch.Groups[1].Value);
                    var endTime = ParseSrtTime(timeMatch.Groups[2].Value);
                    var text = string.Join(" ", lines.Skip(2)).Trim();

                    subtitles.Add(new Subtitle
                    {
                        MediaId = mediaId,
                        Index = index,
                        StartTime = startTime,
                        EndTime = endTime,
                        Text = text
                    });
                }
            }
        }

        return subtitles;
    }

    public List<string> ExtractUniqueWords(List<Subtitle> subtitles)
    {
        var allText = string.Join(" ", subtitles.Select(s => s.Text));
        // Remove HTML tags if any (like <i> or </i>)
        allText = Regex.Replace(allText, "<.*?>", string.Empty);
        
        // Extract words (only alphabetic, handling apostrophes)
        var matches = Regex.Matches(allText.ToLowerInvariant(), @"\b[a-z']+\b");
        
        return matches.Select(m => m.Value)
            .Distinct()
            .OrderBy(w => w)
            .ToList();
    }

    private TimeSpan ParseSrtTime(string srtTime)
    {
        // Format: hh:mm:ss,fff
        if (TimeSpan.TryParse(srtTime.Replace(',', '.'), out var time))
        {
            return time;
        }
        return TimeSpan.Zero;
    }
}
