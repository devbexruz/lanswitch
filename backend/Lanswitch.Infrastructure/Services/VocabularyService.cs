using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;
using Lanswitch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lanswitch.Infrastructure.Services;

public class VocabularyService : IVocabularyService
{
    private readonly AppDbContext _db;

    public VocabularyService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<Book>> GetBooksAsync()
    {
        return await _db.Books.OrderBy(b => b.Title).ToListAsync();
    }

    public async Task<List<BookPart>> GetBookPartsAsync(long bookId)
    {
        return await _db.BookParts
            .Where(p => p.BookId == bookId)
            .OrderBy(p => p.PartNumber)
            .ToListAsync();
    }

    public async Task<List<BookUnit>> GetBookUnitsAsync(long partId)
    {
        return await _db.BookUnits
            .Where(u => u.PartId == partId)
            .OrderBy(u => u.UnitNumber)
            .ToListAsync();
    }

    public async Task<List<BookWord>> GetUnitWordsAsync(long unitId)
    {
        return await _db.BookWords
            .Where(w => w.UnitId == unitId)
            .OrderBy(w => w.Id)
            .ToListAsync();
    }

    public async Task<List<QuizQuestionDto>> GenerateUnitQuizAsync(long unitId, int count = 20)
    {
        var words = await _db.BookWords
            .Where(w => w.UnitId == unitId)
            .ToListAsync();

        if (words.Count < 4)
        {
            // Unitda so'zlar kam bo'lsa, umumiy bazadan qo'shimcha so'zlarni olamiz
            var extraWords = await _db.BookWords
                .Where(w => w.UnitId != unitId)
                .Take(20)
                .ToListAsync();
            words.AddRange(extraWords);
        }

        if (words.Count < 4)
            return new List<QuizQuestionDto>();

        var random = new Random();
        var selectedWords = words.OrderBy(_ => random.Next()).Take(Math.Min(count, words.Count)).ToList();
        var questions = new List<QuizQuestionDto>();

        int index = 0;
        foreach (var word in selectedWords)
        {
            // 50% EN -> UZ, 50% UZ -> EN
            bool isEnToUz = (index % 2 == 0);
            index++;

            var question = new QuizQuestionDto
            {
                WordId = word.Id,
                QuestionText = isEnToUz ? word.Word : word.TranslationUz,
                Direction = isEnToUz ? "EN_TO_UZ" : "UZ_TO_EN",
                Ipa = isEnToUz ? word.Ipa : null,
                Options = new List<QuizOptionDto>()
            };

            // To'g'ri javob
            question.Options.Add(new QuizOptionDto
            {
                Text = isEnToUz ? word.TranslationUz : word.Word,
                IsCorrect = true
            });

            // 3 ta random noto'g'ri variantlar (distractors)
            var distractors = words
                .Where(w => w.Id != word.Id)
                .OrderBy(_ => random.Next())
                .Take(3)
                .Select(w => new QuizOptionDto
                {
                    Text = isEnToUz ? w.TranslationUz : w.Word,
                    IsCorrect = false
                })
                .ToList();

            question.Options.AddRange(distractors);

            // Variantlarni random aralashtirish
            question.Options = question.Options.OrderBy(_ => random.Next()).ToList();
            questions.Add(question);
        }

        return questions;
    }
}
