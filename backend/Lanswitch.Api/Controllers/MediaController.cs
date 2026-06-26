using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IGenericRepository<Media> _mediaRepository;

    public MediaController(IGenericRepository<Media> mediaRepository)
    {
        _mediaRepository = mediaRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var media = await _mediaRepository.GetAllAsync();
        return Ok(media);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(long id)
    {
        var media = await _mediaRepository.GetByIdAsync(id);
        if (media == null) return NotFound();
        return Ok(media);
    }
}
