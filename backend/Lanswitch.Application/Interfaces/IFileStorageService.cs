using System.Threading.Tasks;

namespace Lanswitch.Application.Interfaces
{
    public interface IFileStorageService
    {
        Task<byte[]> ReadAsync(string path);
        Task WriteAsync(string path, byte[] data);
    }
}
