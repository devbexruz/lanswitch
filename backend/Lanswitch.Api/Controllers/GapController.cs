using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

using Lanswitch.Api.Attributes;

namespace Lanswitch.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[ApiKey]
public class GapController : ControllerBase
{
    private readonly IGenericRepository<Gap> _gapRepository;

    public GapController(IGenericRepository<Gap> gapRepository)
    {
        _gapRepository = gapRepository;
    }

    [HttpPost]
    public async Task<IActionResult> AddGap([FromBody] Gap gap)
    {
        if (gap == null) return BadRequest("Gap cannot be null");
        
        await _gapRepository.AddAsync(gap);
        return Ok(gap);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGap(long id)
    {
        var gap = await _gapRepository.GetByIdAsync(id);
        if (gap == null) return NotFound("Gap not found");

        _gapRepository.Remove(gap);
        return Ok("Gap deleted successfully");
    }
}
