using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lanswitch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LoginToken",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LoginTokenExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoginToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LoginTokenExpiry",
                table: "Users");
        }
    }
}
