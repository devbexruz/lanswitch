using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly ICloudStorageService _cloudStorageService;
    private readonly IMTProtoClient _mtProtoClient;

    public UploadController(ICloudStorageService cloudStorageService, IMTProtoClient mtProtoClient)
    {
        _cloudStorageService = cloudStorageService;
        _mtProtoClient = mtProtoClient;
    }

    [HttpPost("image")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File is empty or not provided.");
        }

        var allowedContentTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedContentTypes.Contains(file.ContentType))
        {
            return BadRequest("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.");
        }

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        memoryStream.Position = 0; // Important: reset position before upload

        var url = await _cloudStorageService.UploadImageAsync(fileName, memoryStream, file.ContentType);

        return Ok(new { url });
    }

    [HttpPost("process-telegram-video")]
    public async Task<IActionResult> ProcessTelegramVideo([FromQuery] int messageId)
    {
        if (messageId <= 0)
        {
            return BadRequest("Invalid messageId.");
        }

        try
        {
            await _mtProtoClient.LoginBotIfNeededAsync();

            var tempFilePath = Path.GetTempFileName();
            try
            {
                using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await _mtProtoClient.DownloadMessageMediaAsync(messageId, fileStream);
                }

                var fileName = $"{Guid.NewGuid()}.mp4";
                
                using (var readStream = new FileStream(tempFilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    var videoUrl = await _cloudStorageService.UploadVideoAsync(fileName, readStream);
                    return Ok(new { videoUrl });
                }
            }
            finally
            {
                if (System.IO.File.Exists(tempFilePath))
                {
                    System.IO.File.Delete(tempFilePath);
                }
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"An error occurred while processing the video: {ex.Message}");
        }
    }
}
