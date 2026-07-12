using Lanswitch.Infrastructure.Services;
using Telegram.Bot;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Lanswitch.Api.Middlewares;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Scalar.AspNetCore;
using Lanswitch.Domain.Interfaces;
using Lanswitch.Infrastructure;
using Lanswitch.Api.Extensions;


var builder = WebApplication.CreateBuilder(args);

// CORS siyosatini ro'yxatdan o'tkazish
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(builder.Configuration["Frontend:Host"]!) // Frontend manzilingiz
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Agar cookie yoki auth header bo'lsa shart
    });
});

// SQL BAZANI ULASH
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication va JWT
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSettings["Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        
        // Cookie dan o'qish uchun qo'shimcha (ixtiyoriy, agar Authorize atributi ishlatilsa)
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.ContainsKey("AccessToken"))
                {
                    context.Token = context.Request.Cookies["AccessToken"];
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var sessionIdClaim = context.Principal?.FindFirst("session_id")?.Value;
                if (!string.IsNullOrEmpty(sessionIdClaim) && long.TryParse(sessionIdClaim, out var sessionId))
                {
                    var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                    var session = await dbContext.UserSessions.FindAsync(sessionId);
                    if (session == null || !session.IsActive)
                    {
                        context.Fail("Session is revoked or invalid.");
                    }
                }
            }
        };
    });

builder.Services.AddLanswitchServices(builder.Configuration);

// Controllerlarni qo'shish va JSON tsikllarini oldini olish (Reference Cycles)
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Minimal API va OpenAPI uchun ham global JSON tsikllarni cheklash
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Bot kalitini o'qish va ITelegramBotClient ni tizimga qo'shish
var botToken = builder.Configuration["BotConfiguration:BotToken"];
if (string.IsNullOrEmpty(botToken))
{
    throw new ArgumentNullException("BotToken", "Bot tokeni appsettings.json faylida topilmadi!");
}

builder.Services.AddSingleton<ITelegramBotClient>(new TelegramBotClient(botToken));


// WTelegramClient (MTProto) ni Singleton sifatida sozlash
builder.Services.AddSingleton<WTelegram.Client>(provider => {
    var config = provider.GetRequiredService<IConfiguration>();
    // Loglarni o'chirish (agar terminalga juda ko'p xabar chiqishini xohlamasangiz)
    WTelegram.Helpers.Log = (i, s) => { }; 
    var client = new WTelegram.Client(what => {
        if (what == "api_id") return config["BotConfiguration:ApiId"];
        if (what == "api_hash") return config["BotConfiguration:ApiHash"];
        return null;
    });
    return client;
});



// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseCors("FrontendPolicy");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi("/api/openapi/v1.json");
    // Faqat Scalar UI ni ochamiz va OpenAPI yo'lini ko'rsatamiz
    app.MapScalarApiReference("/api/scalar", options => 
    {
        options.WithOpenApiRoutePattern("/api/openapi/v1.json");
    });
}

// Webhook and database seeding moved to extension method
await app.UseTelegramWebhook(builder.Configuration);

app.UseAuthorization();
app.MapControllers();

app.Run();