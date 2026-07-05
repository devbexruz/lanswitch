using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EpisodeandMediachatsessionwithuserunique2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages");

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

            migrationBuilder.AddForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_MediaChatMessages_Subtitles_ContextSubtitleId",
                table: "MediaChatMessages");

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
                name: "FK_EpisodeChatMessages_Subtitles_ContextSubtitleId",
                table: "EpisodeChatMessages",
                column: "ContextSubtitleId",
                principalTable: "Subtitles",
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
    }
}
