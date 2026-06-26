using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Telegram.Bot.Types;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/bot")]
public class BotController : ControllerBase
{
    private readonly IServiceScopeFactory _scopeFactory;

    public BotController(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    [HttpPost]
    public async Task<IActionResult> Post()
    {
        try 
        {
            using var reader = new System.IO.StreamReader(Request.Body);
            var json = await reader.ReadToEndAsync();
            Console.WriteLine($"Kelgan JSON: {json}"); // DEBUG uchun

            var options = new System.Text.Json.JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower
            };
            var update = System.Text.Json.JsonSerializer.Deserialize<Update>(json, options);
            Console.WriteLine($"Deserilazation natijasi: UpdateId={update?.Id}, MessageId={update?.Message?.MessageId}, Text={update?.Message?.Text}");

            if (update != null)
            {
                _ = Task.Run(async () => 
                {
                    try {
                        using var scope = _scopeFactory.CreateScope();
                        var botService = scope.ServiceProvider.GetRequiredService<ITelegramBotAppService>();
                        await botService.HandleUpdateAsync(update);
                    } catch (Exception innerEx) {
                        Console.WriteLine($"Handlerda xatolik: {innerEx.Message} - {innerEx.StackTrace}");
                    }
                });
            }
        } 
        catch (Exception ex) 
        {
            Console.WriteLine($"Webhook o'qishda xatolik: {ex.Message}");
        }
        
        return Ok();
    }
}