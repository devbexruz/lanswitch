using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MultipleCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Medias_Categories_CategoryId",
                table: "Medias");

            migrationBuilder.DropIndex(
                name: "IX_Medias_CategoryId",
                table: "Medias");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Medias");

            migrationBuilder.CreateTable(
                name: "CategoryMedia",
                columns: table => new
                {
                    CategoriesId = table.Column<long>(type: "bigint", nullable: false),
                    MediasId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryMedia", x => new { x.CategoriesId, x.MediasId });
                    table.ForeignKey(
                        name: "FK_CategoryMedia_Categories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CategoryMedia_Medias_MediasId",
                        column: x => x.MediasId,
                        principalTable: "Medias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CategoryMedia_MediasId",
                table: "CategoryMedia",
                column: "MediasId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CategoryMedia");

            migrationBuilder.AddColumn<long>(
                name: "CategoryId",
                table: "Medias",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_Medias_CategoryId",
                table: "Medias",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Medias_Categories_CategoryId",
                table: "Medias",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
