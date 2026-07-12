using Lanswitch.Application.Interfaces;
using Lanswitch.Domain.Entities;
using Lanswitch.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WordController : ControllerBase
{
    private readonly IGenericRepository<Word> _wordRepo;
    private readonly IGenericRepository<WordTranslate> _wordTranslateRepo;
    private readonly IGeminiAiService _geminiService;

    public WordController(
        IGenericRepository<Word> wordRepo,
        IGenericRepository<WordTranslate> wordTranslateRepo,
        IGeminiAiService geminiService)
    {
        _wordRepo = wordRepo;
        _wordTranslateRepo = wordTranslateRepo;
        _geminiService = geminiService;
    }

    [HttpGet("translate")]
    public async Task<IActionResult> TranslateWord([FromQuery] string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return BadRequest(new { message = "So'z kiritilmagan" });
        
        var wordText = text.Trim().ToLower();

        // 1. Bazadan qidirish
        var allWords = await _wordRepo.GetAllAsync();
        var existingWord = allWords.FirstOrDefault(w => w.Text.ToLower() == wordText);
        
        if (existingWord != null)
        {
            var allTranslates = await _wordTranslateRepo.GetAllAsync();
            var existingTranslate = allTranslates.FirstOrDefault(t => t.WordId == existingWord.Id && t.LanguageId == 1);
            if (existingTranslate != null)
            {
                return Ok(new { word = existingWord.Text, translation = existingTranslate.TranslateText });
            }
        }

        // 2. Agar bazada yo'q bo'lsa yoki tarjimasi bo'lmasa, AI dan so'rash
        var aiTranslation = await _geminiService.TranslateWordAsync(wordText);

        
        // 3. Bazaga saqlash
        long wordId = 0;
        if (existingWord == null)
        {
            var newWord = new Word { Text = wordText, LanguageId = 2 /* English */ };
            await _wordRepo.AddAsync(newWord);
            wordId = newWord.Id;
        }
        else
        {
            wordId = existingWord.Id;
        }

        var newTranslate = new WordTranslate { WordId = wordId, LanguageId = 1 /* Uzbek */, TranslateText = aiTranslation };
        await _wordTranslateRepo.AddAsync(newTranslate);

        return Ok(new { word = wordText, translation = aiTranslation });
    }
}
