using Lanswitch.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Telegram.Bot.Types;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/bot")]
public class BotController : ControllerBase
{
    [HttpPost]
    public IActionResult Post(
        [FromBody] Update update,
        [FromServices] TelegramBotHandler botHandler)
    {
        // Telegram API kutib qolib, xatoni qayta-qayta yubormasligi uchun 
        // jarayonni Orqa fonga (Task.Run) o'tkazamiz va darhol 200 OK qaytaramiz.
        _ = Task.Run(() => botHandler.HandleUpdateAsync(update));
        
        return Ok();
    }
}