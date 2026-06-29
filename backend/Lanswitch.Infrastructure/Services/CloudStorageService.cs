using Amazon.S3;
using Amazon.S3.Model;
using Lanswitch.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Lanswitch.Infrastructure.Services;

public class CloudStorageService : ICloudStorageService
{
    private readonly AmazonS3Client _s3Client;
    private readonly string _bucketName;
    private readonly string _publicUrl;

    public CloudStorageService(IConfiguration config)
    {
        var accountId = config["CloudflareR2:AccountId"];
        var s3Config = new AmazonS3Config 
        { 
            ServiceURL = $"https://{accountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true
        };
        
        _s3Client = new AmazonS3Client(
            config["CloudflareR2:AccessKey"],
            config["CloudflareR2:SecretKey"],
            s3Config
        );

        _bucketName = config["CloudflareR2:BucketName"] ?? "lanswitch";
        _publicUrl = config["CloudflareR2:PublicUrl"] ?? "";
    }

    public async Task<string> UploadVideoAsync(string fileName, Stream fileStream)
    {
        var s3Key = $"anime_videos/{fileName}";
        var putRequest = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = s3Key,
            InputStream = fileStream,
            ContentType = "video/mp4",
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(putRequest);
        return $"{_publicUrl}/{s3Key}";
    }

    public async Task<string> UploadSubtitleAsync(string fileName, Stream fileStream)
    {
        var s3Key = $"anime_videos/{fileName}";
        var putRequest = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = s3Key,
            InputStream = fileStream,
            ContentType = "application/x-subrip",
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(putRequest);
        return $"{_publicUrl}/{s3Key}";
    }

    public async Task<string> UploadImageAsync(string fileName, Stream fileStream, string contentType)
    {
        var s3Key = $"images/{fileName}";
        var putRequest = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = s3Key,
            InputStream = fileStream,
            ContentType = contentType,
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(putRequest);
        return $"{_publicUrl}/{s3Key}";
    }
}
