using System.IO;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;

namespace Lanswitch.Infrastructure.Services;

public class LocalFileStorageService : IFileStorageService
{
    public async Task<byte[]> ReadAsync(string path)
    {
        return await File.ReadAllBytesAsync(path);
    }

    public async Task WriteAsync(string path, byte[] data)
    {
        await File.WriteAllBytesAsync(path, data);
    }
}
