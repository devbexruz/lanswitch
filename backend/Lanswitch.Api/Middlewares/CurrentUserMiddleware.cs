using Lanswitch.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Lanswitch.Api.Middlewares;

public class CurrentUserMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;

    public CurrentUserMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _configuration = configuration;
    }

    public async Task Invoke(HttpContext context, AppDbContext dbContext)
    {
        var token = context.Request.Cookies["AccessToken"];

        if (!string.IsNullOrEmpty(token))
        {
            try
            {
                var jwtSettings = _configuration.GetSection("JwtSettings");
                var secretKey = jwtSettings["SecretKey"];
                var key = Encoding.UTF8.GetBytes(secretKey!);

                var tokenHandler = new JwtSecurityTokenHandler();
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings["Issuer"],
                    ValidateAudience = true,
                    ValidAudience = jwtSettings["Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

                var jwtToken = (JwtSecurityToken)validatedToken;
                var userIdStr = jwtToken.Claims.First(x => x.Type == JwtRegisteredClaimNames.Sub || x.Type == "nameid").Value;

                if (long.TryParse(userIdStr, out var userId))
                {
                    var user = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                    if (user != null)
                    {
                        context.Items["User"] = user;
                    }
                }
            }
            catch
            {
                // Token yaroqsiz bo'lsa indamaymiz, shunchaki User null bo'lib qoladi
            }
        }

        await _next(context);
    }
}
