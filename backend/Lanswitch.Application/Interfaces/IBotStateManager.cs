using Lanswitch.Application.Models;

namespace Lanswitch.Application.Interfaces;

public interface IBotStateManager
{
    AdminState GetState(long chatId);
    void SetState(long chatId, AdminState state);
    void ClearState(long chatId);
}
