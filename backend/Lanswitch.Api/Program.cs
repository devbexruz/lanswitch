using Lanswitch.Infrastructure.Services;
using Telegram.Bot;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);


// SQL BAZANI ULASH
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Controllerlarni qo'shish (NewtonsoftJson bilan)
builder.Services.AddControllers().AddNewtonsoftJson();

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

// Handler xizmatini ulash
builder.Services.AddScoped<TelegramBotHandler>();

var app = builder.Build();

// --- AVTOMATIK WEBHOOK SOZLASHTIRISH QISMI ---
using (var scope = app.Services.CreateScope())
{
    var botClient = scope.ServiceProvider.GetRequiredService<ITelegramBotClient>();
    var webhookUrl = builder.Configuration["BotConfiguration:WebhookUrl"];
    
    Console.WriteLine("=====================================");
    Console.WriteLine($"⏳ Webhook Telegramga yuborilmoqda...");
    Console.WriteLine($"🔗 Manzil: {webhookUrl}");
    
    try
    {
        // Telegramga yangi manzilni aytamiz va eski o'qilmagan xabarlarni tozalaymiz
        await botClient.SetWebhookAsync(
            url: webhookUrl,
            dropPendingUpdates: true
        );
        Console.WriteLine("✅ Webhook muvaffaqiyatli sozlandi!");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Webhook o'rnatishda xatolik yuz berdi: {ex.Message}");
    }
    Console.WriteLine("=====================================\n");
}

app.UseAuthorization();
app.MapControllers();

app.Run();