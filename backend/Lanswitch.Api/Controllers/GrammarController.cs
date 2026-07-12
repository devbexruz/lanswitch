using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Linq;

using Lanswitch.Api.Attributes;

namespace Lanswitch.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[ApiKey]
public class GrammarController : ControllerBase
{
    private readonly IGenericRepository<GrammarContext> _grammarRepository;

    public GrammarController(IGenericRepository<GrammarContext> grammarRepository)
    {
        _grammarRepository = grammarRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllGrammars()
    {
        var grammars = await _grammarRepository.GetAllAsync();
        return Ok(grammars.ToList());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetGrammarById(long id)
    {
        var grammar = await _grammarRepository.GetByIdAsync(id);
        if (grammar == null) return NotFound("Grammar rule not found.");
        return Ok(grammar);
    }

    [HttpPost]
    public async Task<IActionResult> AddGrammar([FromBody] GrammarContext grammar)
    {
        if (grammar == null) return BadRequest("Grammar cannot be null");
        
        await _grammarRepository.AddAsync(grammar);
        return Ok(grammar);
    }
}
