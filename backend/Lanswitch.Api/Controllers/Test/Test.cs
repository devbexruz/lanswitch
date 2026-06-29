using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/test")]
public class TestController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IGeminiAiService _geminiAiService;
    
    

    public TestController(
        IConfiguration configuration,
        IGeminiAiService geminiAiService)
    {
        _configuration = configuration;
        _geminiAiService = geminiAiService;
    }

    public class AiGrammarRequest
    {
        public string Text { get; set; } = null!;
    }

    [HttpGet("ai-grammar")]
    public async Task<IActionResult> AiGrammar([FromBody] AiGrammarRequest request)
    {
        if (string.IsNullOrEmpty(request.Text)) return BadRequest(new { message = "Text kerak" });
        var result = await _geminiAiService.AnalyzeGrammarAsync(request.Text);

        return Ok(result);
    }
}
