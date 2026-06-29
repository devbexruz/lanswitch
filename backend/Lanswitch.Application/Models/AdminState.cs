using System.Collections.Generic;

namespace Lanswitch.Application.Models;

public enum AdminStep
{
    None,
    AddMovie_Title,
    AddMovie_Description,
    AddMovie_Level,
    AddMovie_Language,
    AddMovie_Video,
    
    // Series states
    AddSeries_Title,
    AddSeries_Description,
    AddSeries_EpisodeNum,
    AddSeries_EpisodeTitle,
    AddSeries_EpisodeLevel,
    AddSeries_Language,
    AddSeries_Video,

    // Existing Series states
    SelectSeries,

    UploadFilmVideo,
    UploadEpisodeVideo,
    AddEpisodeToSeason_EpisodeNum,
    AddEpisodeToSeason_EpisodeTitle,
    AddEpisodeToSeason_EpisodeLevel,
    AddEpisodeToSeason_Video
}

public class AdminState
{
    public AdminStep CurrentStep { get; set; } = AdminStep.None;
    public Dictionary<string, object> Data { get; set; } = new();
}
