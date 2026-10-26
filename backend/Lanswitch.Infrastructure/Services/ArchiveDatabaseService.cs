using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

namespace Lanswitch.Infrastructure.Services;

public class ArchiveDatabaseService : IArchiveDatabaseService
{
    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;

    public ArchiveDatabaseService(IConfiguration config)
    {
        string baseDir = AppContext.BaseDirectory;
        string dataDir = Path.Combine(baseDir, "data");
        if (!Directory.Exists(dataDir))
        {
            try { Directory.CreateDirectory(dataDir); } catch { }
        }

        string dbPath = Path.Combine(Directory.Exists(dataDir) ? dataDir : baseDir, "archive_deleted_data.db");
        _connectionString = $"Data Source={dbPath}";

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = false,
            ReferenceHandler = ReferenceHandler.IgnoreCycles,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS DeletedArchives (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                EntityType TEXT NOT NULL,
                EntityId INTEGER NOT NULL,
                EntityTitle TEXT,
                OwnerId INTEGER NOT NULL,
                DeletedById INTEGER NOT NULL,
                DeletedAt TEXT NOT NULL,
                Reason TEXT,
                DataJson TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_DeletedArchives_EntityType ON DeletedArchives (EntityType);
            CREATE INDEX IF NOT EXISTS IX_DeletedArchives_OwnerId ON DeletedArchives (OwnerId);
            CREATE INDEX IF NOT EXISTS IX_DeletedArchives_DeletedAt ON DeletedArchives (DeletedAt);
        ";
        cmd.ExecuteNonQuery();
    }

    public async Task ArchiveAsync(string entityType, long entityId, string? entityTitle, long ownerId, long deletedById, object data, string? reason = null)
    {
        string json = JsonSerializer.Serialize(data, _jsonOptions);
        string deletedAt = DateTime.UtcNow.ToString("o");

        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO DeletedArchives (EntityType, EntityId, EntityTitle, OwnerId, DeletedById, DeletedAt, Reason, DataJson)
            VALUES ($entityType, $entityId, $entityTitle, $ownerId, $deletedById, $deletedAt, $reason, $dataJson);
        ";
        cmd.Parameters.AddWithValue("$entityType", entityType);
        cmd.Parameters.AddWithValue("$entityId", entityId);
        cmd.Parameters.AddWithValue("$entityTitle", (object?)entityTitle ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ownerId", ownerId);
        cmd.Parameters.AddWithValue("$deletedById", deletedById);
        cmd.Parameters.AddWithValue("$deletedAt", deletedAt);
        cmd.Parameters.AddWithValue("$reason", (object?)reason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$dataJson", json);

        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<ArchiveRecordDto>> GetArchivesAsync(string? entityType = null, int limit = 100)
    {
        var result = new List<ArchiveRecordDto>();
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();

        if (string.IsNullOrEmpty(entityType))
        {
            cmd.CommandText = "SELECT Id, EntityType, EntityId, EntityTitle, OwnerId, DeletedById, DeletedAt, Reason, DataJson FROM DeletedArchives ORDER BY Id DESC LIMIT $limit";
        }
        else
        {
            cmd.CommandText = "SELECT Id, EntityType, EntityId, EntityTitle, OwnerId, DeletedById, DeletedAt, Reason, DataJson FROM DeletedArchives WHERE EntityType = $entityType ORDER BY Id DESC LIMIT $limit";
            cmd.Parameters.AddWithValue("$entityType", entityType);
        }
        cmd.Parameters.AddWithValue("$limit", limit);

        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new ArchiveRecordDto
            {
                Id = reader.GetInt64(0),
                EntityType = reader.GetString(1),
                EntityId = reader.GetInt64(2),
                EntityTitle = reader.IsDBNull(3) ? null : reader.GetString(3),
                OwnerId = reader.GetInt64(4),
                DeletedById = reader.GetInt64(5),
                DeletedAt = reader.GetString(6),
                Reason = reader.IsDBNull(7) ? null : reader.GetString(7),
                DataJson = reader.GetString(8)
            });
        }
        return result;
    }

    public async Task<int> CleanupArchivesOlderThanDaysAsync(int days)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days).ToString("o");
        using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM DeletedArchives WHERE DeletedAt < $cutoff";
        cmd.Parameters.AddWithValue("$cutoff", cutoff);
        return await cmd.ExecuteNonQueryAsync();
    }
}
