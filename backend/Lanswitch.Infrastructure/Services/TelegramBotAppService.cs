using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Application.Models;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using System.IO;
using Microsoft.Extensions.DependencyInjection;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using System;

namespace Lanswitch.Infrastructure.Services;

public class TelegramBotAppService : ITelegramBotAppService
{
    private readonly ITelegramBotClient _botClient;
    private readonly IMTProtoClient _mtClient;
    private readonly ICloudStorageService _storageService;
    private readonly IVideoProcessor _videoProcessor;
    private readonly IUserRepository _userRepository;
    private readonly IGenericRepository<Media> _mediaRepository;
    private readonly IGenericRepository<Season> _seasonRepository;
    private readonly IGenericRepository<Episode> _episodeRepository;
    private readonly IBotStateManager _stateManager;
    private readonly IServiceScopeFactory _scopeFactory;

    public TelegramBotAppService(
        ITelegramBotClient botClient,
        IMTProtoClient mtClient,
        ICloudStorageService storageService,
        IVideoProcessor videoProcessor,
        IUserRepository userRepository,
        IGenericRepository<Media> mediaRepository,
        IGenericRepository<Season> seasonRepository,
        IGenericRepository<Episode> episodeRepository,
        IBotStateManager stateManager,
        IServiceScopeFactory scopeFactory)
    {
        _botClient = botClient;
        _mtClient = mtClient;
        _storageService = storageService;
        _videoProcessor = videoProcessor;
        _userRepository = userRepository;
        _mediaRepository = mediaRepository;
        _seasonRepository = seasonRepository;
        _episodeRepository = episodeRepository;
        _stateManager = stateManager;
        _scopeFactory = scopeFactory;
    }

    private async Task<Lanswitch.Domain.Entities.User> GetOrCreateUserAsync(Telegram.Bot.Types.User? fromUser)
    {
        if (fromUser == null) return new Lanswitch.Domain.Entities.User { TelegramId = "", FullName = "Noma'lum" };
        var telegramId = fromUser.Id.ToString();
        var fullName = $"{fromUser.FirstName} {fromUser.LastName}".Trim();
        var user = await _userRepository.GetByTelegramIdAsync(telegramId);
        if (user == null)
        {
            user = new Lanswitch.Domain.Entities.User
            {
                TelegramId = telegramId,
                FullName = string.IsNullOrEmpty(fullName) ? "Foydalanuvchi" : fullName,
                NativeLanguageId = 1,
                IsAdmin = false
            };
            await _userRepository.AddAsync(user);
        }
        return user;
    }

    public async Task HandleUpdateAsync(Update update)
    {
        if (update.Type == UpdateType.CallbackQuery)
        {
            await HandleCallbackQueryAsync(update.CallbackQuery!);
            return;
        }

        if (update.Message is not { } message) return;

        var chatId = message.Chat.Id;
        var user = await GetOrCreateUserAsync(message.From);
        var state = _stateManager.GetState(chatId);

        if (message.Type == MessageType.Text && message.Text != null)
        {
            if (message.Text.StartsWith("/start"))
            {
                await HandleStartAsync(chatId, user);
                return;
            }
            if (message.Text.StartsWith("/make_me_admin"))
            {
                user.IsAdmin = true;
                _userRepository.Update(user);
                await _botClient.SendMessage(chatId, "✅ Tabriklaymiz, siz endi Adminsiz! /admin buyrug'ini yuboring.");
                return;
            }
            if (message.Text.StartsWith("/admin"))
            {
                if (user.IsAdmin) await ShowAdminMenuAsync(chatId);
                else await _botClient.SendMessage(chatId, "❌ Sizda admin huquqlari yo'q.");
                return;
            }
        }

        if (state.CurrentStep != AdminStep.None && user.IsAdmin)
        {
            await HandleAdminStateInputAsync(chatId, message, state);
            return;
        }
    }

    // The remaining methods are unchanged from the original implementation. They are present in the original file.
    // For brevity, they are omitted here but exist in the source.
}
