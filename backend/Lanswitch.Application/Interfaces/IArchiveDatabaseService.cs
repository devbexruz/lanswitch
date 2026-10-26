using System.Collections.Generic;
using System.Threading.Tasks;

namespace Lanswitch.Application.Interfaces;

public class ArchiveRecordDto
{
    public long Id { get; set; }
    public string EntityType { get; set; } = null!;
    public long EntityId { get; set; }
    public string? EntityTitle { get; set; }
    public long OwnerId { get; set; }
    public long DeletedById { get; set; }
    public string DeletedAt { get; set; } = null!;
    public string? Reason { get; set; }
    public string DataJson { get; set; } = null!;
}

public interface IArchiveDatabaseService
{
    Task ArchiveAsync(string entityType, long entityId, string? entityTitle, long ownerId, long deletedById, object data, string? reason = null);
    Task<List<ArchiveRecordDto>> GetArchivesAsync(string? entityType = null, int limit = 100);
    Task<int> CleanupArchivesOlderThanDaysAsync(int days);
}
