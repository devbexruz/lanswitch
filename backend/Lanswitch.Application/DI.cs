using Lanswitch.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Lanswitch.Application.Services;
namespace Lanswitch.Application;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Pure business‑logic services (no external dependencies)
        services.AddScoped<ISubtitleParserService, SubtitleParserService>();
        services.AddScoped<IAuthAppService, AuthAppService>();
        services.AddScoped<IUserAppService, UserAppService>();
// Removed external service registrations from Application layer; now handled in Infrastructure.
        return services;
    }
}
