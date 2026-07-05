using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EpisodeandMediachatsessionwithuserunique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_EpisodeChatSessions_SessionId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_MediaChatSessions_SessionId",
                table: "MediaChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages");

            migrationBuilder.DropTable(
                name: "EpisodeChatSessions");

            migrationBuilder.DropTable(
                name: "MediaChatSessions");

            migrationBuilder.RenameColumn(
                name: "SessionId",
                table: "MediaChatMessages",
                newName: "MediaId");

            migrationBuilder.RenameIndex(
                name: "IX_MediaChatMessages_SessionId",
                table: "MediaChatMessages",
                newName: "IX_MediaChatMessages_MediaId");

            migrationBuilder.RenameColumn(
                name: "SessionId",
                table: "EpisodeChatMessages",
                newName: "EpisodeId");

            migrationBuilder.RenameIndex(
                name: "IX_EpisodeChatMessages_SessionId",
                table: "EpisodeChatMessages",
                newName: "IX_EpisodeChatMessages_EpisodeId");

            migrationBuilder.AlterColumn<long>(
                name: "ContextSubtitleId",
                table: "MediaChatMessages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "ContextSubtitleId",
                table: "EpisodeChatMessages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_EpisodeChatMessages_Episodes_EpisodeId",
                table: "EpisodeChatMessages",
                column: "EpisodeId",
                principalTable: "Episodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MediaChatMessages_Medias_MediaId",
                table: "MediaChatMessages",
                column: "MediaId",
                principalTable: "Medias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_Episodes_EpisodeId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_Medias_MediaId",
                table: "MediaChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages");

            migrationBuilder.RenameColumn(
                name: "MediaId",
                table: "MediaChatMessages",
                newName: "SessionId");

            migrationBuilder.RenameIndex(
                name: "IX_MediaChatMessages_MediaId",
                table: "MediaChatMessages",
                newName: "IX_MediaChatMessages_SessionId");

            migrationBuilder.RenameColumn(
                name: "EpisodeId",
                table: "EpisodeChatMessages",
                newName: "SessionId");

            migrationBuilder.RenameIndex(
                name: "IX_EpisodeChatMessages_EpisodeId",
                table: "EpisodeChatMessages",
                newName: "IX_EpisodeChatMessages_SessionId");

            migrationBuilder.AlterColumn<long>(
                name: "ContextSubtitleId",
                table: "MediaChatMessages",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<long>(
                name: "ContextSubtitleId",
                table: "EpisodeChatMessages",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

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
                name: "MediaChatSessions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MediaId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaChatSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MediaChatSessions_Medias_MediaId",
                        column: x => x.MediaId,
                        principalTable: "Medias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MediaChatSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatSessions_EpisodeId",
                table: "EpisodeChatSessions",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeChatSessions_UserId",
                table: "EpisodeChatSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaChatSessions_MediaId",
                table: "MediaChatSessions",
                column: "MediaId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaChatSessions_UserId",
                table: "MediaChatSessions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_EpisodeChatMessages_EpisodeChatSessions_SessionId",
                table: "EpisodeChatMessages",
                column: "SessionId",
                principalTable: "EpisodeChatSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MediaChatMessages_MediaChatSessions_SessionId",
                table: "MediaChatMessages",
                column: "SessionId",
                principalTable: "MediaChatSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id");
        }
    }
}
