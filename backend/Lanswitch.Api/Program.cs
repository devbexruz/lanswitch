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
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Services;
using Lanswitch.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);



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
            }
        };
    });

// Xizmatlar (Services)

builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<IUserRepository, UserRepository>();
// Services
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<Lanswitch.Application.Interfaces.IBotStateManager, Lanswitch.Application.Services.BotStateManager>();

builder.Services.AddScoped<ICloudStorageService, CloudStorageService>();
builder.Services.AddScoped<IVideoProcessor, VideoProcessor>();
builder.Services.AddScoped<Lanswitch.Application.Interfaces.ISubtitleParserService, Lanswitch.Application.Services.SubtitleParserService>();
builder.Services.AddHttpClient<Lanswitch.Application.Interfaces.IGeminiAiService, Lanswitch.Application.Services.GeminiAiService>();
builder.Services.AddScoped<IAuthAppService, AuthAppService>();
builder.Services.AddScoped<IUserAppService, UserAppService>();
builder.Services.AddScoped<ITelegramBotAppService, TelegramBotAppService>();

builder.Services.AddSingleton<ICloudStorageService, CloudStorageService>();
builder.Services.AddScoped<IMTProtoClient, MTProtoClientService>();
builder.Services.AddTransient<IVideoProcessor, VideoProcessor>();

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi("/api/openapi/v1.json");
    // Faqat Scalar UI ni ochamiz va OpenAPI yo'lini ko'rsatamiz
    app.MapScalarApiReference("/api/scalar", options => 
    {
        options.WithOpenApiRoutePattern("/api/openapi/v1.json");
    });
}

// --- AVTOMATIK WEBHOOK SOZLASHTIRISH QISMI ---
using (var scope = app.Services.CreateScope())
{
    var botClient = scope.ServiceProvider.GetRequiredService<ITelegramBotClient>();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var webhookUrl = builder.Configuration["BotConfiguration:WebhookUrl"];
    
    // Baza migratsiyasi va Seed
    try
    {
        dbContext.Database.Migrate();
        if (!dbContext.Languages.Any())
        {
            dbContext.Languages.AddRange(
                new Lanswitch.Domain.Entities.Language { Title = "O'zbekcha" },
                new Lanswitch.Domain.Entities.Language { Title = "English" },
                new Lanswitch.Domain.Entities.Language { Title = "Русский" }
            );
            dbContext.SaveChanges();
            Console.WriteLine("✅ Boshlang'ich tillar bazaga qo'shildi!");
        }
        
        if (!dbContext.Categories.Any())
        {
            dbContext.Categories.Add(new Lanswitch.Domain.Entities.Category { Name = "Asosiy Kategoriya" });
            dbContext.SaveChanges();
            Console.WriteLine("✅ Boshlang'ich kategoriya bazaga qo'shildi!");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Baza migratsiya/seed xatosi: {ex.Message}");
    }

    Console.WriteLine("=====================================");
    Console.WriteLine($"⏳ Webhook Telegramga yuborilmoqda...");
    Console.WriteLine($"🔗 Manzil: {webhookUrl}");
    
    if (!string.IsNullOrEmpty(webhookUrl))
    {
        try
        {
            // Telegramga yangi manzilni aytamiz va eski o'qilmagan xabarlarni tozalaymiz
            await botClient.SetWebhook(
                url: webhookUrl,
                dropPendingUpdates: true
            );
            Console.WriteLine("✅ Webhook muvaffaqiyatli sozlandi!");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Webhook o'rnatishda xatolik yuz berdi: {ex.Message}");
        }
    }
    else
    {
        Console.WriteLine("❌ Webhook url topilmadi!");
    }
    Console.WriteLine("=====================================\n");
}

app.UseAuthorization();
app.MapControllers();

app.Run();