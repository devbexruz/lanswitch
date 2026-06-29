using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Services;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Lanswitch.Infrastructure.Services;

namespace Lanswitch.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddLanswitchServices(this IServiceCollection services, IConfiguration configuration)
    {
        // ==== Infrastructure Repositories ====
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
        services.AddScoped<IUserRepository, UserRepository>();

        // ==== Common Services ====
        services.AddMemoryCache();
        services.AddSingleton<IBotStateManager, BotStateManager>();

        // ==== Application Services ====
        services.AddScoped<ICloudStorageService, CloudStorageService>(); // Scoped
        services.AddScoped<IFileStorageService, LocalFileStorageService>(); // Scoped
        services.AddScoped<IVideoProcessor, VideoProcessor>();          // Scoped
        services.AddScoped<ISubtitleParserService, SubtitleParserService>();
        Deepgram.Library.Initialize();
        services.AddScoped<IDeepgramService, DeepgramService>();
        services.AddHttpClient<IGeminiAiService, GeminiAiService>();
        services.AddHttpClient<IWhisperLocalService, WhisperLocalService>();
        services.AddScoped<IAuthAppService, AuthAppService>();
        services.AddScoped<IUserAppService, UserAppService>();
        services.AddScoped<ITelegramBotAppService, TelegramBotAppService>();

        // ==== Infrastructure Services ====
        services.AddScoped<IMTProtoClient, MTProtoClientService>();

        return services;
    }
}
