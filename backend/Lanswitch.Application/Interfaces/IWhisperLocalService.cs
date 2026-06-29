using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IWhisperLocalService
{
    Task<List<Subtitle>> TranscribeAudioAsync(List<string> audioFilePaths, long mediaId);
}
