using System;
using System.Collections.Generic;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface ISubtitleParserService
{
    List<Subtitle> ParseSrt(string srtContent, long mediaId);
    List<string> ExtractUniqueWords(List<Subtitle> subtitles);
}
