using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public class DeepgramResult
{
    public List<Subtitle> Subtitles { get; set; } = new();
    public string SrtContent { get; set; } = string.Empty;
}

public interface IDeepgramService
{
    Task<DeepgramResult> TranscribeAudioAsync(string fullAudioPath, long mediaId, string langCode = "en");
}
