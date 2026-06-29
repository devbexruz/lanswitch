using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LanguageController : ControllerBase
{
    private readonly IGenericRepository<Language> _languageRepository;

    public LanguageController(IGenericRepository<Language> languageRepository)
    {
        _languageRepository = languageRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var languages = await _languageRepository.GetAllAsync();
        return Ok(languages.Select(l => new { l.Id, l.Title }));
    }
}
