using Telegram.Bot.Types;

namespace Lanswitch.Application.Interfaces;

public interface ITelegramBotAppService
{
    Task HandleUpdateAsync(Update update);
}
