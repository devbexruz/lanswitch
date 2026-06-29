using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateGapSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Gaps_GrammarContexts_GrammarContextId",
                table: "Gaps");

            migrationBuilder.DropIndex(
                name: "IX_Gaps_GrammarContextId",
                table: "Gaps");

            migrationBuilder.DropColumn(
                name: "GrammarContextId",
                table: "Gaps");

            migrationBuilder.AddColumn<string>(
                name: "AiAnalysis",
                table: "Gaps",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiAnalysis",
                table: "Gaps");

            migrationBuilder.AddColumn<long>(
                name: "GrammarContextId",
                table: "Gaps",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_Gaps_GrammarContextId",
                table: "Gaps",
                column: "GrammarContextId");

            migrationBuilder.AddForeignKey(
                name: "FK_Gaps_GrammarContexts_GrammarContextId",
                table: "Gaps",
                column: "GrammarContextId",
                principalTable: "GrammarContexts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
