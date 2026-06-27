using Lanswitch.Api.Middlewares;
using Lanswitch.Domain.Entities;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Lanswitch.Infrastructure
{
    public static class WebhookExtensions
    {
        /// <summary>
        /// Configures database migration, seed data and Telegram webhook.
        /// Call after <c>var app = builder.Build();</c>.
        /// </summary>
        public static async Task<WebApplication> UseTelegramWebhook(this WebApplication app, IConfiguration configuration)
        {
            using var scope = app.Services.CreateScope();
            var botClient = scope.ServiceProvider.GetRequiredService<ITelegramBotClient>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<WebhookExtensions>>();
            var webhookUrl = configuration["BotConfiguration:WebhookUrl"];

            // -----------------------  DB migration & seed  -----------------------
            try
            {
                dbContext.Database.Migrate();

                // Languages
                if (!dbContext.Languages.Any())
                {
                    dbContext.Languages.AddRange(
                        new Language { Title = "O'zbekcha" },
                        new Language { Title = "English" },
                        new Language { Title = "Русский" }
                    );
                    dbContext.SaveChanges();
                    logger.LogInformation("✅ Default languages added.");
                }

                // Categories
                if (!dbContext.Categories.Any())
                {
                    dbContext.Categories.Add(new Category { Name = "Asosiy Kategoriya" });
                    dbContext.SaveChanges();
                    logger.LogInformation("✅ Default category added.");
                }

                // Default English grammar rules
                if (!dbContext.Set<GrammarContext>().Any())
                {
                    dbContext.Set<GrammarContext>().AddRange(
                        new GrammarContext
                        {
                            LanguageId = 2,
                            Name = "Simple Present Tense",
                            Description = "Uses the base form of the verb for habitual actions.",
                            Content = "Subject + verb (base form) + ..."
                        },
                        new GrammarContext
                        {
                            LanguageId = 2,
                            Name = "Simple Past Tense",
                            Description = "Regular verbs add -ed, irregular have unique forms.",
                            Content = "Subject + verb (past form) + ..."
                        },
                        new GrammarContext
                        {
                            LanguageId = 2,
                            Name = "Present Continuous",
                            Description = "Describes actions happening right now.",
                            Content = "Subject + am/is/are + verb‑ing"
                        }
                    );
                    dbContext.SaveChanges();
                    logger.LogInformation("✅ Default English grammar rules added.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Database migration/seed error");
            }

            // -----------------------  Telegram webhook  -----------------------
            logger.LogInformation("=====================================");
            logger.LogInformation("⏳ Setting Telegram webhook…");
            logger.LogInformation($"🔗 Url: {webhookUrl}");

            if (!string.IsNullOrWhiteSpace(webhookUrl))
            {
                try
                {
                    await botClient.SetWebhookAsync(url: webhookUrl, dropPendingUpdates: true);
                    logger.LogInformation("✅ Webhook configured successfully!");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "❌ Webhook configuration failed");
                }
            }
            else
            {
                logger.LogWarning("❌ Webhook URL not found in configuration!");
            }

            logger.LogInformation("=====================================");
            return app;
        }
    }
}
