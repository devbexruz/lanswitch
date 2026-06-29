using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    public partial class AddChatEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<float[]>(
                name: "Embedding",
                table: "Subtitles",
                type: "real[]",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EpisodeChatSessions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EpisodeId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpisodeChatSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EpisodeChatSessions_Episodes_EpisodeId",
                        column: x => x.EpisodeId,
                        principalTable: "Episodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EpisodeChatSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "EpisodeChatMessages",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SessionId = table.Column<long>(type: "bigint", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    ContextSubtitleId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpisodeChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EpisodeChatMessages_EpisodeChatSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "EpisodeChatSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                        column: x => x.ContextSubtitleId,
                        principalTable: "Subtitles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatMessages_ContextSubtitleId",
                table: "EpisodeChatMessages",
                column: "ContextSubtitleId");

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatMessages_SessionId",
                table: "EpisodeChatMessages",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatSessions_EpisodeId",
                table: "EpisodeChatSessions",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatSessions_UserId",
                table: "EpisodeChatSessions",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EpisodeChatMessages");

            migrationBuilder.DropTable(
                name: "EpisodeChatSessions");

            migrationBuilder.DropColumn(
                name: "Embedding",
                table: "Subtitles");
        }
    }
}
