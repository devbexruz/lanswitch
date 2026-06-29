using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSeasonEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Episodes_Seasons_SeasonId",
                table: "Episodes");

            migrationBuilder.Sql("UPDATE \"Episodes\" SET \"SeasonId\" = (SELECT \"MediaId\" FROM \"Seasons\" WHERE \"Seasons\".\"Id\" = \"Episodes\".\"SeasonId\");");

            migrationBuilder.DropTable(
                name: "Seasons");

            migrationBuilder.RenameColumn(
                name: "SeasonId",
                table: "Episodes",
                newName: "MediaId");

            migrationBuilder.RenameIndex(
                name: "IX_Episodes_SeasonId",
                table: "Episodes",
                newName: "IX_Episodes_MediaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Episodes_Medias_MediaId",
                table: "Episodes",
                column: "MediaId",
                principalTable: "Medias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Episodes_Medias_MediaId",
                table: "Episodes");

            migrationBuilder.RenameColumn(
                name: "MediaId",
                table: "Episodes",
                newName: "SeasonId");

            migrationBuilder.RenameIndex(
                name: "IX_Episodes_MediaId",
                table: "Episodes",
                newName: "IX_Episodes_SeasonId");

            migrationBuilder.CreateTable(
                name: "Seasons",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MediaId = table.Column<long>(type: "bigint", nullable: false),
                    About = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SeasonNumber = table.Column<int>(type: "integer", nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seasons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Seasons_Medias_MediaId",
                        column: x => x.MediaId,
                        principalTable: "Medias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_MediaId",
                table: "Seasons",
                column: "MediaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Episodes_Seasons_SeasonId",
                table: "Episodes",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
