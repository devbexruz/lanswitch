using System.Threading.Tasks;
using Lanswitch.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Lanswitch.Api.Controllers;

[ApiController]
[Route("api/v1/vocabulary")]
public class VocabularyController : ControllerBase
{
    private readonly IVocabularyService _vocabularyService;

    public VocabularyController(IVocabularyService vocabularyService)
    {
        _vocabularyService = vocabularyService;
    }

    /// <summary>
    /// Barcha darslik kitoblar ro'yxati (masalan, Destination B1, 4000 Essential English Words)
    /// </summary>
    [HttpGet("books")]
    public async Task<IActionResult> GetBooks()
    {
        var books = await _vocabularyService.GetBooksAsync();
        return Ok(books);
    }

    /// <summary>
    /// Kitobning qismlari (Parts)
    /// </summary>
    [HttpGet("books/{bookId}/parts")]
    public async Task<IActionResult> GetBookParts(long bookId)
    {
        var parts = await _vocabularyService.GetBookPartsAsync(bookId);
        return Ok(parts);
    }

    /// <summary>
    /// Qism ichidagi Unitlar
    /// </summary>
    [HttpGet("parts/{partId}/units")]
    public async Task<IActionResult> GetBookUnits(long partId)
    {
        var units = await _vocabularyService.GetBookUnitsAsync(partId);
        return Ok(units);
    }

    /// <summary>
    /// Unit ichidagi so'zlar ro'yxati (Flashcardlar uchun)
    /// </summary>
    [HttpGet("units/{unitId}/words")]
    public async Task<IActionResult> GetUnitWords(long unitId)
    {
        var words = await _vocabularyService.GetUnitWordsAsync(unitId);
        return Ok(words);
    }

    /// <summary>
    /// Unit bo'yicha 4-variantli random test generatsiyasi (EN <-> UZ)
    /// </summary>
    [HttpGet("units/{unitId}/quiz")]
    public async Task<IActionResult> GenerateQuiz(long unitId, [FromQuery] int count = 20)
    {
        var quiz = await _vocabularyService.GenerateUnitQuizAsync(unitId, count);
        return Ok(quiz);
    }
}
