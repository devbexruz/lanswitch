using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;

namespace Lanswitch.Infrastructure.Services;

public static class HomeworkUnitResolver
{
    /// <summary>
    /// AI yoki o'qituvchi tomonidan kiritilgan vazifalarni bazadagi mavjud kitob, qism va unitlar bilan tekshirish.
    /// Faqatgina bazada haqiqatan MAVJUD bo'lgan kitob uniti uchungina TargetUnitId va 'Vocabulary' belgilanadi.
    /// Agar aytilgan unit bazada topilmasa -> qat'iy TargetUnitId = null va ItemType = 'TextReminder' (eslatma) qilinadi.
    /// </summary>
    public static async Task ResolveAndValidateUnitsAsync(AppDbContext db, List<AiHomeworkAnalysisItem> items)
    {
        if (items == null || items.Count == 0) return;

        var allUnits = await db.BookUnits
            .Include(u => u.Part)
            .ThenInclude(p => p.Book)
            .ToListAsync();

        foreach (var item in items)
        {
            bool isVocab = string.Equals(item.ItemType, "Vocabulary", StringComparison.OrdinalIgnoreCase);
            var parsed = ParseBookAndUnit(item.Title + " " + item.Instructions);
            bool mentionsBook = !string.IsNullOrEmpty(parsed.bookHint) || !string.IsNullOrEmpty(item.BookHint);

            if (isVocab || mentionsBook)
            {
                BookUnit? matchedUnit = null;

                // 1. Agar TargetUnitId berilgan bo'lsa, bazada bor-yo'qligini tekshiramiz
                if (item.TargetUnitId.HasValue && item.TargetUnitId.Value > 0)
                {
                    matchedUnit = allUnits.FirstOrDefault(u => u.Id == item.TargetUnitId.Value);
                }

                // 2. Agar TargetUnitId topilmagan bo'lsa, BookHint / PartNumber / UnitNumber bo'yicha qidiramiz
                if (matchedUnit == null && (item.UnitNumber.HasValue || parsed.unitNumber.HasValue))
                {
                    int uNum = item.UnitNumber ?? parsed.unitNumber!.Value;
                    string? bHint = !string.IsNullOrEmpty(item.BookHint) ? item.BookHint : parsed.bookHint;
                    int? pNum = item.PartNumber ?? parsed.partNumber;
                    matchedUnit = MatchUnit(allUnits, bHint, pNum, uNum);
                }

                // 3. Qat'iy tekshiruv: Faqat bazada haqiqatan MAVJUD bo'lsagina Vocabulary va TargetUnitId belgilanadi!
                if (matchedUnit != null)
                {
                    item.TargetUnitId = matchedUnit.Id;
                    item.ItemType = "Vocabulary";
                    item.Title = $"{matchedUnit.Part.Book.Title} - {matchedUnit.Title}";
                    if (string.IsNullOrWhiteSpace(item.Instructions))
                    {
                        item.Instructions = $"{matchedUnit.Part.Book.Title} darsligining {matchedUnit.Title} mavzusidagi yangi so'zlarni yodlang va test topshiring.";
                    }
                }
                else
                {
                    // Bazada mavjud emas! Eslatmali lug'atdan yodlash tugmasi chiqmasligi uchun:
                    // Qat'iy TargetUnitId = null va ItemType = 'TextReminder'
                    item.TargetUnitId = null;
                    item.ItemType = "TextReminder";
                }
            }
        }
    }

    /// <summary>
    /// Matndan kitob nomi, part (qism) va unit raqamini aniqlash
    /// </summary>
    public static (string? bookHint, int? partNumber, int? unitNumber) ParseBookAndUnit(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return (null, null, null);

        string? book = null;
        int? part = null;
        int? unit = null;

        var lower = text.ToLowerInvariant();
        if (lower.Contains("essential") || lower.Contains("4000")) book = "essential";
        else if (lower.Contains("destination")) book = "destination";
        else if (lower.Contains("oxford")) book = "oxford";

        // Part raqami: masalan "part 1", "1-part", "1 part", "1-qism", "qism 1", "kitob 1", "1-kitob", "essential 1"
        var partMatch = Regex.Match(lower, @"(?:part|qism|kitob)\s*[:#-]?\s*(\d+)|(\d+)\s*-?\s*(?:part|qism|kitob)|essential\s*(\d+)");
        if (partMatch.Success)
        {
            var pVal = !string.IsNullOrEmpty(partMatch.Groups[1].Value) 
                ? partMatch.Groups[1].Value 
                : (!string.IsNullOrEmpty(partMatch.Groups[2].Value) ? partMatch.Groups[2].Value : partMatch.Groups[3].Value);
            if (int.TryParse(pVal, out int p)) part = p;
        }

        // Unit raqami: masalan "unit 1", "1-unit", "1 unit", "unit: 4", "unit#2", "mavzu 3", "3-mavzu"
        var unitMatch = Regex.Match(lower, @"(?:unit|mavzu|lesson)\s*[:#-]?\s*(\d+)|(\d+)\s*-?\s*(?:unit|mavzu|lesson)");
        if (unitMatch.Success)
        {
            var uVal = !string.IsNullOrEmpty(unitMatch.Groups[1].Value) ? unitMatch.Groups[1].Value : unitMatch.Groups[2].Value;
            if (int.TryParse(uVal, out int u)) unit = u;
        }

        return (book, part, unit);
    }

    private static BookUnit? MatchUnit(List<BookUnit> allUnits, string? bookHint, int? partNumber, int unitNumber)
    {
        var candidates = allUnits.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(bookHint))
        {
            var hint = bookHint.ToLowerInvariant();
            if (hint.Contains("essential") || hint.Contains("4000"))
                candidates = candidates.Where(u => u.Part.Book.Title.ToLowerInvariant().Contains("essential") || u.Part.Book.Title.Contains("4000"));
            else if (hint.Contains("destination"))
                candidates = candidates.Where(u => u.Part.Book.Title.ToLowerInvariant().Contains("destination"));
            else if (hint.Contains("oxford"))
                candidates = candidates.Where(u => u.Part.Book.Title.ToLowerInvariant().Contains("oxford"));
            else
                candidates = candidates.Where(u => u.Part.Book.Title.ToLowerInvariant().Contains(hint));
        }

        if (partNumber.HasValue)
        {
            candidates = candidates.Where(u => u.Part.PartNumber == partNumber.Value);
        }

        return candidates.FirstOrDefault(u => u.UnitNumber == unitNumber);
    }
}
