import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { api } from '../utils/api';
import type { 
  StudentGroup, AssignmentDetail, AssignmentItemDetail, 
  BookWord, QuizQuestion, Book, BookPart, BookUnit 
} from '../utils/api';
import { 
  BookOpen, CheckCircle2, XCircle, AlertTriangle, 
  Send, ChevronLeft, ChevronRight, Volume2, Sparkles, 
  Clock, Trophy, X, Check, RefreshCw, Film, Library, Play, Search, ArrowLeft,
  Trash2, ExternalLink, FileText, ChevronDown, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from '../components/ProfileDropdown';
import BottomNav from '../components/BottomNav';

export default function StudentMiniAppPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Navigation: 3 Core Panels
  const [mainTab, setMainTab] = useState<'homework' | 'movies' | 'vocabulary'>(() => {
    const saved = localStorage.getItem('lanswitch_student_main_tab');
    return (saved === 'movies' || saved === 'vocabulary' || saved === 'homework') ? saved : 'homework';
  });

  // Homework 3 Core Sub-Tabs: 'todo' | 'notes' | 'penalties' | 'all'
  const [homeworkSubTab, setHomeworkSubTab] = useState<'todo' | 'notes' | 'penalties' | 'all'>('todo');
  const [showPenaltyHistoryModal, setShowPenaltyHistoryModal] = useState(false);

  // Student ID
  const [studentId, setStudentId] = useState<number>(authUser?.id || 1);
  const initialLoadedRef = useRef(false);
  
  // Student state (Homework)
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Completed' | 'Penalty' | 'Unchecked' | 'Pending'>('All');
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // First-time Onboarding Modal State
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Vocabulary Flashcard & Quiz Modal State
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [currentVocabTitle, setCurrentVocabTitle] = useState('Lug\'at');
  const [currentVocabSubTitle, setCurrentVocabSubTitle] = useState('Destination B1');
  const [currentVocabItemId, setCurrentVocabItemId] = useState<number | null>(null);
  const [vocabMode, setVocabMode] = useState<'flashcards' | 'quiz'>('flashcards');
  const [words, setWords] = useState<BookWord[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);


  // Movies Section State
  const [movies, setMovies] = useState<any[]>([]);
  const [movieSearch, setMovieSearch] = useState('');
  const [selectedMovieLevel, setSelectedMovieLevel] = useState<string>('All');
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);

  // Vocabulary Hierarchy State (Book -> BookPart -> PartUnit -> UnitWord)
  const [vocabStep, setVocabStep] = useState<'books' | 'parts' | 'units'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [parts, setParts] = useState<BookPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<BookPart | null>(null);
  const [units, setUnits] = useState<BookUnit[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);

  // Initialize Telegram WebApp & Auth State
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (e) {
      console.warn('Telegram WebApp SDK not initialized:', e);
    }

    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadInitialData();
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authUser?.role === 'Teacher') {
      const search = window.location.search || '';
      navigate(`/teacher${search}`, { replace: true });
      return;
    }
    localStorage.setItem('lanswitch_last_route', '/student');
  }, [authUser?.role]);

  useEffect(() => {
    localStorage.setItem('lanswitch_student_main_tab', mainTab);
    if (mainTab === 'movies') {
      loadMovies();
    } else if (mainTab === 'vocabulary') {
      loadBooks();
    }
  }, [mainTab]);

  const loadInitialData = async () => {
    setIsLoading(true);
    let resolvedId = authUser?.id;

    if (!resolvedId) {
      const stored = localStorage.getItem('lanswitch_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u?.id) resolvedId = u.id;
        } catch {}
      }
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryUserId = urlParams.get('user_id');
      const queryTgId = urlParams.get('telegram_id');

      const tg = (window as any).Telegram?.WebApp;
      const tgUserObj = tg?.initDataUnsafe?.user;
      const appTgId = tgUserObj?.id?.toString() || queryTgId;

      if (appTgId || queryUserId) {
        const autoLoginRes = await api.telegramAutoLogin({
          telegramId: appTgId,
          userId: queryUserId ? parseInt(queryUserId, 10) : undefined,
          firstName: tgUserObj?.first_name,
          lastName: tgUserObj?.last_name,
          username: tgUserObj?.username,
          photoUrl: tgUserObj?.photo_url,
          initData: tg?.initData
        });

        if (autoLoginRes?.user) {
          resolvedId = autoLoginRes.user.id;
          localStorage.setItem('lanswitch_user', JSON.stringify(autoLoginRes.user));
          if (autoLoginRes.user.role === 'Teacher') {
            const search = window.location.search || '';
            navigate(`/teacher${search}`, { replace: true });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error during auto-login in Mini App:', e);
    }

    const currentStudentId = resolvedId || 1;
    setStudentId(currentStudentId);

    const userGroups = await api.getStudentGroups(currentStudentId);
    setGroups(userGroups);

    if (userGroups.length === 0) {
      setShowOnboardingModal(true);
    } else {
      setShowOnboardingModal(false);
      const savedGroupId = localStorage.getItem('lanswitch_student_selected_group_id');
      const found = userGroups.find(g => g.id.toString() === savedGroupId);
      const initial = found || userGroups[0];
      setSelectedGroup(initial);
      await loadAssignments(initial.id, 'All', currentStudentId);
    }
    setIsLoading(false);
  };

  const loadAssignments = async (groupId: number, filter: string, sId?: number) => {
    setIsLoading(true);
    const resolvedId = sId ?? studentId;
    const data = await api.getStudentAssignments(groupId, filter, resolvedId);
    setAssignments(data);
    setIsLoading(false);
  };

  const handleSelectGroup = async (g: StudentGroup) => {
    setSelectedGroup(g);
    localStorage.setItem('lanswitch_student_selected_group_id', g.id.toString());
    setShowGroupDrawer(false);
    await loadAssignments(g.id, activeFilter, studentId);
  };

  const handleFilterChange = async (filter: 'All' | 'Completed' | 'Penalty' | 'Unchecked' | 'Pending') => {
    setActiveFilter(filter);
    if (selectedGroup) {
      await loadAssignments(selectedGroup.id, filter, studentId);
    }
  };

  // Text-To-Speech for pronunciation
  const playPronunciation = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Open Vocabulary Modal (from homework item)
  const openVocabModal = async (item: AssignmentItemDetail) => {
    setCurrentVocabItemId(item.id);
    setCurrentVocabTitle(item.targetUnitTitle || item.title);
    setCurrentVocabSubTitle(item.bookTitle || 'Lug\'at');
    setVocabMode('flashcards');
    setCurrentWordIdx(0);
    setIsFlipped(false);
    setQuizFinished(false);
    setQuizScore(0);
    setQuizIdx(0);
    setSelectedOption(null);

    if (item.targetUnitId) {
      const unitWords = await api.getUnitWords(item.targetUnitId);
      setWords(unitWords);
      const questions = await api.generateQuiz(item.targetUnitId);
      setQuizQuestions(questions);
    } else if (item.instructions && item.instructions.trim().length > 0) {
      // Parse custom vocabulary lines from instructions (e.g. apple - olma or car: mashina)
      const lines = item.instructions.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const parsedWords: BookWord[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split(/[-–—:=]/);
        if (parts.length >= 2) {
          const en = parts[0].trim();
          const uz = parts.slice(1).join(' ').trim();
          if (en && uz) {
            parsedWords.push({
              id: idx + 1,
              unitId: 0,
              word: en,
              translationUz: uz,
              partOfSpeech: '',
              ipa: '',
              exampleSentence: ''
            });
          }
        }
      });

      if (parsedWords.length > 0) {
        setWords(parsedWords);
        const questions: QuizQuestion[] = parsedWords.map((w) => {
          const otherWords = parsedWords.filter(p => p.id !== w.id);
          const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
          const distractors = shuffledOthers.slice(0, 3).map(o => o.translationUz);
          const fallbacks = ['Lug\'at', 'Kitob', 'Dars', 'Qoida', 'Uy vazifasi'];
          while (distractors.length < 3) {
            distractors.push(fallbacks[distractors.length % fallbacks.length]);
          }
          const options = [
            { text: w.translationUz, isCorrect: true },
            { text: distractors[0], isCorrect: false },
            { text: distractors[1], isCorrect: false },
            { text: distractors[2], isCorrect: false },
          ].sort(() => 0.5 - Math.random());

          return {
            wordId: w.id,
            questionText: w.word,
            direction: 'EN_TO_UZ' as const,
            options
          };
        });
        setQuizQuestions(questions);
      } else {
        const unitWords = await api.getUnitWords(4);
        setWords(unitWords);
        const questions = await api.generateQuiz(4);
        setQuizQuestions(questions);
      }
    } else {
      const unitWords = await api.getUnitWords(4);
      setWords(unitWords);
      const questions = await api.generateQuiz(4);
      setQuizQuestions(questions);
    }

    setVocabModalOpen(true);
  };

  // Open Vocabulary Modal (from Book Unit browser)
  const openVocabModalForUnit = async (unit: BookUnit, initialMode: 'flashcards' | 'quiz') => {
    setCurrentVocabItemId(null);
    setCurrentVocabTitle(unit.title);
    setCurrentVocabSubTitle(selectedBook?.title || 'Lug\'at');
    setVocabMode(initialMode);
    setCurrentWordIdx(0);
    setIsFlipped(false);
    setQuizFinished(false);
    setQuizScore(0);
    setQuizIdx(0);
    setSelectedOption(null);

    const unitWords = await api.getUnitWords(unit.id);
    setWords(unitWords);

    const questions = await api.generateQuiz(unit.id);
    setQuizQuestions(questions);

    setVocabModalOpen(true);
  };

  const handleQuizAnswer = (optionIdx: number, isCorrect: boolean) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }

    setTimeout(() => {
      if (quizIdx + 1 < quizQuestions.length) {
        setQuizIdx(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setQuizFinished(true);
        const finalScore = isCorrect ? quizScore + 1 : quizScore;
        const total = quizQuestions.length;
        if (currentVocabItemId && finalScore / total >= 0.7) {
          api.submitQuizResult(currentVocabItemId, finalScore, total);
        }
      }
    }, 1200);
  };


  // Open Telegram Bot to submit media
  const handleOpenBotForMedia = (itemId: number) => {
    const botUrl = `https://t.me/lanswitchbot?start=item_${itemId}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(botUrl);
      setTimeout(() => {
        try {
          tg.close();
        } catch (e) {
          console.error(e);
        }
      }, 300);
    } else {
      window.location.href = botUrl;
    }
  };

  // Delete media attachment
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm("Rostdan ham ushbu faylni o'chirmoqchimisiz?")) return;
    try {
      await api.deleteAttachment(attachmentId);
      if (selectedGroup) {
        await loadAssignments(selectedGroup.id, activeFilter, studentId);
      }
    } catch (err) {
      alert("Faylni o'chirishda xatolik yuz berdi");
    }
  };

  // Load Movies
  const loadMovies = async () => {
    setIsLoadingMovies(true);
    const data = await api.getMovies();
    setMovies(data);
    setIsLoadingMovies(false);
  };

  // Load Books Hierarchy
  const loadBooks = async () => {
    setIsLoadingVocab(true);
    const data = await api.getBooks();
    setBooks(data);
    setVocabStep('books');
    setIsLoadingVocab(false);
  };

  const handleSelectBook = async (b: Book) => {
    setSelectedBook(b);
    setIsLoadingVocab(true);
    const bookParts = await api.getBookParts(b.id);
    setParts(bookParts);
    setVocabStep('parts');
    setIsLoadingVocab(false);
  };

  const handleSelectPart = async (p: BookPart) => {
    setSelectedPart(p);
    setIsLoadingVocab(true);
    const partUnits = await api.getBookUnits(p.id);
    setUnits(partUnits);
    setVocabStep('units');
    setIsLoadingVocab(false);
  };

  // 1. Pending / To Do assignments:
  const todoAssignments = useMemo(() => {
    return assignments.filter(a => {
      return a.items.some(it => 
        it.itemType !== 'TextReminder' &&
        (it.mySubmissionStatus !== 1 && it.mySubmissionStatus !== 2)
      );
    });
  }, [assignments]);

  const todoItemsCount = useMemo(() => {
    return todoAssignments.reduce((acc, a) => {
      return acc + a.items.filter(it => 
        it.itemType !== 'TextReminder' &&
        (it.mySubmissionStatus !== 1 && it.mySubmissionStatus !== 2)
      ).length;
    }, 0);
  }, [todoAssignments]);

  // 2. Reading / Notes items:
  const notesItems = useMemo(() => {
    const list: Array<{ assignment: AssignmentDetail; item: AssignmentItemDetail }> = [];
    assignments.forEach(a => {
      a.items.forEach(it => {
        if (it.itemType === 'TextReminder' || (it.instructions && it.instructions.trim().length > 0)) {
          list.push({ assignment: a, item: it });
        }
      });
    });
    return list;
  }, [assignments]);

  const notesItemsCount = notesItems.length;

  // 3. Active Penalties (Jazolar):
  const activePenalties = useMemo(() => {
    const list: Array<{ assignment: AssignmentDetail; item: AssignmentItemDetail }> = [];
    assignments.forEach(a => {
      a.items.forEach(it => {
        if (it.mySubmissionStatus === 0) {
          list.push({ assignment: a, item: it });
        }
      });
    });
    return list;
  }, [assignments]);

  const activePenaltiesCount = activePenalties.length;

  // 4. All Penalties History (0 and 2):
  const penaltyHistory = useMemo(() => {
    const list: Array<{ assignment: AssignmentDetail; item: AssignmentItemDetail }> = [];
    assignments.forEach(a => {
      a.items.forEach(it => {
        if (it.mySubmissionStatus === 0 || it.mySubmissionStatus === 2) {
          list.push({ assignment: a, item: it });
        }
      });
    });
    return list;
  }, [assignments]);

  // Filtered assignments display helper
  const filteredAssignments = assignments.filter(assignment => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Completed') {
      return assignment.items.every(it => it.mySubmissionStatus === 1 || it.mySubmissionStatus === 2);
    }
    if (activeFilter === 'Penalty') {
      return assignment.items.some(it => it.mySubmissionStatus === 0);
    }
    if (activeFilter === 'Unchecked') {
      return assignment.items.some(it => it.mySubmissionStatus === null && it.mySubmittedAt);
    }
    if (activeFilter === 'Pending') {
      return assignment.items.some(it => it.mySubmissionStatus === null && !it.mySubmittedAt);
    }
    return true;
  });

  // Filtered movies
  const filteredMovies = movies.filter(m => {
    const matchesSearch = movieSearch.trim() === '' || m.title?.toLowerCase().includes(movieSearch.toLowerCase());
    const matchesLevel = selectedMovieLevel === 'All' || m.level === selectedMovieLevel;
    return matchesSearch && matchesLevel;
  });

  const renderAssignmentItem = (item: AssignmentItemDetail, idx: number, _assignment: AssignmentDetail) => {
    const isCompleted = item.mySubmissionStatus === 1 || item.mySubmissionStatus === 2;
    const isPenalty = item.mySubmissionStatus === 0;

    return (
      <div
        key={item.id}
        style={{
          background: 'var(--ice-blue-card)',
          borderRadius: 'var(--radius-card-sm)',
          border: isPenalty 
            ? '1.5px solid var(--status-danger-border)' 
            : isCompleted 
            ? '1.5px solid var(--status-success-border)' 
            : '1.5px solid var(--sky-border)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--ice-blue-bg)',
              color: 'var(--primary-blue)',
              border: '1.5px solid var(--sky-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '2px 10px',
              fontSize: '12px',
              fontWeight: 800
            }}>
              {idx + 1}-QISM
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy-secondary)' }}>
              {item.itemType === 'TextReminder' && '📌 Eslatma'}
              {item.itemType === 'Vocabulary' && '📚 Lug\'at'}
              {item.itemType === 'MediaSubmission' && '🎬 Media vazifa'}
            </span>
          </div>

          <div>
            {item.mySubmissionStatus === 1 && (
              <span style={{
                background: 'var(--status-success-bg)',
                color: 'var(--status-success)',
                border: '1px solid var(--status-success-border)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} /> Bajarildi
              </span>
            )}
            {item.mySubmissionStatus === 0 && (
              <span style={{
                background: 'var(--status-danger-bg)',
                color: 'var(--status-danger)',
                border: '1px solid var(--status-danger-border)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <XCircle size={13} /> Jarima (0)
              </span>
            )}
            {item.mySubmissionStatus === 2 && (
              <span style={{
                background: 'var(--status-warning-bg)',
                color: 'var(--status-warning)',
                border: '1px solid var(--status-warning-border)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertTriangle size={13} /> Jarima Bajarildi (2)
              </span>
            )}
            {item.mySubmissionStatus === null && item.mySubmittedAt && (
              <span style={{
                background: 'var(--ice-blue-bg)',
                color: 'var(--primary-blue)',
                border: '1px solid var(--sky-border)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 800
              }}>
                ⏳ Tekshirilmoqda
              </span>
            )}
            {item.mySubmissionStatus === null && !item.mySubmittedAt && (
              <span style={{
                background: '#F1F5F9',
                color: 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 700
              }}>
                Kutilmoqda
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>
            {item.title}
          </div>
          {item.instructions && (
            <div style={{ fontSize: '14px', color: 'var(--text-navy-secondary)', lineHeight: 1.4 }}>
              {item.instructions}
            </div>
          )}
        </div>

        {item.mySubmissionComment && (
          <div style={{
            background: isPenalty ? 'var(--status-danger-bg)' : 'var(--ice-blue-bg)',
            border: `1px solid ${isPenalty ? 'var(--status-danger-border)' : 'var(--sky-border)'}`,
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '13px',
            color: isPenalty ? 'var(--status-danger)' : 'var(--primary-blue)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <span style={{ fontWeight: 800 }}>Ustoz izohi:</span>
            <span>{item.mySubmissionComment}</span>
          </div>
        )}

        {/* Action Buttons */}
        {item.itemType === 'Vocabulary' && (
          <button
            onClick={() => openVocabModal(item)}
            className="btn-big-blue"
            style={{ width: '100%', minHeight: '52px', fontSize: '15px', marginTop: '4px' }}
          >
            <BookOpen size={20} />
            <span>SO'ZLARNI YODLASH</span>
          </button>
        )}

        {item.itemType === 'MediaSubmission' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {/* Show Attachments if already uploaded */}
            {item.attachments && item.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-navy)', textTransform: 'uppercase' }}>
                  📎 Yuborilgan javoblar ({item.attachments.length}):
                </div>
                {item.attachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      background: 'var(--pure-white)',
                      border: '1.5px solid var(--sky-border)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-navy)' }}>
                        {att.fileType === 'video' && '🎬 Video'}
                        {(att.fileType === 'voice' || att.fileType === 'audio') && '🎙️ Ovoz / Audio'}
                        {att.fileType === 'photo' && '🖼️ Rasm'}
                      </div>
                      {item.mySubmissionStatus !== 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          style={{
                            background: 'var(--status-danger-bg)',
                            border: '1px solid var(--status-danger-border)',
                            borderRadius: '6px',
                            color: 'var(--status-danger)',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          <Trash2 size={13} />
                          <span>O'chirish</span>
                        </button>
                      )}
                    </div>

                    {(att.fileType === 'voice' || att.fileType === 'audio') && (
                      <audio controls src={att.streamUrl} style={{ width: '100%', height: '36px' }} />
                    )}

                    {att.fileType === 'photo' && (
                      <img
                        src={att.streamUrl}
                        alt="Yuklangan rasm"
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}

                    {att.fileType === 'video' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <video
                          controls
                          src={att.streamUrl}
                          style={{ width: '100%', maxHeight: '220px', borderRadius: '8px', background: '#000' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenBotForMedia(item.id)}
                          style={{
                            background: 'var(--ice-blue-bg)',
                            border: '1px solid var(--sky-border)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--primary-blue)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <ExternalLink size={14} />
                          <span>Telegram botda ko'rish (Katta video)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {item.mySubmissionStatus === 1 ? (
              <div style={{
                background: '#F0FDF4',
                border: '1.5px solid #BBF7D0',
                borderRadius: '12px',
                padding: '12px 16px',
                color: '#15803D',
                fontWeight: 800,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px'
              }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span>Topshiriq ustoz tomonidan 'Bajarildi' deb qabul qilingan (Yopiq)</span>
              </div>
            ) : (
              <button
                onClick={() => handleOpenBotForMedia(item.id)}
                className="btn-big-blue"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  fontSize: '15px',
                  background: isCompleted ? 'var(--ice-blue-bg)' : 'var(--primary-blue)',
                  color: isCompleted ? 'var(--primary-blue)' : 'var(--pure-white)',
                  border: isCompleted ? '2px solid var(--primary-blue)' : 'none'
                }}
              >
                <Send size={18} />
                <span>{item.attachments && item.attachments.length > 0 ? 'QAYTA YUBORISH (BOT)' : 'YUBORISH (BOT)'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-page-wrapper" style={{
      minHeight: '100vh',
      maxWidth: '640px',
      margin: '0 auto',
      background: 'var(--ice-blue-bg)',
      color: 'var(--text-navy)',
      fontFamily: 'var(--font-main)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingBottom: '90px'
    }}>

      {/* ======================================================== */}
      {/* 1. TOP HEADER                                            */}
      {/* ======================================================== */}
      <header style={{
        background: 'var(--pure-white)',
        borderBottom: '2px solid var(--sky-border)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-subtle)'
      }}>
        {/* Left: Group Switcher or Section Title */}
        {mainTab === 'homework' ? (
          <button
            onClick={() => setShowGroupDrawer(true)}
            title={selectedGroup ? selectedGroup.title : 'Guruhni tanlang'}
            style={{
              background: 'var(--ice-blue-bg)',
              border: '1.5px solid var(--sky-border)',
              color: 'var(--text-navy)',
              borderRadius: '16px',
              padding: '6px 12px 6px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)',
              maxWidth: '220px',
              minWidth: 0,
              flexShrink: 1,
              transition: 'all 0.2s ease',
              textAlign: 'left'
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary-blue) 0%, #1D4ED8 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}>
              <Users size={16} strokeWidth={2.5} />
            </div>
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>
                Guruh
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: 900,
                color: 'var(--text-navy)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
                lineHeight: 1.2
              }}>
                {selectedGroup ? selectedGroup.title : 'Guruhni tanlang'}
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </button>
        ) : mainTab === 'movies' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={22} color="var(--primary-blue)" />
            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)' }}>Kinolar</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Library size={22} color="var(--primary-blue)" />
            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)' }}>Lug'atlarim</span>
          </div>
        )}

        {/* User Profile Dropdown with DB Role Switcher */}
        <ProfileDropdown onNavigateTab={(t) => setMainTab(t as any)} variant="student" />
      </header>

      {/* ======================================================== */}
      {/* 2. TAB CONTENT: UYGA VAZIFALAR (HOMEWORK)                */}
      {/* ======================================================== */}
      {mainTab === 'homework' && (
        <>
          {/* 4 TOP CATEGORY TABS */}
          <div style={{
            padding: '14px 20px 6px 20px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            display: 'flex',
            gap: '8px',
            scrollbarWidth: 'none'
          }}>
            {[
              { key: 'todo', label: `📌 Bajarilishi kerak (${todoItemsCount})`, bg: '#EFF6FF', activeBg: 'var(--primary-blue)', color: 'var(--primary-blue)', activeColor: '#fff' },
              { key: 'notes', label: `📖 Eslatmalar (${notesItemsCount})`, bg: '#F0FDF4', activeBg: '#16A34A', color: '#15803D', activeColor: '#fff' },
              { key: 'penalties', label: `❌ Jazolar (${activePenaltiesCount})`, bg: '#FEF2F2', activeBg: '#DC2626', color: '#B91C1C', activeColor: '#fff' },
              { key: 'all', label: `Barchasi (${assignments.length})`, bg: '#F1F5F9', activeBg: 'var(--text-navy)', color: 'var(--text-navy)', activeColor: '#fff' },
            ].map(tab => {
              const isActive = homeworkSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setHomeworkSubTab(tab.key as any)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    background: isActive ? tab.activeBg : tab.bg,
                    color: isActive ? tab.activeColor : tab.color,
                    boxShadow: isActive ? '0 6px 16px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* MAIN CONTENT AREA */}
          <main style={{ padding: '16px 20px', flex: 1 }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ 
                  width: '40px', height: '40px', border: '4px solid var(--sky-border)', 
                  borderTopColor: 'var(--primary-blue)', borderRadius: '50%', margin: '0 auto 16px',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{ fontWeight: 700 }}>Vazifalar yuklanmoqda...</div>
              </div>
            ) : homeworkSubTab === 'todo' ? (
              /* TAB 1: BAJARILISHI KERAK */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {todoAssignments.length === 0 ? (
                  <div style={{
                    background: 'var(--pure-white)',
                    borderRadius: 'var(--radius-card)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    border: '2px dashed #86EFAC',
                    marginTop: '10px'
                  }}>
                    <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginBottom: '6px' }}>
                      Barcha vazifalar topshirilgan!
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      Hozirda topshirilishi kutilayotgan yangi vazifalar mavjud emas.
                    </div>
                  </div>
                ) : (
                  todoAssignments.map(assignment => {
                    const pendingItems = assignment.items.filter(it => 
                      it.itemType !== 'TextReminder' &&
                      (it.mySubmissionStatus !== 1 && it.mySubmissionStatus !== 2)
                    );
                    if (pendingItems.length === 0) return null;

                    return (
                      <div
                        key={assignment.id}
                        style={{
                          background: 'var(--pure-white)',
                          borderRadius: 'var(--radius-card)',
                          border: '2px solid var(--sky-border)',
                          boxShadow: 'var(--shadow-card)',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{
                          background: 'linear-gradient(135deg, var(--primary-blue) 0%, #1D4ED8 100%)',
                          padding: '16px 20px',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '17px', fontWeight: 900 }}>📅 {assignment.title}</div>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>{assignment.groupTitle}</div>
                          </div>
                          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                            {pendingItems.length} ta bajarilmagan • {assignment.items.length} ta qism
                          </span>
                        </div>

                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {assignment.items.map((item, idx) => renderAssignmentItem(item, idx, assignment))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : homeworkSubTab === 'notes' ? (
              /* TAB 2: ESLATMALAR */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {notesItems.length === 0 ? (
                  <div style={{
                    background: 'var(--pure-white)',
                    borderRadius: 'var(--radius-card)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    border: '2px dashed var(--sky-border)',
                    marginTop: '10px'
                  }}>
                    <div style={{ fontSize: '38px', marginBottom: '10px' }}>📖</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>
                      Hozircha eslatmalar yo'q
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      O'qituvchi tomonidan kiritilgan o'qish va qoidalar eslatmalari shu yerda ko'rinadi.
                    </div>
                  </div>
                ) : (
                  notesItems.map((n, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--pure-white)',
                        borderRadius: '16px',
                        border: '1.5px solid var(--sky-border)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-blue)', background: 'var(--ice-blue-bg)', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
                          📅 {n.assignment.title}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {n.assignment.groupTitle}
                        </span>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="var(--primary-blue)" />
                        <span>{n.item.title}</span>
                      </div>

                      {n.item.instructions && (
                        <div style={{
                          background: '#F8FAFC',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          border: '1px solid var(--sky-border)',
                          fontSize: '14px',
                          color: '#334155',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap'
                        }}>
                          {n.item.instructions}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : homeworkSubTab === 'penalties' ? (
              /* TAB 3: JAZOLAR */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={18} color="#DC2626" />
                    <span>Faol Jarimalar ({activePenaltiesCount})</span>
                  </div>
                  <button
                    onClick={() => setShowPenaltyHistoryModal(true)}
                    style={{
                      background: 'var(--ice-blue-bg)',
                      border: '1.5px solid var(--sky-border)',
                      color: 'var(--primary-blue)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>📜 Jazolar Tarixi</span>
                  </button>
                </div>

                {activePenalties.length === 0 ? (
                  <div style={{
                    background: 'var(--pure-white)',
                    borderRadius: 'var(--radius-card)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    border: '2px dashed #86EFAC',
                    marginTop: '6px'
                  }}>
                    <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginBottom: '6px' }}>
                      Faol jarimalar mavjud emas!
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      Siz barcha vazifalarni namunali bajaryapsiz. A'lo darajada davom eting!
                    </div>
                  </div>
                ) : (
                  activePenalties.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#fff',
                        borderRadius: '16px',
                        border: '2px solid #FCA5A5',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#B91C1C', background: '#FEE2E2', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
                          📅 {p.assignment.title}
                        </span>
                        <span style={{ background: '#DC2626', color: '#fff', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: 900 }}>
                          ❌ Jarima
                        </span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)' }}>
                          📌 Qism: {p.item.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.assignment.groupTitle}
                        </div>
                      </div>

                      <div style={{
                        background: '#FEF2F2',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: '1px solid #FECACA',
                        fontSize: '14px',
                        color: '#991B1B',
                        lineHeight: 1.5
                      }}>
                        🚨 <b>Jazo izohi:</b> "{p.item.mySubmissionComment || "O'qituvchi tomonidan jarima belgilandi"}"
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* TAB 4: BARCHASI (ALL ASSIGNMENTS) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Secondary Filters for All */}
                <div style={{
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  gap: '8px',
                  scrollbarWidth: 'none',
                  paddingBottom: '4px'
                }}>
                  {[
                    { key: 'All', label: 'Barchasi' },
                    { key: 'Completed', label: '✅ Bajarilgan' },
                    { key: 'Penalty', label: '❌ Jarima' },
                    { key: 'Unchecked', label: '⏳ Tekshirilmoqda' },
                    { key: 'Pending', label: '📌 Kutilmoqda' }
                  ].map(tab => {
                    const isActive = activeFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => handleFilterChange(tab.key as any)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isActive ? '2px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                          background: isActive ? 'var(--primary-blue)' : 'var(--pure-white)',
                          color: isActive ? 'var(--pure-white)' : 'var(--text-navy)',
                          flexShrink: 0
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {filteredAssignments.length === 0 ? (
                  <div style={{
                    background: 'var(--pure-white)',
                    borderRadius: 'var(--radius-card)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    border: '2px dashed var(--sky-border)'
                  }}>
                    <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '6px' }}>
                      Ushbu bo'limda vazifa yo'q!
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      Tanlangan filtr bo'yicha topshiriqlar mavjud emas.
                    </div>
                  </div>
                ) : (
                  filteredAssignments.map(assignment => (
                    <div
                      key={assignment.id}
                      style={{
                        background: 'var(--pure-white)',
                        borderRadius: 'var(--radius-card)',
                        border: '2px solid var(--sky-border)',
                        boxShadow: 'var(--shadow-card)',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        background: 'linear-gradient(135deg, var(--primary-blue) 0%, #1D4ED8 100%)',
                        padding: '18px 20px',
                        color: 'var(--pure-white)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.3px' }}>
                            📅 {assignment.title}
                          </div>
                          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                            {assignment.groupTitle}
                          </div>
                        </div>
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(8px)',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '12px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Clock size={14} />
                          <span>{assignment.items.length} ta qism</span>
                        </div>
                      </div>

                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {assignment.items.map((item, idx) => renderAssignmentItem(item, idx, assignment))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* ======================================================== */}
      {/* 3. TAB CONTENT: KINOLAR (ENGLISH MOVIES)                 */}
      {/* ======================================================== */}
      {mainTab === 'movies' && (
        <main style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Kino yoki serial qidirish..."
              value={movieSearch}
              onChange={e => setMovieSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                borderRadius: 'var(--radius-pill)',
                border: '1.5px solid var(--sky-border)',
                background: 'var(--pure-white)',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          {/* Level Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setSelectedMovieLevel(lvl)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: selectedMovieLevel === lvl ? '2px solid var(--primary-blue)' : '1.5px solid var(--sky-border)',
                  background: selectedMovieLevel === lvl ? 'var(--primary-blue)' : 'var(--pure-white)',
                  color: selectedMovieLevel === lvl ? 'var(--pure-white)' : 'var(--text-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {lvl === 'All' ? 'Barchasi' : lvl}
              </button>
            ))}
          </div>

          {/* Notice: Read-only for students */}
          <div style={{ background: 'var(--ice-blue-bg)', border: '1px solid var(--sky-border)', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>ℹ️</span>
            <span>Subtitrli kinolar tizim administratori tomonidan qo'shiladi va taqdim etiladi.</span>
          </div>

          {/* Movies Grid */}
          {isLoadingMovies ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Kinolar yuklanmoqda...
            </div>
          ) : filteredMovies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--pure-white)', borderRadius: '20px', border: '1.5px dashed var(--sky-border)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎬</div>
              <div style={{ fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>Kinolar topilmadi</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Qidiruv yoki daraja bo'yicha boshqa variantni tanlab ko'ring.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
              {filteredMovies.map(movie => (
                <div
                  key={movie.id}
                  onClick={() => navigate(`/legacy/player/${movie.id}`)}
                  style={{
                    background: 'var(--pure-white)',
                    borderRadius: '16px',
                    border: '1.5px solid var(--sky-border)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '220px', background: '#0F172A' }}>
                    <img
                      src={movie.thumbnailUrl || "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300"}
                      alt={movie.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                      <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                        🇬🇧 EN
                      </span>
                      {movie.level && (
                        <span style={{ background: 'var(--primary-blue)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                          {movie.level}
                        </span>
                      )}
                    </div>

                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-blue)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                        <Play size={22} fill="var(--primary-blue)" style={{ marginLeft: '3px' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-navy)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {movie.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{movie.isFilm ? 'Kino' : 'Serial'}</span>
                      <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>Subtitrli</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ======================================================== */}
      {/* 4. TAB CONTENT: LUG'ATLARIM (BOOK -> PART -> UNIT)       */}
      {/* ======================================================== */}
      {mainTab === 'vocabulary' && (
        <main style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Breadcrumb Navigation */}
          {vocabStep !== 'books' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                onClick={() => {
                  if (vocabStep === 'units') setVocabStep('parts');
                  else if (vocabStep === 'parts') setVocabStep('books');
                }}
                className="btn-big-white"
                style={{ minHeight: '36px', padding: '0 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Ortga
              </button>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {vocabStep === 'parts' && `Kitob: ${selectedBook?.title}`}
                {vocabStep === 'units' && `${selectedBook?.title} > ${selectedPart?.title}`}
              </div>
            </div>
          )}

          {/* STEP 1: Books List */}
          {vocabStep === 'books' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px' }}>
                📖 Darslik Kitoblar
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Yodlamoqchi bo'lgan lug'at kitobingizni tanlang:
              </div>

              {isLoadingVocab ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Kitoblar yuklanmoqda...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {books.map(b => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBook(b)}
                      style={{
                        background: 'var(--pure-white)',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        border: '1.5px solid var(--sky-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-card)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--ice-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-blue)', border: '1.5px solid var(--sky-border)' }}>
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)' }}>
                            {b.title}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {b.description || 'Ingliz tili so\'z boyligi'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} color="var(--primary-blue)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Book Parts */}
          {vocabStep === 'parts' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px' }}>
                📚 {selectedBook?.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Kitob qismini tanlang:
              </div>

              {isLoadingVocab ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Qismlar yuklanmoqda...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {parts.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPart(p)}
                      style={{
                        background: 'var(--pure-white)',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        border: '1.5px solid var(--sky-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)' }}>
                          {p.title || `${p.partNumber}-Qism`}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--primary-blue)', fontWeight: 600, marginTop: '2px' }}>
                          Unitlar to'plami
                        </div>
                      </div>
                      <ChevronRight size={20} color="var(--primary-blue)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Part Units (Flashcard & Quiz launchers) */}
          {vocabStep === 'units' && (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px' }}>
                🎯 {selectedPart?.title || 'Unitlar'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Unitni tanlab, flashcardlar bilan yodlang yoki testdan o'ting:
              </div>

              {isLoadingVocab ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Unitlar yuklanmoqda...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {units.map(u => (
                    <div
                      key={u.id}
                      style={{
                        background: 'var(--pure-white)',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        border: '1.5px solid var(--sky-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)' }}>
                        {u.title}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          onClick={() => openVocabModalForUnit(u, 'flashcards')}
                          className="btn-big-white"
                          style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <BookOpen size={16} /> Flashcardlar
                        </button>
                        <button
                          onClick={() => openVocabModalForUnit(u, 'quiz')}
                          className="btn-big-blue"
                          style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Trophy size={16} /> Testdan o'tish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ======================================================== */}
      {/* 5. FIXED BOTTOM NAVIGATION BAR                           */}
      {/* ======================================================== */}
      <BottomNav
        role="student"
        activeTab={mainTab}
        onChangeTab={(tabId) => {
          if (tabId === 'movies') {
            setMainTab('movies');
            loadMovies();
          } else if (tabId === 'vocabulary') {
            setMainTab('vocabulary');
            loadBooks();
          } else {
            setMainTab('homework');
          }
        }}
      />

      {/* ======================================================== */}
      {/* 6. FIRST-TIME ONBOARDING MODAL                           */}
      {/* ======================================================== */}
      {showOnboardingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{
            background: 'var(--pure-white)',
            borderRadius: 'var(--radius-modal)',
            padding: '36px 24px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '9999px',
              background: 'var(--ice-blue-bg)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '2px solid var(--sky-border)',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.2)'
            }}>
              <Sparkles size={40} />
            </div>

            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
              Xush kelibsiz!
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, marginBottom: '28px' }}>
              Guruhlaringiz va topshiriqlaringiz Mini App'da avtomatik paydo bo'lishi uchun avval botimizga <b>/start</b> bosing.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href="https://t.me/lanswitchbot"
                target="_blank"
                rel="noreferrer"
                className="btn-big-blue"
                style={{ width: '100%', minHeight: '56px', fontSize: '16px' }}
              >
                <Send size={20} />
                <span>🚀 BOTGA START BOSISH</span>
              </a>

              <button
                onClick={async () => {
                  setShowOnboardingModal(false);
                  await loadInitialData();
                }}
                className="btn-big-white"
                style={{ width: '100%', minHeight: '50px', fontSize: '15px' }}
              >
                <span>✅ Start bosdim, qayta tekshirish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. GROUP SELECTION BOTTOM SHEET / DRAWER                 */}
      {/* ======================================================== */}
      {showGroupDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 80,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}
        onClick={() => setShowGroupDrawer(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--pure-white)',
              width: '100%',
              maxWidth: '640px',
              borderTopLeftRadius: 'var(--radius-modal)',
              borderTopRightRadius: 'var(--radius-modal)',
              padding: '24px 20px 40px 20px',
              boxShadow: 'var(--shadow-modal)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div style={{
              width: '44px',
              height: '5px',
              borderRadius: '9999px',
              background: 'var(--sky-border)',
              margin: '0 auto 20px'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)' }}>
                Mening Guruhlarim
              </div>
              <button
                onClick={() => setShowGroupDrawer(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {groups.map(g => {
                const isSelected = selectedGroup?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleSelectGroup(g)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-card-sm)',
                      border: isSelected ? '2px solid var(--primary-blue)' : '1.5px solid var(--sky-border)',
                      background: isSelected ? 'var(--ice-blue-bg)' : 'var(--pure-white)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-navy)' }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Telegram ID: {g.telegramChatId}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '9999px',
                        background: 'var(--primary-blue)',
                        color: 'var(--pure-white)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Check size={18} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. VOCABULARY FLASHCARDS & 4-OPTION RANDOM QUIZ MODAL    */}
      {/* ======================================================== */}
      {vocabModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--pure-white)',
            width: '100%',
            maxWidth: '480px',
            borderRadius: 'var(--radius-modal)',
            boxShadow: 'var(--shadow-modal)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92vh'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1.5px solid var(--sky-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-navy)' }}>
                  {currentVocabTitle}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {currentVocabSubTitle}
                </div>
              </div>
              <button
                onClick={() => setVocabModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              padding: '8px 16px',
              background: 'var(--ice-blue-bg)',
              gap: '8px'
            }}>
              <button
                onClick={() => setVocabMode('flashcards')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: vocabMode === 'flashcards' ? 'var(--primary-blue)' : 'transparent',
                  color: vocabMode === 'flashcards' ? 'var(--pure-white)' : 'var(--text-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <BookOpen size={16} /> Flashcardlar
              </button>
              <button
                onClick={() => setVocabMode('quiz')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: vocabMode === 'quiz' ? 'var(--primary-blue)' : 'transparent',
                  color: vocabMode === 'quiz' ? 'var(--pure-white)' : 'var(--text-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Trophy size={16} /> Interaktiv Test
              </button>
            </div>

            {/* FLASHCARDS */}
            {vocabMode === 'flashcards' && words.length > 0 && (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{
                    height: '280px',
                    perspective: '1000px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'none'
                  }}>
                    {/* Front Face (English) */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      background: 'var(--pure-white)',
                      border: '2px solid var(--sky-border)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        background: 'var(--ice-blue-bg)',
                        color: 'var(--primary-blue)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        fontWeight: 800,
                        marginBottom: '14px'
                      }}>
                        {words[currentWordIdx].partOfSpeech?.toUpperCase() || 'SO\'Z'}
                      </span>

                      <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary-blue)', marginBottom: '8px' }}>
                        {words[currentWordIdx].word}
                      </div>

                      {words[currentWordIdx].ipa && (
                        <div style={{ fontSize: '17px', color: 'var(--text-muted)', marginBottom: '16px', fontStyle: 'italic' }}>
                          {words[currentWordIdx].ipa}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playPronunciation(words[currentWordIdx].word);
                        }}
                        style={{
                          background: 'var(--ice-blue-bg)',
                          border: '2px solid var(--sky-border)',
                          color: 'var(--primary-blue)',
                          width: '50px',
                          height: '50px',
                          borderRadius: '9999px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Volume2 size={24} />
                      </button>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
                        👉 Tarjimasini ko'rish uchun kartaga bosing
                      </div>
                    </div>

                    {/* Back Face (Uzbek Translation) */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      background: 'var(--ice-blue-bg)',
                      border: '2px solid var(--primary-blue)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-blue)', marginBottom: '6px' }}>
                        O'ZBEKCHA MA'NOSI:
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '16px' }}>
                        {words[currentWordIdx].translationUz}
                      </div>

                      {words[currentWordIdx].exampleSentence && (
                        <div style={{
                          background: 'var(--pure-white)',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          fontSize: '13px',
                          color: 'var(--text-navy-secondary)',
                          lineHeight: 1.4,
                          border: '1px solid var(--sky-border)'
                        }}>
                          💬 "{words[currentWordIdx].exampleSentence}"
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: 'var(--primary-blue)', marginTop: '16px', fontWeight: 700 }}>
                        🔄 Inglizcha ko'rinishga qaytish uchun bosing
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <button
                    disabled={currentWordIdx === 0}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentWordIdx(prev => Math.max(0, prev - 1));
                    }}
                    className="btn-big-white"
                    style={{ flex: 1, minHeight: '50px', opacity: currentWordIdx === 0 ? 0.4 : 1 }}
                  >
                    <ChevronLeft size={20} />
                    <span>Oldingi</span>
                  </button>

                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)' }}>
                    {currentWordIdx + 1} / {words.length}
                  </div>

                  <button
                    disabled={currentWordIdx === words.length - 1}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentWordIdx(prev => Math.min(words.length - 1, prev + 1));
                    }}
                    className="btn-big-blue"
                    style={{ flex: 1, minHeight: '50px', opacity: currentWordIdx === words.length - 1 ? 0.4 : 1 }}
                  >
                    <span>Keyingi</span>
                    <ChevronRight size={20} />
                  </button>
                </div>

                <button
                  onClick={() => setVocabMode('quiz')}
                  className="btn-big-white"
                  style={{ width: '100%', minHeight: '52px', borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}
                >
                  <Trophy size={18} />
                  <span>Bilimni tekshirish (Testdan o'tish)</span>
                </button>
              </div>
            )}

            {/* 4-OPTION RANDOMIZED QUIZ */}
            {vocabMode === 'quiz' && (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                {!quizFinished ? (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, marginBottom: '6px' }}>
                        <span>Savol {quizIdx + 1} / {quizQuestions.length}</span>
                        <span style={{ color: 'var(--primary-blue)' }}>To'plangan ball: {quizScore}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--ice-blue-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${((quizIdx + 1) / (quizQuestions.length || 1)) * 100}%`,
                          height: '100%',
                          background: 'var(--primary-blue)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {quizQuestions[quizIdx] && (
                      <div style={{
                        background: 'var(--ice-blue-bg)',
                        border: '2px solid var(--sky-border)',
                        borderRadius: 'var(--radius-card-sm)',
                        padding: '24px 20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          {quizQuestions[quizIdx].direction === 'EN_TO_UZ' ? '🇺🇸 Inglizcha ➔ 🇺🇿 O\'zbekcha' : '🇺🇿 O\'zbekcha ➔ 🇺🇸 Inglizcha'}
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px' }}>
                          {quizQuestions[quizIdx].questionText}
                        </div>
                        {quizQuestions[quizIdx].ipa && (
                          <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                            {quizQuestions[quizIdx].ipa}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {quizQuestions[quizIdx]?.options.map((opt, optIdx) => {
                        let btnStyle: CSSProperties = {
                          minHeight: '56px',
                          borderRadius: 'var(--radius-pill)',
                          border: '2px solid var(--sky-border)',
                          background: 'var(--pure-white)',
                          color: 'var(--text-navy)',
                          fontSize: '16px',
                          fontWeight: 700,
                          padding: '0 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        };

                        if (selectedOption !== null) {
                          if (opt.isCorrect) {
                            btnStyle.background = 'var(--status-success-bg)';
                            btnStyle.borderColor = 'var(--status-success)';
                            btnStyle.color = 'var(--status-success)';
                          } else if (selectedOption === optIdx && !opt.isCorrect) {
                            btnStyle.background = 'var(--status-danger-bg)';
                            btnStyle.borderColor = 'var(--status-danger)';
                            btnStyle.color = 'var(--status-danger)';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            disabled={selectedOption !== null}
                            onClick={() => handleQuizAnswer(optIdx, opt.isCorrect)}
                            style={btnStyle}
                          >
                            <span>{['A)', 'B)', 'C)', 'D)'][optIdx]} {opt.text}</span>
                            {selectedOption !== null && opt.isCorrect && (
                              <CheckCircle2 size={20} color="var(--status-success)" />
                            )}
                            {selectedOption === optIdx && !opt.isCorrect && (
                              <XCircle size={20} color="var(--status-danger)" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '9999px',
                      background: (quizScore / quizQuestions.length) >= 0.7 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                      color: (quizScore / quizQuestions.length) >= 0.7 ? 'var(--status-success)' : 'var(--status-danger)',
                      border: `2px solid ${(quizScore / quizQuestions.length) >= 0.7 ? 'var(--status-success-border)' : 'var(--status-danger-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      fontSize: '36px'
                    }}>
                      {(quizScore / quizQuestions.length) >= 0.7 ? '🏆' : '⚠️'}
                    </div>

                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
                      {(quizScore / quizQuestions.length) >= 0.7 ? 'Tabriklaymiz!' : 'Qayta urinib ko\'ring!'}
                    </div>

                    <div style={{ fontSize: '15px', color: 'var(--text-navy-secondary)', marginBottom: '24px' }}>
                      Siz <b>{quizQuestions.length}</b> tadan <b>{quizScore}</b> tasiga to'g'ri javob berdingiz ({Math.round((quizScore / (quizQuestions.length || 1)) * 100)}%).
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        onClick={() => {
                          setQuizIdx(0);
                          setQuizScore(0);
                          setQuizFinished(false);
                          setSelectedOption(null);
                        }}
                        className="btn-big-white"
                        style={{ width: '100%', minHeight: '52px' }}
                      >
                        <RefreshCw size={18} />
                        <span>Testni qayta ishlash</span>
                      </button>

                      <button
                        onClick={() => setVocabModalOpen(false)}
                        className="btn-big-blue"
                        style={{ width: '100%', minHeight: '52px' }}
                      >
                        <span>Tushunarli, yakunlash</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. JAZOLAR TARIXI MODAL (FULL PENALTY HISTORY)           */}
      {/* ======================================================== */}
      {showPenaltyHistoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ice-blue-bg)' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)' }}>📜 Jazolar Tarixi</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Barcha qo'llanilgan jazolar va ularning yakuniy holati</div>
              </div>
              <button
                onClick={() => setShowPenaltyHistoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 800, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {penaltyHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)' }}>Jazolar tarixi toza!</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>Sizga hech qachon jarima qo'llanilmagan.</div>
                </div>
              ) : (
                penaltyHistory.map((h, idx) => {
                  const isServed = h.item.mySubmissionStatus === 2;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isServed ? '#FFFBEB' : '#FEF2F2',
                        border: isServed ? '1.5px solid #FCD34D' : '1.5px solid #FCA5A5',
                        borderRadius: '14px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-navy)' }}>
                          📅 {h.assignment.title}
                        </span>
                        {isServed ? (
                          <span style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: 800 }}>
                            ⚠️ Jazoni bajardi (Punished)
                          </span>
                        ) : (
                          <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: 800 }}>
                            ❌ Faol Jarima (Punishment)
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                        📌 Qism: {h.item.title}
                      </div>

                      {h.item.mySubmissionComment && (
                        <div style={{ fontSize: '13px', color: isServed ? '#92400E' : '#991B1B', fontStyle: 'italic', background: '#fff', padding: '8px 10px', borderRadius: '8px' }}>
                          💬 Jazo izohi: "{h.item.mySubmissionComment}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
