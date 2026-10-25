import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { api, openTelegramBotChat } from '../utils/api';
import { autoFullscreenOnDesktop, toggleAppFullscreen, showTelegramBackButton, hideTelegramBackButton } from '../utils/telegram';
import type { 
  StudentGroup, AssignmentDetail, AssignmentItemDetail, 
  BookWord, QuizQuestion, Book, BookPart, BookUnit 
} from '../utils/api';
import { 
  BookOpen, CheckCircle2, XCircle, AlertTriangle, 
  Send, ChevronLeft, ChevronRight, Volume2, Sparkles, 
  Clock, Trophy, X, Check, RefreshCw, Film, Library, Play, Search, ArrowLeft,
  Trash2, ExternalLink, ChevronDown, Users, Maximize2, Minimize2, GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from '../components/ProfileDropdown';
import BottomNav from '../components/BottomNav';
import SubscriptionPlansModal from '../components/SubscriptionPlansModal';

export default function StudentMiniAppPage() {
  const { user: authUser, hasSubscription, checkSubscription, setRole, canClaimBonus, bonusAmount, minAmount } = useAuth();
  const navigate = useNavigate();

  // Navigation: 3 Core Panels
  const [mainTab, setMainTab] = useState<'homework' | 'movies' | 'vocabulary'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'movies' || tabParam === 'vocabulary' || tabParam === 'homework') {
        return tabParam;
      }
    } catch {}
    const saved = localStorage.getItem('lanswitch_student_main_tab');
    return (saved === 'movies' || saved === 'vocabulary' || saved === 'homework') ? saved : 'homework';
  });

  // Homework 4 Core Sub-Tabs: 'all' | 'todo' | 'penalties' | 'completed'
  const [homeworkSubTab, setHomeworkSubTab] = useState<'all' | 'todo' | 'penalties' | 'completed'>('all');
  const [showPenaltyHistoryModal, setShowPenaltyHistoryModal] = useState(false);

  // Student ID
  const [studentId, setStudentId] = useState<number>(authUser?.id || 1);
  const initialLoadedRef = useRef(false);
  
  // Student state (Homework)
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preparingUploadItemId, setPreparingUploadItemId] = useState<number | null>(null);
  const [sendingAttId, setSendingAttId] = useState<number | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: 'photo' | 'video' | 'audio';
    title?: string;
    attachmentId?: number;
  } | null>(null);

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
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('open_plans') === '1' || p.get('open_plans') === 'true';
    } catch {
      return false;
    }
  });

  // Vocabulary Hierarchy State (Book -> BookPart -> PartUnit -> UnitWord)
  const [vocabStep, setVocabStep] = useState<'books' | 'parts' | 'units'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [parts, setParts] = useState<BookPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<BookPart | null>(null);
  const [units, setUnits] = useState<BookUnit[]>([]);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Telegram WebApp & Fullscreen State
  useEffect(() => {
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;
    const platform = (tg?.platform || '').toLowerCase();
    const isMobile = ['android', 'ios'].includes(platform) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    const updateFsState = () => {
      if (isMobile) {
        setIsFullscreen(Boolean(tg?.isFullscreen));
      } else {
        const isDomFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
        setIsFullscreen(isDomFs);
      }
    };

    if (tg) {
      try {
        tg.ready?.();
        tg.expand?.();
        autoFullscreenOnDesktop();
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor('#1D4ED8');
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor('#EFF6FF');
        }

        // Listen for Telegram WebApp fullscreen change events (Bot API 8.0+)
        if (typeof tg.onEvent === 'function') {
          tg.onEvent('fullscreenChanged', updateFsState);
          tg.onEvent('fullscreenFailed', () => {
            tg.expand?.();
            updateFsState();
          });
        }
      } catch (e) {
        console.warn('Telegram WebApp SDK error:', e);
      }
    }

    const handleFsChange = () => {
      updateFsState();
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    // Initial check
    updateFsState();

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      if (tg && typeof tg.offEvent === 'function') {
        try {
          tg.offEvent('fullscreenChanged', updateFsState);
        } catch {}
      }
    };
  }, []);

  const toggleFullscreen = () => {
    toggleAppFullscreen(isFullscreen, setIsFullscreen);
  };

  // Telegram Native BackButton synchronization
  useEffect(() => {
    if (previewMedia) {
      showTelegramBackButton(() => setPreviewMedia(null));
    } else if (vocabModalOpen) {
      showTelegramBackButton(() => setVocabModalOpen(false));
    } else if (showGroupDrawer) {
      showTelegramBackButton(() => setShowGroupDrawer(false));
    } else if (showPenaltyHistoryModal) {
      showTelegramBackButton(() => setShowPenaltyHistoryModal(false));
    } else if (mainTab === 'vocabulary' && vocabStep === 'units') {
      showTelegramBackButton(() => setVocabStep('parts'));
    } else if (mainTab === 'vocabulary' && vocabStep === 'parts') {
      showTelegramBackButton(() => setVocabStep('books'));
    } else if (mainTab !== 'homework') {
      showTelegramBackButton(() => setMainTab('homework'));
    } else {
      hideTelegramBackButton();
    }

    return () => {
      hideTelegramBackButton();
    };
  }, [previewMedia, vocabModalOpen, showGroupDrawer, showPenaltyHistoryModal, mainTab, vocabStep]);

  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadInitialData();
    }
  }, [authUser?.id]);

  useEffect(() => {
    localStorage.setItem('lanswitch_last_route', '/student');
  }, []);

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
      setShowOnboardingModal(false);
      setSelectedGroup(null);
      setAssignments([]);
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
    await loadAssignments(g.id, 'All', studentId);
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
  const handleOpenBotForMedia = async (itemId: number) => {
    if (preparingUploadItemId === itemId) return;
    setPreparingUploadItemId(itemId);

    try {
      const res = await api.prepareMediaUpload(itemId, studentId);
      if (!res.success) {
        alert(res.message || "Xatolik yuz berdi. Iltimos botni bloklamaganingizni tekshiring.");
        setPreparingUploadItemId(null);
        return;
      }

      openTelegramBotChat(res.botUsername || 'lanswitchbot');
    } catch (err: any) {
      alert("Xatolik: " + (err?.message || "Fayl yuklashni boshlab bo'lmadi"));
    } finally {
      setPreparingUploadItemId(null);
    }
  };

  // Send media attachment directly to Telegram bot chat
  const handleSendAttachmentToBot = async (attachmentId: number) => {
    if (sendingAttId === attachmentId) return;
    setSendingAttId(attachmentId);

    try {
      const res = await api.sendAttachmentToBot(attachmentId, studentId);
      if (!res.success) {
        alert(res.message || "Xatolik: Faylni Telegram botga yuborib bo'lmadi.");
        setSendingAttId(null);
        return;
      }

      openTelegramBotChat(res.botUsername || 'lanswitchbot');
    } catch (err: any) {
      alert("Xatolik: " + (err?.message || "Faylni botga yuborib bo'lmadi"));
    } finally {
      setSendingAttId(null);
    }
  };

  // Delete media attachment
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm("Rostdan ham ushbu faylni o'chirmoqchimisiz?")) return;
    try {
      await api.deleteAttachment(attachmentId);
      if (selectedGroup) {
        await loadAssignments(selectedGroup.id, 'All', studentId);
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

  // 2. Completed items / assignments:
  const completedAssignments = useMemo(() => {
    return assignments.filter(a => {
      return a.items.some(it => it.mySubmissionStatus === 1 || it.mySubmissionStatus === 2);
    });
  }, [assignments]);

  const completedItemsCount = useMemo(() => {
    return assignments.reduce((acc, a) => {
      return acc + a.items.filter(it => it.mySubmissionStatus === 1 || it.mySubmissionStatus === 2).length;
    }, 0);
  }, [assignments]);

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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <audio
                          controls
                          src={att.streamUrl}
                          style={{ width: '100%', height: '40px', borderRadius: '8px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSendAttachmentToBot(att.id)}
                          disabled={sendingAttId === att.id}
                          style={{
                            background: 'var(--ice-blue-bg)',
                            border: '1px solid var(--sky-border)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--primary-blue)',
                            cursor: sendingAttId === att.id ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            opacity: sendingAttId === att.id ? 0.7 : 1
                          }}
                        >
                          {sendingAttId === att.id ? (
                            <>
                              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              <span>Botga yuborilmoqda...</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink size={14} />
                              <span>Telegram botda eshitish</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {att.fileType === 'photo' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div
                          onClick={() => setPreviewMedia({ url: att.streamUrl || '', type: 'photo', title: item.title, attachmentId: att.id })}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid var(--sky-border)',
                            background: '#F8FAFC'
                          }}
                        >
                          <img
                            src={att.streamUrl}
                            alt="Yuklangan rasm"
                            style={{
                              width: '100%',
                              maxHeight: '220px',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            right: '8px',
                            bottom: '8px',
                            background: 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(4px)',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Maximize2 size={12} />
                            <span>Katta ko'rish</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewMedia({ url: att.streamUrl || '', type: 'photo', title: item.title, attachmentId: att.id })}
                            style={{
                              flex: 1,
                              background: '#F8FAFC',
                              border: '1px solid var(--sky-border)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--text-navy)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <Maximize2 size={13} />
                            <span>Katta rasm</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendAttachmentToBot(att.id)}
                            disabled={sendingAttId === att.id}
                            style={{
                              flex: 1,
                              background: 'var(--ice-blue-bg)',
                              border: '1px solid var(--sky-border)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--primary-blue)',
                              cursor: sendingAttId === att.id ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              opacity: sendingAttId === att.id ? 0.7 : 1
                            }}
                          >
                            {sendingAttId === att.id ? (
                              <>
                                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                <span>Yuborilmoqda...</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink size={13} />
                                <span>Telegramda ko'rish</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {att.fileType === 'video' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000' }}>
                          <video
                            controls
                            playsInline
                            src={att.streamUrl}
                            style={{ width: '100%', maxHeight: '240px', display: 'block' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewMedia({ url: att.streamUrl || '', type: 'video', title: item.title, attachmentId: att.id })}
                            style={{
                              flex: 1,
                              background: '#F8FAFC',
                              border: '1px solid var(--sky-border)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--text-navy)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <Maximize2 size={13} />
                            <span>Katta ekranda</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendAttachmentToBot(att.id)}
                            disabled={sendingAttId === att.id}
                            style={{
                              flex: 1,
                              background: 'var(--ice-blue-bg)',
                              border: '1px solid var(--sky-border)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--primary-blue)',
                              cursor: sendingAttId === att.id ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              opacity: sendingAttId === att.id ? 0.7 : 1
                            }}
                          >
                            {sendingAttId === att.id ? (
                              <>
                                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                <span>Botga yuborilmoqda...</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink size={13} />
                                <span>Telegramda ko'rish</span>
                              </>
                            )}
                          </button>
                        </div>
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
                disabled={preparingUploadItemId === item.id}
                className="btn-big-blue"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  fontSize: '15px',
                  background: isCompleted ? 'var(--ice-blue-bg)' : 'var(--primary-blue)',
                  color: isCompleted ? 'var(--primary-blue)' : 'var(--pure-white)',
                  border: isCompleted ? '2px solid var(--primary-blue)' : 'none',
                  opacity: preparingUploadItemId === item.id ? 0.7 : 1,
                  cursor: preparingUploadItemId === item.id ? 'wait' : 'pointer'
                }}
              >
                {preparingUploadItemId === item.id ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Botga xabar yuborilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>{item.attachments && item.attachments.length > 0 ? 'QAYTA FAYL YUKLASH (BOT)' : 'VIDEO / AUDIO YUKLASH (BOT)'}</span>
                  </>
                )}
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
      width: '100%',
      maxWidth: '640px',
      margin: '0 auto',
      boxSizing: 'border-box',
      background: 'var(--ice-blue-bg)',
      color: 'var(--text-navy)',
      fontFamily: 'var(--font-main)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingBottom: 'calc(110px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))'
    }}>

      {/* ======================================================== */}
      {/* 1. TOP HEADER                                            */}
      {/* ======================================================== */}
      <header className="app-topbar" style={{
        background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        paddingTop: 'calc(14px + var(--safe-area-top, env(safe-area-inset-top, 0px)))',
        paddingBottom: '14px',
        paddingLeft: 'calc(16px + var(--safe-area-left, env(safe-area-inset-left, 0px)))',
        paddingRight: 'calc(16px + var(--safe-area-right, env(safe-area-inset-right, 0px)))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.2)'
      }}>
        {/* Left: Group Switcher or Section Title */}
        {mainTab === 'homework' ? (
          <button
            onClick={() => setShowGroupDrawer(true)}
            title={selectedGroup ? selectedGroup.title : 'Guruhni tanlang'}
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1.5px solid rgba(255, 255, 255, 0.28)',
              color: '#FFFFFF',
              borderRadius: '16px',
              padding: '6px 12px 6px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
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
              background: '#FFFFFF',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
            }}>
              <Users size={16} strokeWidth={2.5} />
            </div>
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.85)', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>
                Guruh
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: 900,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
                lineHeight: 1.2
              }}>
                {selectedGroup ? selectedGroup.title : (groups.length === 0 ? 'Mustaqil rejim' : 'Guruhni tanlang')}
              </div>
            </div>
            <ChevronDown size={14} color="#FFFFFF" style={{ flexShrink: 0, opacity: 0.9 }} />
          </button>
        ) : mainTab === 'movies' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={22} color="#FFFFFF" />
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF' }}>Kinolar</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Library size={22} color="#FFFFFF" />
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF' }}>Lug'atlarim</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran (Full screen)"}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1.5px solid rgba(255, 255, 255, 0.28)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* User Profile Dropdown with DB Role Switcher */}
          <ProfileDropdown onNavigateTab={(t) => setMainTab(t as any)} variant="student" />
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. TAB CONTENT: UYGA VAZIFALAR (HOMEWORK)                */}
      {/* ======================================================== */}
      {mainTab === 'homework' && (
        groups.length === 0 ? (
          <main style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'var(--pure-white)',
              borderRadius: 'var(--radius-card)',
              border: '2px solid var(--sky-border)',
              boxShadow: 'var(--shadow-card)',
              padding: '32px 20px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'var(--ice-blue-bg)',
                color: 'var(--primary-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '2px solid var(--sky-border)'
              }}>
                <GraduationCap size={36} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
                Hali guruhga qo'shilmagansiz
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Siz hozir <b>Mustaqil ta'lim</b> rejimidasiz. O'zingiz mustaqil o'rganishingiz yoki topshiriqlarni ko'rish uchun quyidagilardan foydalanishingiz mumkin:
              </p>

              {/* BONUS BANNER FOR NEW USERS */}
              {canClaimBonus && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
                  border: '1.5px solid #10B981',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
                    <span style={{ fontSize: '28px' }}>🎁</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{bonusAmount.toLocaleString('uz-UZ')} so'm Boshlang'ich Bonus!</span>
                        <span style={{ background: '#10B981', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>BEPUL</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px', lineHeight: 1.4 }}>
                        Tariflardan birini tanlang va {bonusAmount.toLocaleString('uz-UZ')} so'm bonus bilan boshlang!
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSubscriptionModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                      flexShrink: 0
                    }}
                  >
                    🚀 Tarifni tanlash
                  </button>
                </div>
              )}

              {/* CARD 1: O'QUVCHI UCHUN */}
              <div style={{
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                borderRadius: '16px',
                padding: '18px 16px',
                textAlign: 'left',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '18px' }}>🎓</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-navy)' }}>O'quvchi / Talaba bo'lsangiz:</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Agar topshiriqlar ko'rinmayotgan bo'lsa, <b>ustozingizga murojaat qiling</b> — ular sizni dars guruhiga qo'shishi bilanoq barcha uyga vazifalar bu yerda avtomatik ko'rinadi!
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMainTab('movies');
                      loadMovies();
                    }}
                    className="btn-big-blue"
                    style={{ flex: 1, minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Film size={16} />
                    <span>🎬 Kinolarni ko'rish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMainTab('vocabulary');
                      loadBooks();
                    }}
                    className="btn-big-white"
                    style={{ flex: 1, minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <BookOpen size={16} />
                    <span>📖 Lug'at yodlash</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: O'QITUVCHI UCHUN */}
              <div style={{
                background: '#EFF6FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: '16px',
                padding: '18px 16px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '18px' }}>👨‍🏫</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#1E40AF' }}>O'qituvchi / Repetitor bo'lsangiz:</span>
                </div>
                <p style={{ fontSize: '13px', color: '#1E3A8A', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Dars o'tadigan, ya'ni talabalaringiz mavjud bo'lgan Telegram guruhingizga <b>@lanswitchbot</b> ni qo'shing va <b>Administrator</b> qiling.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setRole('Teacher');
                      } catch (e) {
                        console.warn(e);
                      }
                      localStorage.setItem('lanswitch_last_route', '/teacher');
                      const search = window.location.search || '';
                      navigate(`/teacher${search}`);
                    }}
                    className="btn-big-blue"
                    style={{ width: '100%', minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)' }}
                  >
                    <span>👨‍🏫 O'qituvchi bo'limiga o'tish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTelegramBotChat('lanswitchbot')}
                    className="btn-big-white"
                    style={{ width: '100%', minHeight: '40px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Send size={15} />
                    <span>➕ Botni guruhga qo'shish</span>
                  </button>
                </div>
              </div>

            </div>
          </main>
        ) : (
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
              { key: 'all', label: `Barchasi (${assignments.length})`, bg: '#F1F5F9', activeBg: 'var(--primary-blue)', color: 'var(--text-navy)', activeColor: '#fff' },
              { key: 'todo', label: `📌 Bajarilishi kerak (${todoItemsCount})`, bg: '#EFF6FF', activeBg: 'var(--primary-blue)', color: 'var(--primary-blue)', activeColor: '#fff' },
              { key: 'penalties', label: `❌ Jarimalar (${activePenaltiesCount})`, bg: '#FEF2F2', activeBg: '#DC2626', color: '#B91C1C', activeColor: '#fff' },
              { key: 'completed', label: `✅ Bajarilganlar (${completedItemsCount})`, bg: '#F0FDF4', activeBg: '#16A34A', color: '#15803D', activeColor: '#fff' },
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
            {/* Red Warning Banner if Teacher Subscription is Expired */}
            {selectedGroup?.isTeacherSubscriptionExpired && (
              <div style={{
                background: '#FEF2F2',
                border: '1.5px solid #FCA5A5',
                borderRadius: '16px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '24px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: '14px' }}>
                    Ustoz tarifi muddati tugagan
                  </div>
                  <div style={{ color: '#DC2626', fontSize: '12.5px', marginTop: '2px', lineHeight: 1.4 }}>
                    Ustozingizning obuna tarifi tugaganligi sababli ushbu guruhdagi topshiriqlar talabalar uchun vaqtincha ko'rinmaydi.
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ 
                  width: '40px', height: '40px', border: '4px solid var(--sky-border)', 
                  borderTopColor: 'var(--primary-blue)', borderRadius: '50%', margin: '0 auto 16px',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{ fontWeight: 700 }}>Vazifalar yuklanmoqda...</div>
              </div>
            ) : homeworkSubTab === 'all' ? (
              /* TAB 1: BARCHASI (ALL ASSIGNMENTS) - NO SECONDARY FILTERS */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {assignments.length === 0 ? (
                  <div style={{
                    background: 'var(--pure-white)',
                    borderRadius: 'var(--radius-card)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    border: '2px dashed var(--sky-border)',
                    marginTop: '10px'
                  }}>
                    <div style={{ fontSize: '42px', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '6px' }}>
                      Vazifalar mavjud emas
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      {selectedGroup?.isTeacherSubscriptionExpired 
                        ? "Ustozingizning obuna tarifi muddati tugaganligi sababli ushbu guruh topshiriqlari vaqtincha ko'rinmaydi."
                        : "Ushbu guruh uchun e'lon qilingan topshiriqlar mavjud emas."}
                    </div>
                  </div>
                ) : (
                  assignments.map(assignment => (
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
            ) : homeworkSubTab === 'todo' ? (
              /* TAB 2: BAJARILISHI KERAK */
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
              /* TAB 4: BAJARILGANLAR */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {completedAssignments.length === 0 ? (
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
                      Bajarilgan vazifalar hali yo'q
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      Topshiriqlarni bajarib topshirganingizdan so'ng, ular bu yerda ko'rinadi.
                    </div>
                  </div>
                ) : (
                  completedAssignments.map(assignment => {
                    const completedItems = assignment.items.filter(it => it.mySubmissionStatus === 1 || it.mySubmissionStatus === 2);
                    if (completedItems.length === 0) return null;

                    return (
                      <div
                        key={assignment.id}
                        style={{
                          background: 'var(--pure-white)',
                          borderRadius: 'var(--radius-card)',
                          border: '2px solid #BBF7D0',
                          boxShadow: 'var(--shadow-card)',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{
                          background: 'linear-gradient(135deg, #15803D 0%, #16A34A 100%)',
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
                            ✅ {completedItems.length} ta bajarildi • {assignment.items.length} ta qism
                          </span>
                        </div>

                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {completedItems.map((item, idx) => renderAssignmentItem(item, idx, assignment))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </main>
        </>
        )
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

          {/* Student Premium Info Banner (Only for non-premium users) */}
          {!hasSubscription && (
            <div style={{
              background: canClaimBonus
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.16) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.14) 100%)',
              border: canClaimBonus ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid rgba(245, 158, 11, 0.5)',
              borderRadius: '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: 1 }}>
                <span style={{ fontSize: '28px' }}>{canClaimBonus ? '🎁' : '⚠️'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {canClaimBonus ? (
                      <>
                        <span>Student Premium — {bonusAmount.toLocaleString('uz-UZ')} so'm Boshlang'ich Bonus!</span>
                        <span style={{ background: '#10B981', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>BEPUL</span>
                      </>
                    ) : (
                      <span style={{ color: '#b45309' }}>Tarif muddati tugagan — Kinolarni tomosha qilishda davom eting!</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {canClaimBonus ? (
                      `Yangi foydalanuvchilar uchun ${bonusAmount.toLocaleString('uz-UZ')} so'm bepul bonus mavjud! Bonusni oling va kinolarni bepul tomosha qiling.`
                    ) : (
                      `Kinolarni ko'rish va AI yordamchidan foydalanish uchun balansingizni minimal ${minAmount.toLocaleString('uz-UZ')}+ so'mga to'ldiring. Mablag'ingiz daqiqasigacha tejaladi!`
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {canClaimBonus ? (
                  <button
                    onClick={() => setIsSubscriptionModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    🚀 Tarifni tanlash & Boshlash
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSubscriptionModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    💳 Balansni to'ldirish ({minAmount.toLocaleString('uz-UZ')}+)
                  </button>
                )}
                <button
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0
                  }}
                >
                  👑 Obuna & Balans
                </button>
              </div>
            </div>
          )}

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
                  onClick={() => navigate(`/player/${movie.id}`)}
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

                    {!hasSubscription && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                        <span style={{
                          background: canClaimBonus
                            ? 'linear-gradient(135deg, #10B981, #059669)' 
                            : 'linear-gradient(135deg, #F59E0B, #D97706)',
                          color: canClaimBonus ? '#fff' : '#000',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 900,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          {canClaimBonus ? `🎁 ${bonusAmount.toLocaleString('uz-UZ')} bonus` : '👑 Premium'}
                        </span>
                      </div>
                    )}

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
            border: '2px solid var(--sky-border)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowOnboardingModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={18} />
            </button>

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
            <div style={{ fontSize: '15px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
              Guruhlaringiz va topshiriqlaringiz avtomatik paydo bo'lishi uchun Telegram botimizga <b>/start</b> bosing yoki mustaqil ta'limdan foydalaning.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => openTelegramBotChat('lanswitchbot')}
                className="btn-big-blue"
                style={{ width: '100%', minHeight: '52px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Send size={18} />
                <span>🚀 BOTGA START BOSISH</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowOnboardingModal(false);
                  setMainTab('movies');
                  loadMovies();
                }}
                className="btn-big-white"
                style={{ width: '100%', minHeight: '46px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Film size={16} />
                <span>🎬 Mustaqil rejimda davom etish</span>
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
              paddingTop: '24px',
              paddingLeft: 'calc(20px + var(--safe-area-left, env(safe-area-inset-left, 0px)))',
              paddingRight: 'calc(20px + var(--safe-area-right, env(safe-area-inset-right, 0px)))',
              paddingBottom: 'calc(28px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
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
              {groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px', fontSize: '16px' }}>
                    Guruhlar mavjud emas
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    Siz hali birorta dars guruhiga a'zo emassiz. Ustozingiz sizni guruhga qo'shgach bu yerda paydo bo'ladi.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGroupDrawer(false);
                        setMainTab('movies');
                        loadMovies();
                      }}
                      className="btn-big-blue"
                      style={{ width: '100%', minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Film size={16} />
                      <span>🎬 Kinolarni ko'rish</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowGroupDrawer(false);
                        try {
                          await setRole('Teacher');
                        } catch (e) {
                          console.warn(e);
                        }
                        localStorage.setItem('lanswitch_last_route', '/teacher');
                        const search = window.location.search || '';
                        navigate(`/teacher${search}`);
                      }}
                      className="btn-big-white"
                      style={{ width: '100%', minHeight: '42px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <span>👨‍🏫 O'qituvchi bo'limiga o'tish</span>
                    </button>
                  </div>
                </div>
              ) : (
                groups.map(g => {
                  const isSelected = selectedGroup?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGroup(g)}
                      style={{
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-card-sm)',
                        border: g.isTeacherSubscriptionExpired
                          ? '1.5px solid #FCA5A5'
                          : isSelected
                          ? '2px solid var(--primary-blue)'
                          : '1.5px solid var(--sky-border)',
                        background: g.isTeacherSubscriptionExpired
                          ? '#FEF2F2'
                          : isSelected
                          ? 'var(--ice-blue-bg)'
                          : 'var(--pure-white)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        {g.isTeacherSubscriptionExpired && (
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#DC2626',
                            background: '#FEE2E2',
                            border: '1px solid #FECACA',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '4px'
                          }}>
                            <span>⚠️ Ustoz tarifi tugagan (Topshiriqlar ko'rinmaydi)</span>
                          </div>
                        )}
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
                })
              )}
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

      {/* ======================================================== */}
      {/* FULLSCREEN / LIGHTBOX MEDIA PREVIEW MODAL                */}
      {/* ======================================================== */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 15, 29, 0.94)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Top Bar inside Lightbox */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              padding: '0 4px'
            }}
          >
            <div style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {previewMedia.title || "Media ko'rish"}
            </div>
            <button
              onClick={() => setPreviewMedia(null)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Media Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '75vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#000',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            {previewMedia.type === 'photo' && (
              <img
                src={previewMedia.url}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            )}
            {previewMedia.type === 'video' && (
              <video
                controls
                autoPlay
                playsInline
                src={previewMedia.url}
                style={{
                  width: '100%',
                  maxHeight: '75vh',
                  display: 'block'
                }}
              />
            )}
            {previewMedia.type === 'audio' && (
              <div style={{ padding: '30px 20px', width: '100%', background: '#1E293B' }}>
                <audio controls autoPlay src={previewMedia.url} style={{ width: '100%' }} />
              </div>
            )}
          </div>

          {/* Bottom Bar: Telegram bot button */}
          {previewMedia.attachmentId && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: '16px',
                width: '100%',
                maxWidth: '640px',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => previewMedia.attachmentId && handleSendAttachmentToBot(previewMedia.attachmentId)}
                disabled={sendingAttId === previewMedia.attachmentId}
                style={{
                  background: 'var(--primary-blue)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: sendingAttId === previewMedia.attachmentId ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                }}
              >
                {sendingAttId === previewMedia.attachmentId ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Telegram botga yuborilmoqda...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} />
                    <span>Telegram botda ochish</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal 
        isOpen={isSubscriptionModalOpen} 
        onClose={() => setIsSubscriptionModalOpen(false)} 
        onSubscriptionUpdated={() => {
          checkSubscription();
        }}
      />
    </div>
  );
}
