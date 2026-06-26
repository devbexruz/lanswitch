using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Microsoft.Extensions.Caching.Memory;
using System;

namespace Lanswitch.Application.Services;

public class BotStateManager : IBotStateManager
{
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _slidingExpiration = TimeSpan.FromHours(1);

    public BotStateManager(IMemoryCache cache)
    {
        _cache = cache;
    }

    public AdminState GetState(long chatId)
    {
        if (_cache.TryGetValue($"admin_state_{chatId}", out AdminState? state) && state != null)
        {
            return state;
        }
        return new AdminState();
    }

    public void SetState(long chatId, AdminState state)
    {
        _cache.Set($"admin_state_{chatId}", state, new MemoryCacheEntryOptions
        {
            SlidingExpiration = _slidingExpiration
        });
    }

    public void ClearState(long chatId)
    {
        _cache.Remove($"admin_state_{chatId}");
    }
}
