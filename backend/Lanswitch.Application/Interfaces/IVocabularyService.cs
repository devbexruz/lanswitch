using System.Collections.Generic;
using System.Threading.Tasks;
using Lanswitch.Application.Models;
using Lanswitch.Domain.Entities;

namespace Lanswitch.Application.Interfaces;

public interface IVocabularyService
{
    Task<List<Book>> GetBooksAsync();
    Task<List<BookPart>> GetBookPartsAsync(long bookId);
    Task<List<BookUnit>> GetBookUnitsAsync(long partId);
    Task<List<BookWord>> GetUnitWordsAsync(long unitId);
    Task<List<QuizQuestionDto>> GenerateUnitQuizAsync(long unitId, int count = 20);
}
