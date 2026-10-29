import { useState, useEffect } from 'react';
import { api, openTelegramBotChat } from '../utils/api';
import { autoFullscreenOnDesktop, toggleAppFullscreen, showTelegramBackButton, hideTelegramBackButton } from '../utils/telegram';
import type { 
  TeacherGroup, CreateAssignmentPayload, AssignmentSummary, 
  AssignmentReport, GroupMember, StudentTimelineAssignment,
  Book, BookPart, BookUnit, BookWord, QuizQuestion
} from '../utils/api';
import { 
  PlusCircle, CheckCircle2, XCircle, AlertTriangle, Lock,
  Send, BookOpen, ChevronRight, RefreshCw, Clock, Shield,
  Trash2, Eye, Volume2, Play, Search, ArrowLeft, Trophy, Sparkles, Check,
  Film, Library, X, ChevronDown, Users, Maximize2, Minimize2, FileText, Video, Save, Download, ExternalLink, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from '../components/ProfileDropdown';
import BottomNav from '../components/BottomNav';
import SubscriptionPlansModal from '../components/SubscriptionPlansModal';

export default function TeacherDashboardPage() {
  const { user, isAuthenticated, checkAuth, setRole, hasSubscription, subscription, checkSubscription } = useAuth();
  const navigate = useNavigate();

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const isTeacherSubActive = Boolean(user?.isAdmin || (hasSubscription && subscription?.targetRole === 'Teacher'));
  const [groupToDelete, setGroupToDelete] = useState<TeacherGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const handleAddGroupClick = () => {
    if (!isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("Yangi guruh qo'shish va guruhni boshqarish faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Yangi guruh qo'shish uchun faol 'Ustoz' tarifiga ega bo'lishingiz kerak. Iltimos, avval tarif rejasini faollashtiring.");
      }
      setShowSubscriptionModal(true);
      return;
    }
    const anyLimitExceeded = groups.some(g => g.isGroupLimitExceeded);
    const maxGroups = subscription?.maxGroups ?? 0;
    if (!user?.isAdmin && (anyLimitExceeded || (maxGroups > 0 && groups.length >= maxGroups))) {
      alert(`Guruhlar soni tarifingizdagi limitdan (${maxGroups} ta) ko'p yoki unga teng bo'lganligi sababli yangi guruh qo'sha olmaysiz. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!`);
      setShowSubscriptionModal(true);
      return;
    }
    openTelegramBotChat('lanswitchbot');
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
      await api.deleteGroup(groupToDelete.id, user?.id);
      alert("✅ Guruh muvaffaqiyatli o'chirildi va barcha ma'lumotlar alohida xavfsiz arxiv bazasiga nusxalandi.");
      const deletedId = groupToDelete.id;
      setGroupToDelete(null);
      await loadGroups();
      if (selectedGroup?.id === deletedId) {
        setSelectedGroup(null);
      }
    } catch (err: any) {
      alert(`❌ Xatolik: ${err.message || "Guruhni o'chirishda xatolik yuz berdi"}`);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // 1. Top Navigation: 3 Core Panels (Classroom, Movies, Vocabulary)
  const [mainTab, setMainTab] = useState<'classroom' | 'movies' | 'vocabulary'>(() => {
    const saved = localStorage.getItem('lanswitch_teacher_main_tab');
    return (saved === 'movies' || saved === 'vocabulary' || saved === 'classroom') ? saved : 'classroom';
  });

  // 2. Classroom & Group Management State
  const tab = 'All';
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TeacherGroup | null>(null);
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'assignments' | 'students' | 'create_assignment'>(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (urlParams?.get('tab') === 'create_assignment' || urlParams?.get('draft_code')) {
      return 'create_assignment';
    }
    const saved = localStorage.getItem('lanswitch_teacher_view_mode');
    return (saved === 'assignments' || saved === 'students') ? saved : 'assignments';
  });
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [assignmentTab, setAssignmentTab] = useState<'active' | 'history'>('active');

  // Edit Assignment Modal State
  const [editingAssignment, setEditingAssignment] = useState<AssignmentReport | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editItems, setEditItems] = useState<{ id: number; title: string; itemType: string; instructions: string }[]>([]);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Group Members Tab State
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberFilter, setMemberFilter] = useState<'active' | 'inactive'>('active');

  // Student Timeline Modal State
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<GroupMember | null>(null);
  const [studentTimeline, setStudentTimeline] = useState<StudentTimelineAssignment[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Assignment Report State ("Hisobot va tekshirish")
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AssignmentReport | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'full_done' | 'punishment' | 'punished' | 'pending'>('all');
  const [isReminding, setIsReminding] = useState(false);
  const [remindSuccess, setRemindSuccess] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<number | null>(null);
  const [sendingAttId, setSendingAttId] = useState<number | null>(null);

  // Punishment Comment Modal State
  const [penaltyModal, setPenaltyModal] = useState<{
    assignmentId: number;
    studentId: number;
    studentName: string;
    itemId?: number;
    itemTitle?: string;
  } | null>(null);
  const [penaltyComment, setPenaltyComment] = useState('');
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const [isSubmittingPenalty, setIsSubmittingPenalty] = useState(false);

  // Student Detail Review Modal ("Ko'rish & Tekshirish")
  const [detailReviewStudent, setDetailReviewStudent] = useState<any | null>(null);

  // Jarimalar bajarilishi modal holati ("Jarimalar bajarildi")
  const [resolvePenaltyStudent, setResolvePenaltyStudent] = useState<any | null>(null);
  const [isResolvingPenalties, setIsResolvingPenalties] = useState(false);

  // Create Assignment Page State (Starts empty, customizable default template & AI command bar)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [activeDraftCode, setActiveDraftCode] = useState<string | null>(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    return urlParams?.get('draft_code') || null;
  });
  const [customTitle, setCustomTitle] = useState(`${new Date().toLocaleDateString('uz-UZ')} Darsi`);
  const [customDeadline, setCustomDeadline] = useState<string>(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setHours(21, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isRefiningDraft, setIsRefiningDraft] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [items, setItems] = useState<Array<{
    orderIndex: number;
    itemType: 'TextReminder' | 'Vocabulary' | 'MediaSubmission';
    title: string;
    instructions: string;
    targetUnitId?: number;
    vocabMode?: 'book' | 'custom';
  }>>([]);
  const [hasDefaultTemplate, setHasDefaultTemplate] = useState(() => {
    return !!localStorage.getItem('lanswitch_teacher_assignment_template');
  });

  // Books hierarchy for Create Assignment modal
  const [booksList, setBooksList] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [bookPartsList, setBookPartsList] = useState<BookPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [partUnitsList, setPartUnitsList] = useState<BookUnit[]>([]);

  // 3. Movies State (For Teachers)
  const [movies, setMovies] = useState<any[]>([]);
  const [movieSearch, setMovieSearch] = useState('');
  const [selectedMovieLevel, setSelectedMovieLevel] = useState<string>('All');
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);

  // 4. Vocabulary Browser State (For Teachers)
  const [vocabBooks, setVocabBooks] = useState<Book[]>([]);
  const [selectedVocabBook, setSelectedVocabBook] = useState<Book | null>(null);
  const [vocabParts, setVocabParts] = useState<BookPart[]>([]);
  const [selectedVocabPart, setSelectedVocabPart] = useState<BookPart | null>(null);
  const [vocabUnits, setVocabUnits] = useState<BookUnit[]>([]);
  const [vocabWords, setVocabWords] = useState<BookWord[]>([]);
  const [vocabStep, setVocabStep] = useState<'books' | 'parts' | 'units'>('books');

  // Flashcards & Quiz Modal State (For Teachers)
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [currentVocabTitle, setCurrentVocabTitle] = useState('Lug\'at');
  const [vocabMode, setVocabMode] = useState<'flashcards' | 'quiz'>('flashcards');
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    // If URL has user_id or telegram_id, try to resolve and sync
    const urlParams = new URLSearchParams(window.location.search);
    const queryTgId = urlParams.get('telegram_id');
    if (!user && queryTgId) {
      api.getUserByTelegram(queryTgId).then(u => {
        if (u) {
          localStorage.setItem('lanswitch_user', JSON.stringify(u));
          checkAuth();
        }
      });
    }

    loadGroups();
  }, [tab, user?.id]);

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
        console.warn('Telegram WebApp full screen error:', e);
      }
    }

    const handleFsChange = () => {
      updateFsState();
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

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
    if (penaltyModal) {
      showTelegramBackButton(() => setPenaltyModal(null));
    } else if (resolvePenaltyStudent) {
      showTelegramBackButton(() => setResolvePenaltyStudent(null));
    } else if (detailReviewStudent) {
      showTelegramBackButton(() => setDetailReviewStudent(null));
    } else if (showReportModal) {
      showTelegramBackButton(() => setShowReportModal(false));
    } else if (viewMode === 'create_assignment') {
      showTelegramBackButton(() => setViewMode('assignments'));
    } else if (showCreateModal) {
      showTelegramBackButton(() => setShowCreateModal(false));
    } else if (showTimelineModal) {
      showTelegramBackButton(() => setShowTimelineModal(false));
    } else if (showGroupDrawer) {
      showTelegramBackButton(() => setShowGroupDrawer(false));
    } else if (selectedGroup) {
      showTelegramBackButton(() => setSelectedGroup(null));
    } else if (mainTab !== 'classroom') {
      showTelegramBackButton(() => setMainTab('classroom'));
    } else {
      hideTelegramBackButton();
    }

    return () => {
      hideTelegramBackButton();
    };
  }, [
    penaltyModal, resolvePenaltyStudent, detailReviewStudent, 
    showReportModal, viewMode, showCreateModal, showTimelineModal, 
    showGroupDrawer, selectedGroup, mainTab
  ]);

  useEffect(() => {
    localStorage.setItem('lanswitch_last_route', '/teacher');
    checkSubscription();
    if (user && user.role !== 'Teacher') {
      setRole('Teacher').catch(console.warn);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    localStorage.setItem('lanswitch_teacher_main_tab', mainTab);
    if (mainTab === 'movies') {
      loadMovies();
    } else if (mainTab === 'vocabulary') {
      loadVocabBooks();
    }
  }, [mainTab]);

  useEffect(() => {
    localStorage.setItem('lanswitch_teacher_view_mode', viewMode);
  }, [viewMode]);

  const loadGroups = async () => {
    setIsLoadingGroups(true);
    const currentTeacherId = user?.id;
    const res = await api.getTeacherGroups(tab, currentTeacherId);
    setGroups(res);
    setIsLoadingGroups(false);

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryDraftCode = urlParams?.get('draft_code');
    const queryGroupId = urlParams?.get('group_id');
    const queryTab = urlParams?.get('tab');

    if (res.length > 0) {
      let target: TeacherGroup | undefined;
      if (queryGroupId) {
        target = res.find(g => g.id.toString() === queryGroupId);
      }
      if (!target) {
        const savedGroupId = localStorage.getItem('lanswitch_teacher_selected_group_id');
        target = res.find(g => g.id.toString() === savedGroupId) || res.find(g => g.id === selectedGroup?.id) || res[0];
      }
      setSelectedGroup(target);
      loadGroupAssignments(target.id, currentTeacherId);
      loadMembers(target.id);
    } else {
      setSelectedGroup(null);
    }

    if (queryDraftCode) {
      setActiveDraftCode(queryDraftCode);
      setViewMode('create_assignment');
      api.getHomeworkDraft(queryDraftCode).then(draft => {
        if (draft) {
          if (draft.title) setCustomTitle(draft.title);
          if (draft.deadline) {
            try {
              setCustomDeadline(new Date(draft.deadline).toISOString().slice(0, 16));
            } catch {}
          }
          if (Array.isArray(draft.items)) {
            setItems(draft.items.map((it, idx) => ({
              orderIndex: idx + 1,
              itemType: it.itemType,
              title: it.title,
              instructions: it.instructions || '',
              targetUnitId: it.targetUnitId,
              vocabMode: 'book'
            })));
          }
          if (draft.groupId) {
            const foundGroup = res.find(g => g.id === draft.groupId);
            if (foundGroup) {
              setSelectedGroup(foundGroup);
            }
          }
        }
      });
    } else if (queryTab === 'create_assignment') {
      setViewMode('create_assignment');
    }
  };

  const loadGroupAssignments = async (groupId: number, teacherId?: number) => {
    const tId = teacherId ?? user?.id;
    const res = await api.getGroupAssignments(groupId, tId);
    setAssignments(res);
  };

  const loadMembers = async (groupId: number) => {
    const res = await api.getGroupMembersList(groupId, true);
    setMembers(res);
  };

  const handleSelectGroup = (g: TeacherGroup) => {
    setSelectedGroup(g);
    localStorage.setItem('lanswitch_teacher_selected_group_id', g.id.toString());
    loadGroupAssignments(g.id);
    loadMembers(g.id);
  };

  const handleSyncMembers = async () => {
    if (!selectedGroup) return;
    if (!isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("Guruh a'zolarini yangilash va sinxronlash faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Guruh a'zolarini yangilash va boshqarish uchun faol 'Ustoz' tarifi talab qilinadi!");
      }
      setShowSubscriptionModal(true);
      return;
    }
    setIsSyncing(true);
    try {
      const res = await api.syncGroupMembers(selectedGroup.id, user?.id);
      alert(`✅ ${res.message || 'Guruh a\'zolari muvaffaqiyatli yangilandi!'}`);
      await loadGroups();
      await loadGroupAssignments(selectedGroup.id);
      await loadMembers(selectedGroup.id);
    } catch (err: any) {
      alert(`❌ Xatolik: ${err.message || 'Sinxronizatsiya muvaffaqiyatsiz bo\'ldi'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Movies loader
  const loadMovies = async () => {
    setIsLoadingMovies(true);
    const data = await api.getMovies();
    setMovies(data);
    setIsLoadingMovies(false);
  };

  // Vocabulary books loader
  const loadVocabBooks = async () => {
    const books = await api.getBooks();
    setVocabBooks(books);
  };

  const handleSelectVocabBook = async (book: Book) => {
    setSelectedVocabBook(book);
    const parts = await api.getBookParts(book.id);
    setVocabParts(parts);
    setVocabStep('parts');
  };

  const handleSelectVocabPart = async (part: BookPart) => {
    setSelectedVocabPart(part);
    const units = await api.getBookUnits(part.id);
    setVocabUnits(units);
    setVocabStep('units');
  };

  const openVocabModalForUnit = async (unit: BookUnit, initialMode: 'flashcards' | 'quiz') => {
    setCurrentVocabTitle(unit.title);
    setVocabMode(initialMode);
    setCurrentWordIdx(0);
    setIsFlipped(false);
    setQuizFinished(false);
    setQuizScore(0);
    setQuizIdx(0);
    setSelectedOption(null);

    const words = await api.getUnitWords(unit.id);
    setVocabWords(words);

    const questions = await api.generateQuiz(unit.id);
    setQuizQuestions(questions);

    setVocabModalOpen(true);
  };

  const playPronunciation = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleQuizAnswer = (optionIdx: number, isCorrect: boolean) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    if (isCorrect) setQuizScore(prev => prev + 1);

    setTimeout(() => {
      if (quizIdx + 1 < quizQuestions.length) {
        setQuizIdx(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setQuizFinished(true);
      }
    }, 1200);
  };

  // Report & Review Full-Screen View
  const handleOpenReport = async (assignmentId: number) => {
    if (selectedGroup?.isSubscriptionExpired || !isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("Topshiriqlarni tekshirish faqat 'Ustoz' tarifida mavjud. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else if ((user?.balance || 0) > 0) {
        alert("Ustozlik tarifi faol emas. Balansingizdagi mablag' bilan tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Topshiriqlarni tekshirish va hisobotlar uchun hisobingizga pul tashlang (balansni to'ldiring) va 'Ustoz Standart' tarifini faollashtiring!");
      }
      setShowSubscriptionModal(true);
      return;
    }
    try {
      const rep = await api.getAssignmentReport(assignmentId, user?.id);
      if (rep) {
        setSelectedReport(rep);
        setShowReportModal(true);
        setReportFilter('all');
        setRemindSuccess(null);
        setDetailReviewStudent(null);
      }
    } catch (err: any) {
      alert(err.message || "Hisobotlar bo'limidan foydalanish uchun balansingizni to'ldiring!");
      setShowSubscriptionModal(true);
    }
  };

  const handleOpenEditModal = async (assignmentId: number) => {
    setIsLoadingEdit(true);
    try {
      const rep = await api.getAssignmentReport(assignmentId, user?.id);
      if (rep) {
        setEditingAssignment(rep);
        setEditTitle(rep.title || '');
        if (rep.deadline) {
          const d = new Date(rep.deadline);
          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setEditDeadline(localIso);
        } else {
          setEditDeadline('');
        }
        setEditItems((rep.items || []).map((it: any) => ({
          id: it.id,
          title: it.title,
          itemType: it.itemType,
          instructions: it.instructions || ''
        })));
      }
    } catch (err: any) {
      alert(`Xatolik: ${err.message || 'Vazifani yuklab bo\'lmadi'}`);
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const handleSaveEditAssignment = async () => {
    if (!editingAssignment) return;
    if (!editTitle.trim()) {
      alert("Iltimos, dars nomini kiriting!");
      return;
    }
    if (!editDeadline) {
      alert("Iltimos, topshirish muddatini belgilang!");
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await api.updateAssignment(
        editingAssignment.assignmentId,
        {
          title: editTitle.trim(),
          deadline: new Date(editDeadline).toISOString(),
          items: editItems.map(it => ({ id: it.id, instructions: it.instructions }))
        },
        user?.id
      );
      if (res.success) {
        alert("✅ Vazifa muvaffaqiyatli yangilandi!");
        setEditingAssignment(null);
        if (selectedGroup) {
          await loadGroupAssignments(selectedGroup.id);
        }
      } else {
        alert(`❌ Xatolik: ${res.message || 'Yangilab bo\'lmadi'}`);
      }
    } catch (err: any) {
      alert(`❌ Xatolik: ${err.message || 'Saqlashda xatolik yuz berdi'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRemindMissing = async () => {
    if (!selectedReport) return;
    setIsReminding(true);
    setRemindSuccess(null);
    const ok = await api.remindMissingStudents(selectedReport.assignmentId, user?.id);
    if (ok) {
      setRemindSuccess('Bot orqali topshirmagan o\'quvchilarga eslatma yuborildi!');
    } else {
      alert('Eslatma yuborishda xatolik yuz berdi');
    }
    setIsReminding(false);
  };

  const handleSetStudentStatus = async (assignmentId: number, studentId: number, status: number, comment?: string) => {
    if (status === 0 && !comment) {
      // Find student name to open penalty modal
      const st = selectedReport?.submittedStudents.find(s => s.studentId === studentId) ||
                 selectedReport?.missingStudents.find(s => s.studentId === studentId);
      setPenaltyModal({
        assignmentId,
        studentId,
        studentName: st?.fullName || 'Talaba'
      });
      setPenaltyComment('');
      setPenaltyError(null);
      return;
    }

    const res = await api.setStudentAssignmentStatus(assignmentId, studentId, status, user?.id, comment);
    if (res.success) {
      const rep = await api.getAssignmentReport(assignmentId, user?.id);
      if (rep) {
        setSelectedReport(rep);
        if (detailReviewStudent && detailReviewStudent.studentId === studentId) {
          const updated = rep.submittedStudents.find(s => s.studentId === studentId) ||
                          rep.missingStudents.find(s => s.studentId === studentId);
          if (updated) setDetailReviewStudent(updated);
        }
      }
      if (selectedGroup) loadGroupAssignments(selectedGroup.id);
    } else {
      alert(res.message || 'Xatolik yuz berdi');
    }
  };

  const handleSetItemStatus = async (
    assignmentId: number,
    itemId: number,
    studentId: number,
    status: number,
    itemTitle?: string,
    studentName?: string,
    comment?: string
  ) => {
    if (status === 0 && !comment) {
      setPenaltyModal({
        assignmentId,
        studentId,
        studentName: studentName || 'Talaba',
        itemId,
        itemTitle: itemTitle || 'Topshiriq qismi'
      });
      setPenaltyComment('');
      setPenaltyError(null);
      return;
    }

    const res = await api.setStudentItemStatus(assignmentId, itemId, studentId, status, user?.id, comment);
    if (res.success) {
      const rep = await api.getAssignmentReport(assignmentId, user?.id);
      if (rep) {
        setSelectedReport(rep);
        if (detailReviewStudent && detailReviewStudent.studentId === studentId) {
          const updated = rep.submittedStudents.find(s => s.studentId === studentId) ||
                          rep.missingStudents.find(s => s.studentId === studentId);
          if (updated) setDetailReviewStudent(updated);
        }
      }
      if (selectedGroup) loadGroupAssignments(selectedGroup.id);
    } else {
      alert(res.message || 'Xatolik yuz berdi');
    }
  };

  const handleConfirmPenalty = async () => {
    if (!penaltyModal) return;
    if (!penaltyComment.trim()) {
      setPenaltyError("Jarima qo'llash uchun jazo izohi yozilishi shart!");
      return;
    }

    setIsSubmittingPenalty(true);
    setPenaltyError(null);
    try {
      const res = penaltyModal.itemId
        ? await api.setStudentItemStatus(
            penaltyModal.assignmentId,
            penaltyModal.itemId,
            penaltyModal.studentId,
            0,
            user?.id,
            penaltyComment.trim()
          )
        : await api.setStudentAssignmentStatus(
            penaltyModal.assignmentId,
            penaltyModal.studentId,
            0,
            user?.id,
            penaltyComment.trim()
          );

      if (res.success) {
        const rep = await api.getAssignmentReport(penaltyModal.assignmentId, user?.id);
        if (rep) {
          setSelectedReport(rep);
          if (detailReviewStudent && detailReviewStudent.studentId === penaltyModal.studentId) {
            const updated = rep.submittedStudents.find(s => s.studentId === penaltyModal.studentId) ||
                            rep.missingStudents.find(s => s.studentId === penaltyModal.studentId);
            if (updated) setDetailReviewStudent(updated);
          }
        }
        if (selectedGroup) loadGroupAssignments(selectedGroup.id);
        setPenaltyModal(null);
        setPenaltyComment('');
      } else {
        setPenaltyError(res.message || "Xatolik yuz berdi");
      }
    } finally {
      setIsSubmittingPenalty(false);
    }
  };

  const handleResolveStudentPenalties = async (student: any) => {
    if (!selectedReport || !student) return;
    setIsResolvingPenalties(true);

    try {
      const penalizedItems = (student.items || []).filter((i: any) => i.mySubmissionStatus === 0);

      if (penalizedItems.length > 0) {
        for (const item of penalizedItems) {
          await api.setStudentItemStatus(
            selectedReport.assignmentId,
            item.id,
            student.studentId,
            2,
            user?.id,
            item.mySubmissionComment ? `${item.mySubmissionComment} (Jarima bajarildi)` : "Jarima bajarildi deb tasdiqlandi"
          );
        }
      } else {
        await api.setStudentAssignmentStatus(
          selectedReport.assignmentId,
          student.studentId,
          2,
          user?.id,
          "Jarima bajarildi deb tasdiqlandi"
        );
      }

      const rep = await api.getAssignmentReport(selectedReport.assignmentId, user?.id);
      if (rep) {
        setSelectedReport(rep);
        if (detailReviewStudent && detailReviewStudent.studentId === student.studentId) {
          const updated = rep.submittedStudents.find(s => s.studentId === student.studentId) ||
                          rep.missingStudents.find(s => s.studentId === student.studentId);
          if (updated) setDetailReviewStudent(updated);
        }
      }
      if (selectedGroup) loadGroupAssignments(selectedGroup.id);
      setResolvePenaltyStudent(null);
    } catch (err) {
      console.error('Error resolving penalties:', err);
      alert('Jarimalarni bajarildi deb belgilashda xatolik yuz berdi');
    } finally {
      setIsResolvingPenalties(false);
    }
  };

  const handleRemoveMember = async (studentId: number) => {
    if (!selectedGroup) return;
    if (!isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("O'quvchilarni guruhdan chiqarish faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Guruh a'zolarini boshqarish uchun faol 'Ustoz' tarifi talab qilinadi!");
      }
      setShowSubscriptionModal(true);
      return;
    }
    if (!window.confirm("Haqiqatdan ham ushbu o'quvchini tizimdan o'chirmoqchimisiz? (Telegram guruhdan chiqarilmaydi, faqat tizimda yashiriladi)")) return;
    const ok = await api.removeMember(selectedGroup.id, studentId, user?.id);
    if (ok) {
      await loadMembers(selectedGroup.id);
      await loadGroups();
    }
  };

  const handleRestoreMember = async (studentId: number) => {
    if (!selectedGroup) return;
    if (!isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("O'quvchilarni guruhga qayta qo'shish faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Guruh a'zolarini boshqarish uchun faol 'Ustoz' tarifi talab qilinadi!");
      }
      setShowSubscriptionModal(true);
      return;
    }
    const ok = await api.restoreMember(selectedGroup.id, studentId, user?.id);
    if (ok) {
      await loadMembers(selectedGroup.id);
      await loadGroups();
    }
  };

  const handleOpenTimeline = async (student: GroupMember) => {
    if (!selectedGroup) return;
    setSelectedStudent(student);
    setIsLoadingTimeline(true);
    setShowTimelineModal(true);
    const data = await api.getStudentTimelineHistory(selectedGroup.id, student.studentId);
    setStudentTimeline(data);
    setIsLoadingTimeline(false);
  };

  const handleDeleteAssignment = async (assignmentId: number, title: string) => {
    const ok = window.confirm(`"${title}" nomli vazifani haqiqatan ham butunlay o'chirmoqchimisiz?\n\nUndagi barcha topshiriqlar, talabalarning yuborgan javoblari va baholari o'chib ketadi.`);
    if (!ok) return;

    setDeletingAssignmentId(assignmentId);
    try {
      const res = await api.deleteAssignment(assignmentId, user?.id);
      if (res.success) {
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
        if (selectedReport?.assignmentId === assignmentId) {
          setShowReportModal(false);
          setSelectedReport(null);
          setDetailReviewStudent(null);
        }
        alert("Vazifa muvaffaqiyatli o'chirildi!");
      } else {
        alert(res.message || "Vazifani o'chirishda xatolik yuz berdi");
      }
    } catch (e: any) {
      alert("Xatolik: " + (e?.message || "Server bilan aloqa xatosi"));
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  const handleDeleteAttachmentByTeacher = async (attachmentId: number) => {
    const ok = window.confirm("Ushbu biriktirilgan faylni o'chirmoqchimisiz?");
    if (!ok) return;

    const okDel = await api.deleteAttachment(attachmentId, user?.id);
    if (okDel) {
      if (detailReviewStudent) {
        const updatedItems = detailReviewStudent.items?.map((it: any) => ({
          ...it,
          attachments: it.attachments?.filter((a: any) => a.id !== attachmentId)
        }));
        setDetailReviewStudent({
          ...detailReviewStudent,
          items: updatedItems
        });
      }
      if (selectedReport) {
        handleOpenReport(selectedReport.assignmentId);
      }
      alert("Fayl muvaffaqiyatli o'chirildi!");
    } else {
      alert("Faylni o'chirib bo'lmadi!");
    }
  };

  const handleSendAttachmentToBot = async (attachmentId: number) => {
    if (sendingAttId === attachmentId) return;
    setSendingAttId(attachmentId);

    try {
      const res = await api.sendAttachmentToBot(attachmentId, user?.id);
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

  const handleOpenCreateModal = async () => {
    if (!isTeacherSubActive) {
      if (subscription?.targetRole === 'Student') {
        alert("Guruhda yangi vazifa yaratish va guruhni boshqarish faqat 'Ustoz' tarifida mavjud! Sizning joriy tarifingiz 'Student Premium'. Talaba rejimida guruhlarni boshqarish cheklangan. Iltimos, tarifingizni 'Ustoz Standart' tarifiga o'tkazing!");
      } else {
        alert("Guruhda yangi vazifa yaratish uchun hisobingizda faol 'Ustoz' tarifi bo'lishi lozim. Iltimos, tarif rejasini faollashtiring.");
      }
      setShowSubscriptionModal(true);
      return;
    }
    if (selectedGroup?.isSubscriptionExpired || selectedGroup?.isGroupLimitExceeded) {
      if (selectedGroup?.isGroupLimitExceeded) {
        alert("Guruhlaringiz soni tarif limitidan oshib ketganligi sababli hech qaysi guruh ishlamaydi. Iltimos, ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!");
      } else {
        alert("Ustoz tarifi muddati tugaganligi sababli yangi vazifa yarata olmaysiz. Iltimos, tarifni yangilang!");
      }
      setShowSubscriptionModal(true);
      return;
    }
    // Starts empty by default as requested
    setItems([]);
    setCustomTitle(`${new Date().toLocaleDateString('uz-UZ')} Darsi`);
    const defaultDl = new Date(Date.now() + 24 * 3600 * 1000);
    defaultDl.setHours(21, 0, 0, 0);
    setCustomDeadline(defaultDl.toISOString().slice(0, 16));

    if (selectedGroup) {
      try {
        const draft = await api.initHomeworkDraft(selectedGroup.id, user?.id);
        if (draft) {
          setActiveDraftCode(draft.draftCode);
        } else {
          setActiveDraftCode(null);
        }
      } catch {
        setActiveDraftCode(null);
      }
    }
    setViewMode('create_assignment');
  };

  const handleRefineDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = aiPromptInput.trim();
    if (!prompt) return;

    if (!selectedGroup) {
      alert("Iltimos, avval guruhni tanlang");
      return;
    }

    setIsRefiningDraft(true);
    try {
      let draftCode = activeDraftCode;
      if (!draftCode) {
        const initRes = await api.initHomeworkDraft(selectedGroup.id, user?.id);
        if (initRes) {
          draftCode = initRes.draftCode;
          setActiveDraftCode(draftCode);
        }
      }

      if (!draftCode) {
        alert("Qoralama bilan bog'lanishda xatolik yuz berdi");
        return;
      }

      // Sync current manual changes first
      await api.updateHomeworkDraft(draftCode, {
        title: customTitle.trim(),
        deadline: customDeadline ? new Date(customDeadline).toISOString() : new Date().toISOString(),
        items: items.map(it => ({
          itemType: it.itemType,
          title: it.title,
          instructions: it.instructions || '',
          targetUnitId: it.targetUnitId
        }))
      });

      const refined = await api.refineHomeworkDraft(draftCode, prompt);
      if (refined) {
        if (refined.title) setCustomTitle(refined.title);
        if (refined.deadline) {
          try {
            setCustomDeadline(new Date(refined.deadline).toISOString().slice(0, 16));
          } catch {}
        }
        if (Array.isArray(refined.items)) {
          setItems(refined.items.map((it, idx) => ({
            orderIndex: idx + 1,
            itemType: it.itemType,
            title: it.title,
            instructions: it.instructions || '',
            targetUnitId: it.targetUnitId,
            vocabMode: 'book'
          })));
        }
        setAiPromptInput('');
      } else {
        alert("AI topshiriqni yangilashda javob bera olmadi. Iltimos qayta urinib ko'ring.");
      }
    } catch (err: any) {
      alert("Xatolik: " + (err?.message || "AI bilan aloqada xatolik"));
    } finally {
      setIsRefiningDraft(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!selectedGroup) return;
    if (!isTeacherSubActive) {
      alert("Vazifa e'lon qilish uchun faol 'Ustoz' tarifi talab qilinadi!");
      setShowSubscriptionModal(true);
      return;
    }
    if (items.length === 0) {
      alert("Topshiriq e'lon qilish uchun kamida 1 ta vazifa bo'limi qo'shilishi shart!");
      return;
    }
    if (!customTitle.trim()) {
      alert("Iltimos, topshiriq sarlavhasini kiriting!");
      return;
    }

    setIsCreatingAssignment(true);
    try {
      if (activeDraftCode) {
        await api.updateHomeworkDraft(activeDraftCode, {
          title: customTitle.trim(),
          deadline: customDeadline ? new Date(customDeadline).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          items: items.map(it => ({
            itemType: it.itemType,
            title: it.title,
            instructions: it.instructions || '',
            targetUnitId: it.targetUnitId
          }))
        });

        const ok = await api.publishHomeworkDraft(activeDraftCode, user?.id);
        if (ok) {
          alert("✅ Vazifa muvaffaqiyatli Telegram guruhga e'lon qilindi!");
          setActiveDraftCode(null);
          setViewMode('assignments');
          await loadGroupAssignments(selectedGroup.id);
          return;
        }
      }

      // Fallback
      const payload: CreateAssignmentPayload = {
        groupId: selectedGroup.id,
        title: customTitle.trim(),
        deadline: customDeadline ? new Date(customDeadline).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        items: items.map((it, idx) => ({ ...it, orderIndex: idx + 1 }))
      };
      await api.createAssignment(payload, user?.id);
      alert("✅ Vazifa muvaffaqiyatli Telegram guruhga e'lon qilindi!");
      setViewMode('assignments');
      await loadGroupAssignments(selectedGroup.id);
    } catch (e: any) {
      alert("Vazifani yaratishda xatolik yuz berdi: " + (e?.message || "Server xatosi"));
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...items];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setItems(copy);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (items.length === 0) {
      alert("Shablon sifatida saqlash uchun kamida 1 ta topshiriq bo'limi qo'shing!");
      return;
    }
    localStorage.setItem('lanswitch_teacher_assignment_template', JSON.stringify({
      title: customTitle,
      items
    }));
    setHasDefaultTemplate(true);
    alert("✅ Hozirgi topshiriqlar Standart Shablon sifatida saqlandi! Har doim yangi vazifa tuzayotganda 'Standart shablonni yuklash' tugmasi bilan yuklashingiz mumkin.");
  };

  const handleLoadSavedTemplate = () => {
    const saved = localStorage.getItem('lanswitch_teacher_assignment_template');
    if (!saved) {
      alert("Hozircha saqlangan standart shablon mavjud emas.");
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
        if (parsed.title) setCustomTitle(parsed.title);
      } else {
        alert("Saqlangan shablon bo'sh.");
      }
    } catch {
      alert("Shablonni yuklashda xatolik yuz berdi");
    }
  };

  const handleAddItem = (type: 'TextReminder' | 'Vocabulary' | 'MediaSubmission') => {
    let title = '';
    let instructions = '';
    let targetUnitId = partUnitsList[0]?.id || 1;

    if (type === 'Vocabulary') {
      title = `So'z boyligi va test`;
      instructions = 'Belgilangan darslik so\'zlarini yodlang va kamida 70% natija bilan test topshiring';
    } else if (type === 'MediaSubmission') {
      title = `Video / Audio vazifa (Bot)`;
      instructions = 'Mavzu yuzasidan 1 daqiqalik video yoki audio yozib Telegram botga yuboring';
    } else {
      title = `Kitob o'qish / Qoidalar`;
      instructions = 'Darslikdagi matnni o\'qib, yangi qoidalarni daftarga qayd qiling';
    }

    setItems(prev => [...prev, {
      orderIndex: prev.length + 1,
      itemType: type,
      title,
      instructions,
      targetUnitId,
      vocabMode: 'book'
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Load Books Hierarchy for Create Assignment Modal / Page
  useEffect(() => {
    if (viewMode === 'create_assignment' || showCreateModal) {
      if (booksList.length === 0) {
        api.getBooks().then(res => {
          setBooksList(res);
          if (res.length > 0) {
            const firstBook = res[0];
            setSelectedBookId(firstBook.id);
            api.getBookParts(firstBook.id).then(parts => {
              setBookPartsList(parts);
              if (parts.length > 0) {
                setSelectedPartId(parts[0].id);
                api.getBookUnits(parts[0].id).then(units => {
                  setPartUnitsList(units);
                });
              }
            });
          }
        });
      }
    }
  }, [viewMode, showCreateModal]);

  const handleBookSelect = async (bookId: number) => {
    setSelectedBookId(bookId);
    const parts = await api.getBookParts(bookId);
    setBookPartsList(parts);
    if (parts.length > 0) {
      setSelectedPartId(parts[0].id);
      const units = await api.getBookUnits(parts[0].id);
      setPartUnitsList(units);
    } else {
      setSelectedPartId(null);
      setPartUnitsList([]);
    }
  };

  const handlePartSelect = async (partId: number) => {
    setSelectedPartId(partId);
    const units = await api.getBookUnits(partId);
    setPartUnitsList(units);
  };

  const filteredMembers = members.filter(m => memberFilter === 'active' ? m.isActive : !m.isActive);
  const filteredMovies = movies.filter(m => {
    const matchesSearch = movieSearch.trim() === '' || m.title?.toLowerCase().includes(movieSearch.toLowerCase());
    const matchesLevel = selectedMovieLevel === 'All' || m.level === selectedMovieLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="app-page-wrapper" style={{
      minHeight: '100vh',
      background: 'var(--ice-blue-bg)',
      paddingBottom: 'calc(110px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
      fontFamily: 'var(--font-main)'
    }}>
      {/* ======================================================== */}
      {/* 1. TOPBAR (IDENTICAL TO STUDENT TOPBAR)                  */}
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
        {mainTab === 'classroom' ? (
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
                {selectedGroup ? selectedGroup.title : (groups.length === 0 ? 'Guruh ulanmagan' : 'Guruhni tanlang')}
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
          <ProfileDropdown onNavigateTab={(t) => setMainTab(t as any)} variant="teacher" />
        </div>
      </header>

      <main style={{ maxWidth: '1240px', margin: '24px auto', padding: '0 20px' }}>
        {/* If user is not authenticated -> Show Login Banner */}
        {!isAuthenticated && (
          <div style={{ maxWidth: '640px', margin: '48px auto', background: 'var(--pure-white)', borderRadius: '28px', border: '2px solid var(--sky-border)', padding: '44px 32px', textAlign: 'center', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--ice-blue-bg)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid var(--sky-border)' }}>
              <Shield size={44} />
            </div>
            
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Avtorizatsiya talab qilinadi
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '12px' }}>
              O'qituvchi Paneliga Kirish
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '28px' }}>
              O'qituvchi panelidan foydalanish, guruhlarni boshqarish va uyga vazifalarni tekshirish uchun avval Telegram botimizga <strong>/start</strong> bosing.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px', margin: '0 auto' }}>
              <a 
                href="https://t.me/lanswitchbot?start=login" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-big-blue" 
                style={{ width: '100%', minHeight: '54px', fontSize: '16px' }}
              >
                <Send size={20} />
                <span>🚀 BOTGA START BOSISH / KIRISH</span>
              </a>

              <button 
                onClick={() => checkAuth()} 
                className="btn-big-white" 
                style={{ width: '100%', minHeight: '48px', fontSize: '15px' }}
              >
                <RefreshCw size={16} />
                <span>Kirgan bo'lsangiz, qayta tekshirish</span>
              </button>
            </div>
          </div>
        )}

        {/* If user is authenticated */}
        {isAuthenticated && (
          <>
            {/* ======================================================== */}
            {/* 2. TAB: CLASSROOM & ASSIGNMENTS MANAGEMENT              */}
            {/* ======================================================== */}
            {mainTab === 'classroom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {!selectedGroup ? (
                  groups.length === 0 ? (
                    <div style={{
                      padding: '40px 24px',
                      background: 'var(--pure-white)',
                      borderRadius: 'var(--radius-card)',
                      border: '2px dashed var(--sky-border)',
                      margin: '12px 0',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '9999px',
                        background: 'var(--ice-blue-bg)',
                        color: 'var(--primary-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 18px',
                        border: '2px solid var(--sky-border)'
                      }}>
                        <Users size={34} />
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
                        Hali guruhlar ulanmagan
                      </h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-navy-secondary)', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 20px' }}>
                        O'quvchilaringiz mavjud bo'lgan Telegram guruhingizga <b>@lanswitchbot</b> ni qo'shing va uni <b>Administrator</b> qiling. Shunda guruh va uning a'zolari ushbu panelda avtomatik paydo bo'ladi.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px', margin: '0 auto' }}>
                        <button
                          type="button"
                          onClick={handleAddGroupClick}
                          className="btn-big-blue"
                          style={{ width: '100%', minHeight: '48px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Send size={18} />
                          <span>➕ Botni guruhga qo'shish</span>
                        </button>
                        
                        <div style={{
                          padding: '16px',
                          background: '#F8FAFC',
                          borderRadius: '14px',
                          border: '1px solid #E2E8F0',
                          textAlign: 'left',
                          marginTop: '4px'
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>
                            🎓 Siz o'quvchimisiz?
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                            Agar siz talaba bo'lsangiz, kinolar va lug'atdan mustaqil foydalanish yoki topshiriqlarni ko'rish uchun talaba rejimiga o'ting.
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await setRole('Student');
                              } catch (e) {
                                console.warn(e);
                              }
                              localStorage.setItem('lanswitch_last_route', '/student');
                              const search = window.location.search || '';
                              navigate(`/student${search}`);
                            }}
                            className="btn-big-white"
                            style={{ width: '100%', minHeight: '42px', fontSize: '13px' }}
                          >
                            <span>🎓 Talaba rejimiga o'tish</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '48px 20px',
                      textAlign: 'center',
                      background: 'var(--pure-white)',
                      borderRadius: 'var(--radius-card)',
                      border: '2px dashed var(--sky-border)',
                      margin: '12px 0'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '9999px',
                        background: 'var(--ice-blue-bg)',
                        color: 'var(--primary-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <BookOpen size={28} />
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
                        Guruh tanlanmagan
                      </h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 20px' }}>
                        Topshiriqlarni ko'rish va boshqarish uchun guruhni tanlang.
                      </p>
                      <button
                        onClick={() => setShowGroupDrawer(true)}
                        className="btn-big-blue"
                        style={{ margin: '0 auto' }}
                      >
                        <span>Guruhni tanlash</span>
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    {/* RED WARNING NOTICE IF GROUP LIMIT IS EXCEEDED OR SUBSCRIPTION EXPIRED */}
                    {selectedGroup?.isGroupLimitExceeded ? (
                      <div style={{
                        background: '#FEF2F2',
                        border: '1.5px solid #FCA5A5',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        boxShadow: '0 2px 10px rgba(239, 68, 68, 0.08)',
                        margin: '6px 0 16px 0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#FEE2E2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <AlertTriangle size={22} color="#DC2626" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 900, color: '#B91C1C', fontSize: '15px' }}>
                              ⚠️ Guruhlaringiz soni tarif rejangizdagi limitdan oshib ketgan!
                            </div>
                            <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '2px', lineHeight: 1.4 }}>
                              Tarifingiz bo'yicha ruxsat etilgan limit: <strong>{selectedGroup.groupLimit ?? 0} ta</strong> guruh. Sizda esa hozir <strong>{selectedGroup.currentGroupCount ?? groups.length} ta</strong> guruh mavjud. Shu sababli hech qaysi guruh ishlamaydi. Tizim ishlashi uchun ortiqcha guruhlarni o'chiring yoki tarifingizni upgrade qiling!
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setShowGroupDrawer(true)}
                            style={{
                              padding: '10px 16px',
                              background: '#FFFFFF',
                              color: '#DC2626',
                              border: '1.5px solid #FCA5A5',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '13px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Ortiqcha guruhni o'chirish
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSubscriptionModal(true)}
                            style={{
                              padding: '10px 18px',
                              background: '#DC2626',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '13px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Tarifni oshirish (Upgrade)
                          </button>
                        </div>
                      </div>
                    ) : (!isTeacherSubActive || selectedGroup?.isSubscriptionExpired) && (
                      <div style={{
                        background: '#FEF2F2',
                        border: '2px solid #FCA5A5',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.12)',
                        margin: '6px 0 16px 0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: '#FEE2E2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Lock size={22} color="#DC2626" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 900, color: '#B91C1C', fontSize: '15.5px' }}>
                              {subscription?.targetRole === 'Student'
                                ? "🔒 Guruh boshqaruvi cheklangan (Joriy tarif: Student Premium)"
                                : "⚠️ Ustoz tarifi muddati tugagan yoki faol emas!"}
                            </div>
                            <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '2px', lineHeight: 1.45 }}>
                              {subscription?.targetRole === 'Student'
                                ? "Guruhda dars topshiriqlarini yaratish, o'quvchilarni nazorat qilish va guruhni boshqarish faqat 'Ustoz' tarifida mavjud. Student (talaba) rejimida guruhlarni boshqarish umuman mumkin emas! Tizimdan to'liq foydalanish uchun tarifingizni 'Ustoz Standart'ga o'tkazing."
                                : "Ushbu guruhdagi barcha topshiriqlar talabalarga ko'rinmaydi va guruhni boshqarish cheklangan. Tizimdan to'liq foydalanish uchun tarifni yangilang."}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSubscriptionModal(true)}
                          style={{
                            padding: '10px 18px',
                            background: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '13px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {subscription?.targetRole === 'Student' ? "⭐ Tarifni Ustozga o'tkazish" : "Tarifni yangilash"}
                        </button>
                      </div>
                    )}

                {/* 2.1 VIEW MODE: CREATE & REFINE ASSIGNMENT (FULL PAGE) */}
                {viewMode === 'create_assignment' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '100px' }}>
                    {/* Full Page Header & Minimal Top Toolbar */}
                    <div style={{
                      background: 'var(--pure-white)',
                      borderRadius: '20px',
                      padding: '16px 20px',
                      border: '1.5px solid var(--sky-border)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      position: 'sticky',
                      top: '72px',
                      zIndex: 35
                    }}>
                      {/* Left: Back button & Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (items.length > 0 && !window.confirm("Kiritilgan o'zgarishlar saqlanmasligi mumkin. Chiqishni xohlaysizmi?")) return;
                            setViewMode('assignments');
                          }}
                          style={{
                            background: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            borderRadius: '12px',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 800,
                            color: 'var(--text-navy)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <ArrowLeft size={16} />
                          <span>Orqaga</span>
                        </button>

                        <div>
                          <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-navy)', lineHeight: 1.2 }}>
                            Vazifa Tuzish & Tahrirlash
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 700, marginTop: '2px' }}>
                            Guruh: <strong>{selectedGroup?.title || 'Tanlanmagan'}</strong>
                            {activeDraftCode && <span style={{ marginLeft: '8px', color: '#64748B', fontSize: '11px' }}>(Loyiha #{activeDraftCode})</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Minimal Top Actions Toolbar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleAddItem('Vocabulary')}
                          className="btn-big-white"
                          style={{
                            minHeight: '36px',
                            padding: '0 12px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1.5px solid #93C5FD',
                            color: '#1D4ED8',
                            background: '#EFF6FF'
                          }}
                        >
                          <BookOpen size={14} />
                          <span>+ Lug'at</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddItem('MediaSubmission')}
                          className="btn-big-white"
                          style={{
                            minHeight: '36px',
                            padding: '0 12px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1.5px solid #C084FC',
                            color: '#7E22CE',
                            background: '#FAF5FF'
                          }}
                        >
                          <Video size={14} />
                          <span>+ Media</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddItem('TextReminder')}
                          className="btn-big-white"
                          style={{
                            minHeight: '36px',
                            padding: '0 12px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1.5px solid #FCD34D',
                            color: '#B45309',
                            background: '#FEF9C3'
                          }}
                        >
                          <FileText size={14} />
                          <span>+ Matn</span>
                        </button>

                        {/* Shablon Menu Dropdown */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setShowTemplateDropdown(prev => !prev)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: '#F0FDF4',
                              border: '1.5px solid #86EFAC',
                              color: '#166534',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Shablon</span>
                            <ChevronDown size={12} />
                          </button>

                          {showTemplateDropdown && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '6px',
                              background: '#fff',
                              border: '1.5px solid var(--sky-border)',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              zIndex: 50,
                              minWidth: '220px',
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowTemplateDropdown(false);
                                  handleSaveCurrentAsTemplate();
                                }}
                                disabled={items.length === 0}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: items.length > 0 ? 'var(--text-navy)' : '#94A3B8',
                                  cursor: items.length > 0 ? 'pointer' : 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Save size={14} color="#16A34A" />
                                <span>Hozirgisini saqlash</span>
                              </button>

                              {hasDefaultTemplate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowTemplateDropdown(false);
                                    handleLoadSavedTemplate();
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--text-navy)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <Download size={14} color="#2563EB" />
                                  <span>Standart shablonni yuklash</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Publish Button */}
                        <button
                          type="button"
                          onClick={handlePublishDraft}
                          disabled={items.length === 0 || isCreatingAssignment}
                          className="btn-big-blue"
                          style={{
                            minHeight: '38px',
                            padding: '0 18px',
                            fontSize: '13px',
                            opacity: (items.length === 0 || isCreatingAssignment) ? 0.6 : 1,
                            cursor: (items.length === 0 || isCreatingAssignment) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                          }}
                        >
                          {isCreatingAssignment ? (
                            <>
                              <RefreshCw className="animate-spin" size={14} />
                              <span>Yuklanmoqda...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀 Guruhga e'lon qilish ({items.length})</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Assignment Title & Deadline Row */}
                    <div style={{
                      background: 'var(--pure-white)',
                      borderRadius: '20px',
                      padding: '20px',
                      border: '1.5px solid var(--sky-border)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '16px'
                    }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', display: 'block', marginBottom: '6px' }}>
                          📝 Vazifa umumiy nomi / Mavzusi:
                        </label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={e => setCustomTitle(e.target.value)}
                          placeholder="Masalan: Unit 5: Past Simple darsi va yangi so'zlar"
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid var(--sky-border)',
                            fontSize: '15px',
                            fontWeight: 700,
                            background: 'var(--ice-blue-bg)',
                            color: 'var(--text-navy)',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', display: 'block', marginBottom: '6px' }}>
                          ⏰ Topshirish muddati (Deadline):
                        </label>
                        <input
                          type="datetime-local"
                          value={customDeadline}
                          onChange={e => setCustomDeadline(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid var(--sky-border)',
                            fontSize: '14px',
                            fontWeight: 700,
                            background: 'var(--ice-blue-bg)',
                            color: 'var(--text-navy)',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Assignment Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-navy)' }}>
                          📋 Vazifa qismlari ({items.length} ta):
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          O'quvchilar ushbu har bir qismni alohida topshirishadi
                        </div>
                      </div>

                      {items.length === 0 ? (
                        <div style={{
                          background: 'var(--pure-white)',
                          border: '2px dashed var(--sky-border)',
                          borderRadius: '20px',
                          padding: '40px 24px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '16px'
                        }}>
                          <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: '#DBEAFE',
                            color: '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px'
                          }}>
                            📋
                          </div>
                          <div>
                            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '4px' }}>
                              Hozircha hech qanday topshiriq qo'shilmagan
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
                              Yuqoridagi tugmalar orqali qo'lda qo'shing yoki <strong>pastdagi AI qatoriga</strong> ovozli/yozma buyruq yozing (masalan: <em>"Essential Unit 4 ni qo'sh", "2-mashqni o'chir", "so'zlarni 15 ta qil va video topshirishni qo'sh"</em>).
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleAddItem('Vocabulary')}
                              className="btn-big-white"
                              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid #93C5FD', color: '#1D4ED8' }}
                            >
                              <BookOpen size={16} />
                              <span>+ Lug'at qo'shish</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddItem('MediaSubmission')}
                              className="btn-big-white"
                              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid #C084FC', color: '#7E22CE' }}
                            >
                              <Video size={16} />
                              <span>+ Video/Audio qo'shish</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddItem('TextReminder')}
                              className="btn-big-white"
                              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid #FCD34D', color: '#B45309' }}
                            >
                              <FileText size={16} />
                              <span>+ Matn qo'shish</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: 'var(--pure-white)',
                          borderRadius: '18px',
                          border: '1.5px solid var(--sky-border)',
                          overflow: 'hidden',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                        }}>
                          {items.map((it, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '12px 16px',
                                borderBottom: idx === items.length - 1 ? 'none' : '1px solid #E2E8F0',
                                background: idx % 2 === 1 ? '#FAFCFF' : '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                transition: 'background 0.2s'
                              }}
                            >
                              {/* 1-qator: Raqam, Turi, Sarlavha input, va Tugmalar */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Raqam badge */}
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: '#EFF6FF',
                                  color: '#1D4ED8',
                                  fontSize: '12px',
                                  fontWeight: 900,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {idx + 1}
                                </div>

                                {/* Turi badge */}
                                <span style={{
                                  background: it.itemType === 'Vocabulary' ? '#EFF6FF' : it.itemType === 'MediaSubmission' ? '#FAF5FF' : '#FEF3C7',
                                  color: it.itemType === 'Vocabulary' ? '#1D4ED8' : it.itemType === 'MediaSubmission' ? '#7E22CE' : '#B45309',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}>
                                  {it.itemType === 'Vocabulary' && <><BookOpen size={13} /> Lug'at</>}
                                  {it.itemType === 'MediaSubmission' && <><Video size={13} /> Media</>}
                                  {it.itemType === 'TextReminder' && <><FileText size={13} /> Matn</>}
                                </span>

                                {/* Sarlavha input */}
                                <input
                                  type="text"
                                  value={it.title}
                                  onChange={e => {
                                    const copy = [...items];
                                    copy[idx].title = e.target.value;
                                    setItems(copy);
                                  }}
                                  placeholder="Topshiriq nomi / Sarlavha"
                                  style={{
                                    flex: '1 1 200px',
                                    minWidth: '160px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid var(--sky-border)',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: 'var(--text-navy)',
                                    background: 'var(--ice-blue-bg)'
                                  }}
                                />

                                {/* Action buttons: Up/Down/Delete */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveItem(idx, 'up')}
                                    disabled={idx === 0}
                                    style={{
                                      background: '#F1F5F9',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '6px',
                                      width: '26px',
                                      height: '26px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                      opacity: idx === 0 ? 0.3 : 1,
                                      fontSize: '10px',
                                      fontWeight: 900
                                    }}
                                    title="Yuqoriga"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveItem(idx, 'down')}
                                    disabled={idx === items.length - 1}
                                    style={{
                                      background: '#F1F5F9',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '6px',
                                      width: '26px',
                                      height: '26px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: idx === items.length - 1 ? 'not-allowed' : 'pointer',
                                      opacity: idx === items.length - 1 ? 0.3 : 1,
                                      fontSize: '10px',
                                      fontWeight: 900
                                    }}
                                    title="Pastga"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    style={{
                                      background: '#FEE2E2',
                                      border: '1px solid #FECACA',
                                      color: '#DC2626',
                                      borderRadius: '6px',
                                      width: '26px',
                                      height: '26px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title="O'chirish"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* 2-qator: Vocabulary tanlash yoki Izoh */}
                              {it.itemType === 'Vocabulary' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...items];
                                        copy[idx].vocabMode = 'book';
                                        setItems(copy);
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: it.vocabMode === 'book' ? '1.5px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                                        background: it.vocabMode === 'book' ? 'var(--primary-blue)' : '#fff',
                                        color: it.vocabMode === 'book' ? '#fff' : 'var(--text-navy)',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <BookOpen size={12} />
                                      <span>Kitob Unitidan tanlash</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...items];
                                        copy[idx].vocabMode = 'custom';
                                        setItems(copy);
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: it.vocabMode === 'custom' ? '1.5px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                                        background: it.vocabMode === 'custom' ? 'var(--primary-blue)' : '#fff',
                                        color: it.vocabMode === 'custom' ? '#fff' : 'var(--text-navy)',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <span>✍️ O'z so'zlarim</span>
                                    </button>
                                  </div>

                                  {it.vocabMode === 'book' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
                                      <select
                                        value={selectedBookId || ''}
                                        onChange={e => handleBookSelect(Number(e.target.value))}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--sky-border)', fontSize: '12px', background: '#fff' }}
                                      >
                                        {booksList.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                      </select>
                                      <select
                                        value={selectedPartId || ''}
                                        onChange={e => handlePartSelect(Number(e.target.value))}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--sky-border)', fontSize: '12px', background: '#fff' }}
                                      >
                                        {bookPartsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                      </select>
                                      <select
                                        value={it.targetUnitId || ''}
                                        onChange={e => {
                                          const copy = [...items];
                                          copy[idx].targetUnitId = Number(e.target.value);
                                          setItems(copy);
                                        }}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--sky-border)', fontSize: '12px', background: '#fff' }}
                                      >
                                        {partUnitsList.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                                      </select>
                                    </div>
                                  ) : (
                                    <textarea
                                      rows={2}
                                      value={it.instructions}
                                      onChange={e => {
                                        const copy = [...items];
                                        copy[idx].instructions = e.target.value;
                                        setItems(copy);
                                      }}
                                      placeholder="apple - olma&#10;book - kitob"
                                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--sky-border)', fontSize: '12px', background: '#fff' }}
                                    />
                                  )}
                                </div>
                              ) : null}

                              {/* Yo'riqnoma inputi (ixcham) */}
                              {!(it.itemType === 'Vocabulary' && it.vocabMode === 'custom') && (
                                <input
                                  type="text"
                                  value={it.instructions || ''}
                                  onChange={e => {
                                    const copy = [...items];
                                    copy[idx].instructions = e.target.value;
                                    setItems(copy);
                                  }}
                                  placeholder={
                                    it.itemType === 'MediaSubmission'
                                      ? "Izoh: Masalan, 1 daqiqalik video yozib botga yuboring"
                                      : it.itemType === 'TextReminder'
                                      ? "Izoh: Masalan, 32-betdagi 4-mashqni yozma bajarish"
                                      : "Izoh / Yo'riqnoma (ixtiyoriy)"
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #E2E8F0',
                                    fontSize: '12px',
                                    color: 'var(--text-navy)',
                                    background: '#fff'
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* FIXED BOTTOM AI COMMAND BAR */}
                    <div style={{
                      position: 'fixed',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(12px)',
                      borderTop: '1.5px solid var(--sky-border)',
                      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
                      padding: '12px 16px calc(12px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
                      zIndex: 60
                    }}>
                      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Suggestion Pills */}
                        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                          {[
                            "Essential Unit 4 ni qo'sh",
                            "1 daqiqalik video vazifasini qo'sh",
                            "Muddatni ertaga 21:00 qil",
                            "Workbook 12-bet mashqlarini qo'sh",
                            "Oxirgi vazifani o'chirib tashla"
                          ].map((pill, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                setAiPromptInput(pill);
                              }}
                              style={{
                                background: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                borderRadius: '999px',
                                padding: '4px 12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: 'var(--text-navy)',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            >
                              + {pill}
                            </button>
                          ))}
                        </div>

                        {/* AI Command Input Form */}
                        <form
                          onSubmit={handleRefineDraft}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'var(--ice-blue-bg)',
                            borderRadius: '16px',
                            border: '1.5px solid var(--sky-border)',
                            padding: '4px 6px 4px 14px'
                          }}
                        >
                          <Sparkles size={18} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
                          <input
                            type="text"
                            value={aiPromptInput}
                            onChange={e => setAiPromptInput(e.target.value)}
                            disabled={isRefiningDraft}
                            placeholder="AI buyruq: masalan: '2-mashqni o'chir', 'muddatni ertaga 21:00 qil'..."
                            style={{
                              flex: 1,
                              border: 'none',
                              background: 'transparent',
                              padding: '10px 0',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--text-navy)',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!aiPromptInput.trim() || isRefiningDraft}
                            style={{
                              background: 'var(--primary-blue)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '12px',
                              padding: '10px 16px',
                              fontSize: '13px',
                              fontWeight: 800,
                              cursor: (!aiPromptInput.trim() || isRefiningDraft) ? 'not-allowed' : 'pointer',
                              opacity: (!aiPromptInput.trim() || isRefiningDraft) ? 0.5 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexShrink: 0
                            }}
                          >
                            {isRefiningDraft ? (
                              <>
                                <RefreshCw className="animate-spin" size={14} />
                                <span>O'zgartirilmoqda...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>O'zgartirish</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2.2 VIEW MODE: DARSLAR (ASSIGNMENTS LIST) */}
                {viewMode === 'assignments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', margin: '4px 0' }}>
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', margin: 0 }}>
                          📋 Dars Vazifalari
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          Guruh bo'yicha e'lon qilingan topshiriqlar va hisobotlar
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedGroup?.isOwner && (
                          <button
                            type="button"
                            onClick={() => setGroupToDelete(selectedGroup)}
                            title="Guruhni o'chirish"
                            style={{
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: '1.5px solid #FECACA',
                              borderRadius: '10px',
                              padding: '8px 14px',
                              fontSize: '13px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              minHeight: '40px'
                            }}
                          >
                            <Trash2 size={16} />
                            <span>Guruhni o'chirish</span>
                          </button>
                        )}
                        <button
                          onClick={handleOpenCreateModal}
                          disabled={!selectedGroup}
                          className="btn-big-blue"
                          style={{
                            minHeight: '40px',
                            padding: '0 18px',
                            fontSize: '13px',
                            ...(!isTeacherSubActive || selectedGroup?.isSubscriptionExpired ? {
                              background: '#EF4444',
                              borderColor: '#DC2626',
                              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                            } : {})
                          }}
                        >
                          <PlusCircle size={16} />
                          <span>{(!isTeacherSubActive || selectedGroup?.isSubscriptionExpired) ? "🔒 Yangi Vazifa (Cheklangan)" : "Yangi Vazifa Tuzish"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Active vs History (Arxiv) Tabs */}
                    {(() => {
                      const now = new Date();
                      const activeAssignments = assignments.filter(a => !a.deadline || new Date(a.deadline) > now);
                      const historyAssignments = assignments.filter(a => a.deadline && new Date(a.deadline) <= now);
                      const displayedAssignments = assignmentTab === 'active' ? activeAssignments : historyAssignments;

                      return (
                        <>
                          <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                            <button
                              type="button"
                              onClick={() => setAssignmentTab('active')}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                border: 'none',
                                background: assignmentTab === 'active' ? '#fff' : 'transparent',
                                color: assignmentTab === 'active' ? '#1D4ED8' : '#64748B',
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: assignmentTab === 'active' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>🟢 Faol Vazifalar</span>
                              <span style={{
                                background: assignmentTab === 'active' ? '#DBEAFE' : '#E2E8F0',
                                color: assignmentTab === 'active' ? '#1D4ED8' : '#64748B',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 900
                              }}>
                                {activeAssignments.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAssignmentTab('history')}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                border: 'none',
                                background: assignmentTab === 'history' ? '#fff' : 'transparent',
                                color: assignmentTab === 'history' ? '#1D4ED8' : '#64748B',
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: 'pointer',
                                boxShadow: assignmentTab === 'history' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>📜 Topshiriqlar Tarixi</span>
                              <span style={{
                                background: assignmentTab === 'history' ? '#DBEAFE' : '#E2E8F0',
                                color: assignmentTab === 'history' ? '#1D4ED8' : '#64748B',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 900
                              }}>
                                {historyAssignments.length}
                              </span>
                            </button>
                          </div>

                          {displayedAssignments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', background: 'var(--pure-white)', borderRadius: '20px', border: '1.5px dashed var(--sky-border)' }}>
                              {assignmentTab === 'active' 
                                ? "Ushbu guruhda ayni paytda faol topshiriqlar mavjud emas." 
                                : "Topshiriqlar tarixi bo'sh. Muddati o'tgan topshiriqlar mavjud emas."}
                            </div>
                          ) : (
                            displayedAssignments.map(ass => {
                              const isExpired = ass.deadline && new Date(ass.deadline) <= now;
                              return (
                                <div
                                  key={ass.id}
                                  style={{
                                    background: 'var(--pure-white)',
                                    border: isExpired ? '1.5px solid #E2E8F0' : '1.5px solid var(--sky-border)',
                                    borderRadius: '20px',
                                    padding: '20px 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '16px',
                                    boxShadow: 'var(--shadow-card)',
                                    opacity: isExpired ? 0.9 : 1
                                  }}
                                >
                                  <div>
                                    {(!isTeacherSubActive || selectedGroup?.isSubscriptionExpired) && (
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: '#FEE2E2',
                                        border: '1px solid #FECACA',
                                        color: '#DC2626',
                                        borderRadius: '8px',
                                        padding: '3px 10px',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        marginBottom: '6px'
                                      }}>
                                        <span>⚠️ Ushbu topshiriq o'quvchi va talabalarga ko'rinmaydi!</span>
                                      </div>
                                    )}

                                    {isExpired && (
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: '#F1F5F9',
                                        border: '1px solid #CBD5E1',
                                        color: '#475569',
                                        borderRadius: '8px',
                                        padding: '3px 10px',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        marginBottom: '6px'
                                      }}>
                                        <span>⏰ Muddati o'tgan (Arxivda)</span>
                                      </div>
                                    )}

                                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>
                                      {ass.title}
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                      <span>📅 Yaratildi: {new Date(ass.createdAt).toLocaleDateString('uz-UZ')}</span>
                                      {ass.deadline && (
                                        <span style={{ color: isExpired ? '#DC2626' : '#2563EB', fontWeight: 700 }}>
                                          ⏰ Deadline: {new Date(ass.deadline).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                      <span>📌 Bo'limlar soni: {ass.itemsCount} ta</span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 800 }}>
                                        ✅ {ass.submittedCount} ta topshirdi
                                      </span>
                                      <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 800 }}>
                                        ⚠️ {ass.missingCount} ta qilmadi
                                      </span>
                                    </div>

                                    {/* Sozlamalar yoki Muddatni uzaytirish tugmasi */}
                                    {isExpired ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(ass.id)}
                                        disabled={isLoadingEdit}
                                        title="Muddatni uzaytirish va tahrirlash"
                                        style={{
                                          background: '#EFF6FF',
                                          color: '#1D4ED8',
                                          border: '1.5px solid #93C5FD',
                                          borderRadius: 'var(--radius-pill)',
                                          padding: '0 16px',
                                          minHeight: '40px',
                                          fontSize: '13px',
                                          fontWeight: 800,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <Clock size={15} />
                                        <span>⏰ Muddatni uzaytirish</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(ass.id)}
                                        disabled={isLoadingEdit}
                                        title="Topshiriq sozlamalari"
                                        style={{
                                          background: '#F1F5F9',
                                          color: 'var(--text-navy)',
                                          border: '1.5px solid #CBD5E1',
                                          borderRadius: 'var(--radius-pill)',
                                          padding: '0 14px',
                                          minHeight: '40px',
                                          fontSize: '13px',
                                          fontWeight: 800,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <Settings size={15} />
                                        <span>Sozlamalar</span>
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleOpenReport(ass.id)}
                                      className="btn-big-blue"
                                      style={{
                                        minHeight: '40px',
                                        padding: '0 18px',
                                        fontSize: '13px',
                                        ...( (selectedGroup?.isSubscriptionExpired || !isTeacherSubActive) ? {
                                          background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                                          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                                          border: 'none'
                                        } : {} )
                                      }}
                                    >
                                      <span>{(selectedGroup?.isSubscriptionExpired || !isTeacherSubActive)
                                        ? (subscription?.targetRole === 'Student' ? "🔒 Hisobot (Tarifni o'tkazing)" : "🔒 Hisobot (Balansni to'ldiring)")
                                        : "Hisobot & Tekshirish"}</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteAssignment(ass.id, ass.title)}
                                      disabled={deletingAssignmentId === ass.id}
                                      title="Vazifani o'chirish"
                                      style={{
                                        background: '#FEE2E2',
                                        color: '#DC2626',
                                        border: '1.5px solid #FECACA',
                                        borderRadius: 'var(--radius-pill)',
                                        padding: '0 14px',
                                        minHeight: '40px',
                                        fontSize: '13px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <Trash2 size={15} />
                                      <span>{deletingAssignmentId === ass.id ? "..." : "O'chirish"}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 2.3 VIEW MODE: O'QUVCHILAR RO'YXATI & TIMELINE */}
                {viewMode === 'students' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', margin: '4px 0' }}>
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', margin: 0 }}>
                          👥 O'quvchilar & Tarix
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          Guruh o'quvchilari ro'yxati va har bir o'quvchining vazifalar tarixi
                        </p>
                      </div>
                      <button
                        onClick={handleSyncMembers}
                        disabled={isSyncing || !selectedGroup}
                        title="Guruhdagi yangi start bosgan o'quvchilarni sinxronlashtirish"
                        className="btn-big-white"
                        style={{
                          minHeight: '40px',
                          padding: '0 16px',
                          fontSize: '13px',
                          ...(!isTeacherSubActive ? { borderColor: '#FCA5A5', color: '#DC2626' } : {})
                        }}
                      >
                        <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                        <span>{isSyncing ? "Yangilanmoqda..." : !isTeacherSubActive ? "🔒 A'zolarni yangilash (Cheklangan)" : "A'zolarni yangilash"}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        onClick={() => setMemberFilter('active')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 'var(--radius-pill)',
                          border: memberFilter === 'active' ? '2px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                          background: memberFilter === 'active' ? 'var(--primary-blue)' : 'var(--pure-white)',
                          color: memberFilter === 'active' ? '#fff' : 'var(--text-navy)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Faol a'zolar
                      </button>
                      <button
                        onClick={() => setMemberFilter('inactive')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 'var(--radius-pill)',
                          border: memberFilter === 'inactive' ? '2px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                          background: memberFilter === 'inactive' ? 'var(--primary-blue)' : 'var(--pure-white)',
                          color: memberFilter === 'inactive' ? '#fff' : 'var(--text-navy)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        O'chirilgan (Yashirilgan)
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                      {filteredMembers.map(m => (
                        <div
                          key={m.studentId}
                          style={{
                            background: 'var(--pure-white)',
                            border: '1.5px solid var(--sky-border)',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            boxShadow: 'var(--shadow-subtle)'
                          }}
                        >
                          <div
                            onClick={() => handleOpenTimeline(m)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                          >
                            <img
                              src={m.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"}
                              alt={m.fullName}
                              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-navy)' }}>{m.fullName}</div>
                              <div style={{ fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 600 }}>Tarixni ko'rish ➔</div>
                            </div>
                          </div>

                          {m.isActive ? (
                            <button
                              onClick={() => handleRemoveMember(m.studentId)}
                              title={!isTeacherSubActive ? "Cheklangan (Faqat Ustoz tarifi)" : "Tizimdan o'chirish"}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: !isTeacherSubActive ? '#94A3B8' : 'var(--status-danger)',
                                cursor: 'pointer',
                                padding: '6px'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreMember(m.studentId)}
                              title={!isTeacherSubActive ? "Cheklangan (Faqat Ustoz tarifi)" : "Qayta qo'shish"}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: !isTeacherSubActive ? '#94A3B8' : 'var(--primary-blue)',
                                cursor: 'pointer',
                                padding: '6px'
                              }}
                            >
                              <RefreshCw size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

            {/* ======================================================== */}
            {/* 3. TAB: KINOLAR (ENGLISH MOVIES FOR TEACHERS)            */}
            {/* ======================================================== */}
            {mainTab === 'movies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Search & Level Filters */}
                <div style={{
                  background: 'var(--pure-white)',
                  borderRadius: '20px',
                  border: '2px solid var(--sky-border)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: 'var(--shadow-subtle)'
                }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Kino yoki serial qidirish..."
                      value={movieSearch}
                      onChange={e => setMovieSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 46px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1.5px solid var(--sky-border)',
                        background: 'var(--ice-blue-bg)',
                        fontSize: '15px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setSelectedMovieLevel(lvl)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: 'var(--radius-pill)',
                          border: selectedMovieLevel === lvl ? '2px solid var(--primary-blue)' : '1.5px solid var(--sky-border)',
                          background: selectedMovieLevel === lvl ? 'var(--primary-blue)' : 'var(--pure-white)',
                          color: selectedMovieLevel === lvl ? '#fff' : 'var(--text-navy)',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        {lvl === 'All' ? 'Barchasi' : lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Movies Grid */}
                {isLoadingMovies ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Kinolar yuklanmoqda...</div>
                ) : filteredMovies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', background: 'var(--pure-white)', borderRadius: '24px', border: '2px dashed var(--sky-border)' }}>
                    <div style={{ fontSize: '44px', marginBottom: '10px' }}>🎬</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>Kinolar topilmadi</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Qidiruv yoki daraja filtrini o'zgartirib ko'ring.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '18px' }}>
                    {filteredMovies.map(movie => (
                      <div
                        key={movie.id}
                        onClick={() => navigate(`/player/${movie.id}`)}
                        style={{
                          background: 'var(--pure-white)',
                          borderRadius: '18px',
                          border: '2px solid var(--sky-border)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', height: '260px', background: '#0F172A' }}>
                          <img
                            src={movie.thumbnailUrl || "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300"}
                            alt={movie.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                            <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                              🇬🇧 EN
                            </span>
                            {movie.level && (
                              <span style={{ background: 'var(--primary-blue)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                                {movie.level}
                              </span>
                            )}
                          </div>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-blue)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
                              <Play size={24} fill="var(--primary-blue)" style={{ marginLeft: '3px' }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '14px' }}>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {movie.title}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{movie.isFilm ? 'Kino' : 'Serial'}</span>
                            <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>Subtitrli</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* 4. TAB: LUG'AT & TEST (VOCABULARY BUILDER FOR TEACHERS)   */}
            {/* ======================================================== */}
            {mainTab === 'vocabulary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Breadcrumbs */}
                {vocabStep !== 'books' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (vocabStep === 'units') setVocabStep('parts');
                        else if (vocabStep === 'parts') setVocabStep('books');
                      }}
                      className="btn-big-white"
                      style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                    >
                      <ArrowLeft size={16} />
                      <span>Orqaga</span>
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-navy)' }}>
                      {selectedVocabBook?.title} {selectedVocabPart ? `➔ ${selectedVocabPart.title}` : ''}
                    </span>
                  </div>
                )}

                {/* 4.1 Books View */}
                {vocabStep === 'books' && (
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '14px' }}>
                      Darsliklar va Lug'atlar
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {vocabBooks.map(book => (
                        <div
                          key={book.id}
                          onClick={() => handleSelectVocabBook(book)}
                          style={{
                            background: 'var(--pure-white)',
                            borderRadius: '18px',
                            border: '2px solid var(--sky-border)',
                            padding: '24px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: 'var(--shadow-card)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--ice-blue-bg)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOpen size={24} />
                            </div>
                            <div>
                              <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-navy)' }}>{book.title}</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{book.description || "Ingliz tili lug'at kitobi"}</div>
                            </div>
                          </div>
                          <ChevronRight size={20} color="var(--primary-blue)" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4.2 Parts View */}
                {vocabStep === 'parts' && (
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '14px' }}>
                      {selectedVocabBook?.title} — Bo'limlar
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                      {vocabParts.map(part => (
                        <div
                          key={part.id}
                          onClick={() => handleSelectVocabPart(part)}
                          style={{
                            background: 'var(--pure-white)',
                            borderRadius: '16px',
                            border: '1.5px solid var(--sky-border)',
                            padding: '18px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: 'var(--shadow-subtle)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-navy)' }}>{part.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{part.partNumber}-qism</div>
                          </div>
                          <ChevronRight size={18} color="var(--primary-blue)" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4.3 Units View */}
                {vocabStep === 'units' && (
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '14px' }}>
                      Unitlar ro'yxati
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {vocabUnits.map(unit => (
                        <div
                          key={unit.id}
                          style={{
                            background: 'var(--pure-white)',
                            borderRadius: '16px',
                            border: '1.5px solid var(--sky-border)',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                            boxShadow: 'var(--shadow-subtle)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-navy)' }}>{unit.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unit #{unit.unitNumber}</div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => openVocabModalForUnit(unit, 'flashcards')}
                              className="btn-big-white"
                              style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px' }}
                            >
                              <Sparkles size={15} />
                              <span>Flashcards</span>
                            </button>

                            <button
                              onClick={() => openVocabModalForUnit(unit, 'quiz')}
                              className="btn-big-blue"
                              style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
                            >
                              <Trophy size={15} />
                              <span>Testdan o'tish</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 6. VOCABULARY FLASHCARD & QUIZ MODAL                     */}
      {/* ======================================================== */}
      {vocabModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--pure-white)',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Top */}
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ice-blue-bg)' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)' }}>{currentVocabTitle}</div>
                <div style={{ fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 700 }}>
                  {vocabMode === 'flashcards' ? "Flashcards (Kartochkalar)" : "4 Variantli Test"}
                </div>
              </div>
              <button onClick={() => setVocabModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 800, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Flashcards View */}
            {vocabMode === 'flashcards' && vocabWords.length > 0 && (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  onClick={() => setIsFlipped(prev => !prev)}
                  style={{
                    background: isFlipped ? 'var(--ice-blue-bg)' : 'var(--pure-white)',
                    border: '2px solid var(--sky-border)',
                    borderRadius: '20px',
                    padding: '36px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-card)'
                  }}
                >
                  {!isFlipped ? (
                    <>
                      <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '8px' }}>
                        {vocabWords[currentWordIdx]?.word}
                      </div>
                      {vocabWords[currentWordIdx]?.ipa && (
                        <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                          /{vocabWords[currentWordIdx]?.ipa}/
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playPronunciation(vocabWords[currentWordIdx]?.word);
                        }}
                        style={{ background: 'var(--ice-blue-bg)', border: '1px solid var(--sky-border)', borderRadius: '9999px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <Volume2 size={16} /> Talaffuzni tinglash
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Tarjimasi:
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '12px' }}>
                        {vocabWords[currentWordIdx]?.translationUz}
                      </div>
                      {vocabWords[currentWordIdx]?.exampleSentence && (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          "{vocabWords[currentWordIdx]?.exampleSentence}"
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    disabled={currentWordIdx === 0}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentWordIdx(prev => Math.max(0, prev - 1));
                    }}
                    className="btn-big-white"
                    style={{ minHeight: '44px', padding: '0 16px', fontSize: '13px' }}
                  >
                    Oldingi
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-navy)' }}>
                    {currentWordIdx + 1} / {vocabWords.length}
                  </span>
                  <button
                    disabled={currentWordIdx === vocabWords.length - 1}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentWordIdx(prev => Math.min(vocabWords.length - 1, prev + 1));
                    }}
                    className="btn-big-blue"
                    style={{ minHeight: '44px', padding: '0 16px', fontSize: '13px' }}
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}

            {/* Quiz View */}
            {vocabMode === 'quiz' && (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!quizFinished ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}>
                      <span>Savol {quizIdx + 1} / {quizQuestions.length}</span>
                      <span style={{ color: 'var(--primary-blue)' }}>Ball: {quizScore}</span>
                    </div>

                    {quizQuestions[quizIdx] && (
                      <div style={{ background: 'var(--ice-blue-bg)', borderRadius: '16px', padding: '20px', textAlign: 'center', border: '1.5px solid var(--sky-border)' }}>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-navy)' }}>
                          {quizQuestions[quizIdx].questionText}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {quizQuestions[quizIdx]?.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          disabled={selectedOption !== null}
                          onClick={() => handleQuizAnswer(oIdx, opt.isCorrect)}
                          style={{
                            minHeight: '50px',
                            borderRadius: 'var(--radius-pill)',
                            border: '1.5px solid var(--sky-border)',
                            background: selectedOption !== null && opt.isCorrect ? '#DCFCE7' : selectedOption === oIdx && !opt.isCorrect ? '#FEE2E2' : '#fff',
                            color: 'var(--text-navy)',
                            fontWeight: 700,
                            fontSize: '15px',
                            cursor: 'pointer',
                            padding: '0 20px',
                            textAlign: 'left'
                          }}
                        >
                          {['A)', 'B)', 'C)', 'D)'][oIdx]} {opt.text}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div style={{ fontSize: '44px', marginBottom: '8px' }}>🏆</div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '6px' }}>
                      Test yakunlandi!
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Natijangiz: {quizScore} / {quizQuestions.length} ({Math.round((quizScore / (quizQuestions.length || 1)) * 100)}%)
                    </div>
                    <button onClick={() => setVocabModalOpen(false)} className="btn-big-blue" style={{ width: '100%', minHeight: '48px', fontSize: '15px' }}>
                      Yakunlash
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7.9. EDIT ASSIGNMENT & EXTEND DEADLINE MODAL             */}
      {/* ======================================================== */}
      {editingAssignment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            border: '1.5px solid var(--sky-border)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1.5px solid var(--sky-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Settings size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)', margin: 0 }}>
                    Topshiriq Sozlamalari & Muddat
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Mavzu, topshirish muddati va qismlar izohini tahrirlash
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingAssignment(null)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)', display: 'block', marginBottom: '6px' }}>
                  📌 Dars mavzusi / Sarlavhasi:
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--sky-border)',
                    fontSize: '14px',
                    fontWeight: 700,
                    background: 'var(--ice-blue-bg)',
                    color: 'var(--text-navy)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Deadline */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)' }}>
                    ⏰ Topshirish muddati (Deadline):
                  </label>
                  {editingAssignment.deadline && new Date(editingAssignment.deadline) <= new Date() && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>
                      Muddati o'tgan (Arxivda)
                    </span>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={e => setEditDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--sky-border)',
                    fontSize: '14px',
                    fontWeight: 700,
                    background: 'var(--ice-blue-bg)',
                    color: 'var(--text-navy)',
                    outline: 'none'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', margin: '4px 0 0' }}>
                  💡 Muddatni kelajakdagi vaqtga uzaytirsangiz, ushbu vazifa avtomatik tarzda "Faol Vazifalar" ro'yxatiga qaytadi va talabalarga ko'rinadi.
                </p>
              </div>

              {/* Items Instructions Edit */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📋 Vazifa qismlari ({editItems.length} ta):</span>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Qismlarni o'chirish/qo'shish taqiqlangan, faqat izohni o'zgartirish mumkin</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editItems.map((it, idx) => (
                    <div key={it.id} style={{
                      background: '#F8FAFC',
                      border: '1px solid var(--sky-border)',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#DBEAFE',
                            color: '#1D4ED8',
                            fontSize: '12px',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)' }}>
                            {it.title}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 8px', borderRadius: '6px' }}>
                          {it.itemType === 'Vocabulary' ? "📖 Lug'at" : it.itemType === 'MediaSubmission' ? "🎙️ Audio/Video" : "📌 Matn"}
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Izoh / Ko'rsatma:
                        </label>
                        <textarea
                          rows={2}
                          value={it.instructions}
                          onChange={e => {
                            const copy = [...editItems];
                            copy[idx].instructions = e.target.value;
                            setEditItems(copy);
                          }}
                          placeholder="Ushbu topshiriq uchun o'quvchilarga ko'rsatma yoki izoh..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--sky-border)',
                            fontSize: '13px',
                            color: 'var(--text-navy)',
                            background: '#fff',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1.5px solid var(--sky-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#F8FAFC'
            }}>
              <button
                type="button"
                onClick={() => setEditingAssignment(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#64748B',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={handleSaveEditAssignment}
                disabled={isSavingEdit}
                className="btn-big-blue"
                style={{
                  minHeight: '40px',
                  padding: '0 22px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Saqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>O'zgarishlarni saqlash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. FULL-SCREEN REPORT & REVIEW ("Hisobot va tekshirish")   */}
      {/* ======================================================== */}
      {showReportModal && selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#F8FAFC',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          paddingBottom: 'calc(40px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))'
        }}>
          {/* Top Sticky Bar */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--pure-white)',
            borderBottom: '1.5px solid var(--sky-border)',
            paddingTop: 'calc(14px + var(--safe-area-top, env(safe-area-inset-top, 0px)))',
            paddingBottom: '14px',
            paddingLeft: 'calc(16px + var(--safe-area-left, env(safe-area-inset-left, 0px)))',
            paddingRight: 'calc(16px + var(--safe-area-right, env(safe-area-inset-right, 0px)))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <button
              onClick={() => {
                setShowReportModal(false);
                setDetailReviewStudent(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--ice-blue-bg)',
                border: '1.5px solid var(--sky-border)',
                color: 'var(--primary-blue)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
              <span>Ortga</span>
            </button>

            <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📋 {selectedReport.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedReport.groupTitle} • Jami {selectedReport.totalMembersCount} o'quvchi
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => handleDeleteAssignment(selectedReport.assignmentId, selectedReport.title)}
                disabled={deletingAssignmentId === selectedReport.assignmentId}
                title="Vazifani o'chirish"
                style={{
                  background: '#FEE2E2',
                  color: '#DC2626',
                  border: '1.5px solid #FECACA',
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
                <Trash2 size={14} />
                <span>O'chirish</span>
              </button>

              {selectedReport.missingCount > 0 && (
                <button
                  onClick={handleRemindMissing}
                  disabled={isReminding}
                  style={{
                    background: '#DC2626',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={14} />
                  <span>Eslatma ({selectedReport.missingCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Body Content */}
          {(() => {
            const allStudents = [
              ...(selectedReport.submittedStudents || []),
              ...(selectedReport.missingStudents || [])
            ];

            const fullCount = allStudents.filter(s => s.status === 1).length;
            const punishmentCount = allStudents.filter(s => s.status === 0 || s.items?.some(i => i.mySubmissionStatus === 0)).length;
            const punishedCount = allStudents.filter(s => s.status === 2).length;
            const pendingCount = allStudents.filter(s => s.status !== 1 && s.status !== 0 && s.status !== 2).length;

            const filteredStudents = allStudents.filter(s => {
              if (reportFilter === 'full_done') return s.status === 1;
              if (reportFilter === 'punishment') return s.status === 0 || s.items?.some(i => i.mySubmissionStatus === 0);
              if (reportFilter === 'punished') return s.status === 2;
              if (reportFilter === 'pending') return s.status !== 1 && s.status !== 0 && s.status !== 2;
              return true; // 'all'
            });

            return (
              <div style={{ maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '20px 16px 80px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 4 Core Status Filters */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  scrollbarWidth: 'none'
                }}>
                  {[
                    { key: 'all', label: `Barchasi (${allStudents.length})`, bg: '#F1F5F9', activeBg: 'var(--primary-blue)', color: 'var(--text-navy)', activeColor: '#fff' },
                    { key: 'full_done', label: `✅ Full done (${fullCount})`, bg: '#DCFCE7', activeBg: '#16A34A', color: '#15803D', activeColor: '#fff' },
                    { key: 'punishment', label: `❌ Punishment (${punishmentCount})`, bg: '#FEE2E2', activeBg: '#DC2626', color: '#B91C1C', activeColor: '#fff' },
                    { key: 'punished', label: `⚠️ Punished (${punishedCount})`, bg: '#FEF3C7', activeBg: '#D97706', color: '#B45309', activeColor: '#fff' },
                    { key: 'pending', label: `⏳ Kutilmoqda (${pendingCount})`, bg: '#E0F2FE', activeBg: '#0284C7', color: '#0369A1', activeColor: '#fff' },
                  ].map(t => {
                    const isActive = reportFilter === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setReportFilter(t.key as any)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: isActive ? t.activeBg : t.bg,
                          color: isActive ? t.activeColor : t.color,
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {remindSuccess && (
                  <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                    ✅ {remindSuccess}
                  </div>
                )}

                {/* Overall Summary Stats Cards (ONLY on 'all' tab before student cards) */}
                {reportFilter === 'all' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Stat Cards Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px'
                    }}>
                      {/* Card 1: Jami o'quvchilar */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1.5px solid var(--sky-border)',
                        boxShadow: 'var(--shadow-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#EFF6FF',
                          color: 'var(--primary-blue)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Users size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-navy)', lineHeight: 1.1 }}>
                            {allStudents.length}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '3px' }}>
                            Jami o'quvchilar
                          </div>
                        </div>
                      </div>

                      {/* Card 2: To'liq bajardi (Full done) */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1.5px solid #BBF7D0',
                        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#DCFCE7',
                          color: '#16A34A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <CheckCircle2 size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#15803D', lineHeight: 1.1 }}>
                            {fullCount}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', marginTop: '3px' }}>
                            To'liq bajardi
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Jarima (Punishment) */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1.5px solid #FECACA',
                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <XCircle size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#B91C1C', lineHeight: 1.1 }}>
                            {punishmentCount}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626', marginTop: '3px' }}>
                            Jarima qo'llandi
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Jarima bajarildi (Punished) */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1.5px solid #FDE68A',
                        boxShadow: '0 2px 8px rgba(217, 119, 6, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#FEF3C7',
                          color: '#D97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <AlertTriangle size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#B45309', lineHeight: 1.1 }}>
                            {punishedCount}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', marginTop: '3px' }}>
                            Jarima bajarildi
                          </div>
                        </div>
                      </div>

                      {/* Card 5: Kutilmoqda (Pending) */}
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1.5px solid #BAE6FD',
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: '#E0F2FE',
                          color: '#0284C7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Clock size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0369A1', lineHeight: 1.1 }}>
                            {pendingCount}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7', marginTop: '3px' }}>
                            Kutilmoqda
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Percentage Banner */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      padding: '12px 16px',
                      border: '1.5px solid var(--sky-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-navy)' }}>
                          📊 Topshirish ko'rsatkichi:
                        </span>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 900,
                          color: fullCount === allStudents.length ? '#16A34A' : 'var(--primary-blue)',
                          background: fullCount === allStudents.length ? '#DCFCE7' : 'var(--ice-blue-bg)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)'
                        }}>
                          {allStudents.length > 0 ? Math.round((fullCount / allStudents.length) * 100) : 0}%
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {fullCount} / {allStudents.length} o'quvchi to'liq yakunladi
                      </div>
                    </div>
                  </div>
                )}

                {/* Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: '16px', border: '1.5px dashed var(--sky-border)', color: 'var(--text-muted)' }}>
                      Ushbu filtr bo'yicha talabalar mavjud emas.
                    </div>
                  ) : (
                    filteredStudents.map(st => {
                      const isPunished = st.status === 2;
                      const isPunishment = st.status === 0 || st.items?.some(i => i.mySubmissionStatus === 0);
                      const isFullDone = st.status === 1;

                      return (
                        <div
                          key={st.studentId}
                          style={{
                            background: '#fff',
                            borderRadius: '16px',
                            border: isPunishment ? '2px solid #FCA5A5' : isFullDone ? '2px solid #86EFAC' : isPunished ? '2px solid #FCD34D' : '1.5px solid var(--sky-border)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: 'var(--shadow-subtle)'
                          }}
                        >
                          {/* Student Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={st.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"}
                                alt={st.fullName}
                                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--sky-border)' }}
                              />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)' }}>
                                  {st.fullName}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {st.username && <span>@{st.username}</span>}
                                  {st.submittedAt && (
                                    <span>• {new Date(st.submittedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div>
                              {isPunishment ? (
                                <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <XCircle size={14} /> Punishment (Jarima)
                                </span>
                              ) : isPunished ? (
                                <span style={{ background: '#FEF3C7', color: '#B45309', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <AlertTriangle size={14} /> Punished (Jarima bajardi)
                                </span>
                              ) : isFullDone ? (
                                <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <CheckCircle2 size={14} /> Full done
                                </span>
                              ) : (
                                <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <Clock size={14} /> Kutilmoqda
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Punishment explanation alert if any */}
                          {st.comment && isPunishment && (
                            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#991B1B' }}>
                              🚨 <b>Jazo izohi:</b> "{st.comment}"
                            </div>
                          )}

                          {/* Items Rows (Clean rows, item title + status + individual actions) */}
                          {st.items && st.items.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#F8FAFC', borderRadius: '12px', padding: '10px', border: '1px solid var(--sky-border)' }}>
                              {st.items.map((item: any) => (
                                <div
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '13px',
                                    padding: '6px 10px',
                                    borderRadius: '10px',
                                    background: item.mySubmissionStatus === 0 ? '#FEF2F2' : item.mySubmissionStatus === 1 ? '#F0FDF4' : item.mySubmissionStatus === 2 ? '#FFFBEB' : '#fff',
                                    border: item.mySubmissionStatus === 0 ? '1px solid #FECACA' : item.mySubmissionStatus === 1 ? '1px solid #BBF7D0' : item.mySubmissionStatus === 2 ? '1px solid #FDE68A' : '1px solid var(--sky-border)',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{item.itemType === 'video' || item.itemType === 'MediaSubmission' ? '🎬' : item.itemType === 'audio' ? '🎙️' : item.itemType === 'vocab' || item.itemType === 'Vocabulary' ? '📚' : item.itemType === 'test' ? '📝' : '📄'}</span>
                                    <span>{item.title}</span>
                                  </span>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span>
                                      {item.mySubmissionStatus === 1 ? (
                                        <span style={{ color: '#15803D', fontWeight: 800, fontSize: '11px', background: '#DCFCE7', padding: '3px 8px', borderRadius: '6px' }}>✅ Bajarildi</span>
                                      ) : item.mySubmissionStatus === 0 ? (
                                        <span style={{ color: '#B91C1C', fontWeight: 800, fontSize: '11px', background: '#FEE2E2', padding: '3px 8px', borderRadius: '6px' }}>❌ Jarima</span>
                                      ) : item.mySubmissionStatus === 2 ? (
                                        <span style={{ color: '#B45309', fontWeight: 800, fontSize: '11px', background: '#FEF3C7', padding: '3px 8px', borderRadius: '6px' }}>⚠️ Jarima bajardi</span>
                                      ) : item.attachments?.length ? (
                                        <span style={{ color: '#0369A1', fontWeight: 800, fontSize: '11px', background: '#E0F2FE', padding: '3px 8px', borderRadius: '6px' }}>⏳ Tekshirilmoqda</span>
                                      ) : (
                                        <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '11px' }}>— Topshirilmagan</span>
                                      )}
                                    </span>

                                    {/* Quick Item Action Buttons */}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button
                                        title="Bajarildi deb belgilash"
                                        onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, st.studentId, 1, item.title, st.fullName)}
                                        style={{
                                          border: item.mySubmissionStatus === 1 ? '1.5px solid #16A34A' : '1px solid #BBF7D0',
                                          background: item.mySubmissionStatus === 1 ? '#16A34A' : '#DCFCE7',
                                          color: item.mySubmissionStatus === 1 ? '#fff' : '#15803D',
                                          borderRadius: '6px',
                                          padding: '3px 7px',
                                          fontSize: '11px',
                                          fontWeight: 800,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        title="Jarima qo'llash"
                                        onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, st.studentId, 0, item.title, st.fullName)}
                                        style={{
                                          border: item.mySubmissionStatus === 0 ? '1.5px solid #DC2626' : '1px solid #FECACA',
                                          background: item.mySubmissionStatus === 0 ? '#DC2626' : '#FEE2E2',
                                          color: item.mySubmissionStatus === 0 ? '#fff' : '#B91C1C',
                                          borderRadius: '6px',
                                          padding: '3px 7px',
                                          fontSize: '11px',
                                          fontWeight: 800,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✕
                                      </button>
                                      {item.mySubmissionStatus !== null && item.mySubmissionStatus !== undefined && (
                                        <button
                                          title="Bekor qilish"
                                          onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, st.studentId, -1, item.title, st.fullName)}
                                          style={{
                                            border: '1px solid #CBD5E1',
                                            background: '#fff',
                                            color: '#64748B',
                                            borderRadius: '6px',
                                            padding: '3px 6px',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ↺
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions Row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                            <button
                              onClick={() => setDetailReviewStudent(st)}
                              style={{
                                background: 'var(--ice-blue-bg)',
                                border: '1.5px solid var(--sky-border)',
                                color: 'var(--primary-blue)',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Eye size={15} />
                              <span>Ko'rish & Tekshirish</span>
                            </button>

                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, st.studentId, 1)}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  border: isFullDone ? '2px solid #16A34A' : '1px solid #BBF7D0',
                                  background: isFullDone ? '#16A34A' : '#DCFCE7',
                                  color: isFullDone ? '#fff' : '#15803D',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Check size={14} />
                                <span>Bajarildi</span>
                              </button>

                              {isPunishment && (
                                <button
                                  onClick={() => setResolvePenaltyStudent(st)}
                                  style={{
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #F59E0B',
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
                                  }}
                                >
                                  <AlertTriangle size={14} />
                                  <span>Jarimalar bajarildi</span>
                                </button>
                              )}

                              {st.status !== null && (
                                <button
                                  onClick={() => handleSetStudentStatus(selectedReport.assignmentId, st.studentId, -1)}
                                  style={{
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--sky-border)',
                                    background: '#fff',
                                    color: 'var(--text-muted)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ↺ Bekor
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ======================================================== */}
      {/* 8.1. DETAIL REVIEW MODAL ("Ko'rish & Tekshirish" - Large Media) */}
      {/* ======================================================== */}
      {detailReviewStudent && selectedReport && (
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
            maxWidth: '680px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ice-blue-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={detailReviewStudent.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"}
                  alt={detailReviewStudent.fullName}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-navy)' }}>
                    {detailReviewStudent.fullName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {selectedReport.title}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailReviewStudent(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 800, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Items with Large Media */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {detailReviewStudent.items && detailReviewStudent.items.length > 0 ? (
                detailReviewStudent.items.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: 'var(--ice-blue-bg)',
                      border: '1.5px solid var(--sky-border)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{item.itemType === 'video' || item.itemType === 'MediaSubmission' ? '🎬' : item.itemType === 'audio' ? '🎙️' : item.itemType === 'vocab' || item.itemType === 'Vocabulary' ? '📚' : item.itemType === 'test' ? '📝' : '📄'}</span>
                        <span>{item.title}</span>
                      </div>
                      <div>
                        {item.mySubmissionStatus === 1 ? (
                          <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                            ✅ Bajarildi
                          </span>
                        ) : item.mySubmissionStatus === 0 ? (
                          <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                            ❌ Jarima
                          </span>
                        ) : item.mySubmissionStatus === 2 ? (
                          <span style={{ background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                            ⚠️ Jarima bajardi
                          </span>
                        ) : (
                          <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                            {item.attachments?.length ? '⏳ Tekshirilmoqda' : '— Topshirilmagan'}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.instructions && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {item.instructions}
                      </div>
                    )}

                    {item.mySubmissionComment && (
                      <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--sky-border)', fontSize: '13px', color: 'var(--text-navy)', fontStyle: 'italic' }}>
                        💬 Talaba izohi: "{item.mySubmissionComment}"
                      </div>
                    )}

                    {/* Large Media Previews */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        {item.attachments.map((att: any) => (
                          <div key={att.id} style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '1.5px solid var(--sky-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                Biriktirilgan fayl ({att.fileType})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachmentByTeacher(att.id)}
                                title="Talabaning ushbu faylini o'chirish"
                                style={{
                                  background: '#FEE2E2',
                                  border: '1px solid #FECACA',
                                  color: '#DC2626',
                                  borderRadius: '8px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Faylni o'chirish</span>
                              </button>
                            </div>
                            {att.fileType === 'photo' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <img
                                  src={att.streamUrl}
                                  alt="Submission"
                                  style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', background: '#F8FAFC' }}
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
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
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
                                      <span>🖼️ Rasmni Telegram botda ko'rish</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : att.fileType === 'audio' || att.fileType === 'voice' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Volume2 size={16} color="var(--primary-blue)" />
                                  <span>Ovozli xabar / Audio</span>
                                </div>
                                <audio controls src={att.streamUrl} style={{ width: '100%' }} />
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
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
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
                                      <span>🎙️ Ovozni Telegram botda eshitish</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <video
                                  controls
                                  playsInline
                                  src={att.streamUrl}
                                  style={{ width: '100%', maxHeight: '380px', borderRadius: '8px', background: '#000' }}
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
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
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
                                      <span>🎬 Videoni Telegram botda ko'rish</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Individual Item Status Control in Modal */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(226, 232, 240, 0.8)',
                      marginTop: '6px'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Qism statusini belgilash:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, detailReviewStudent.studentId, 1, item.title, detailReviewStudent.fullName)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: item.mySubmissionStatus === 1 ? '2px solid #16A34A' : '1px solid #BBF7D0',
                            background: item.mySubmissionStatus === 1 ? '#16A34A' : '#DCFCE7',
                            color: item.mySubmissionStatus === 1 ? '#fff' : '#15803D',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Bajarildi
                        </button>
                        <button
                          onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, detailReviewStudent.studentId, 0, item.title, detailReviewStudent.fullName)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: item.mySubmissionStatus === 0 ? '2px solid #DC2626' : '1px solid #FECACA',
                            background: item.mySubmissionStatus === 0 ? '#DC2626' : '#FEE2E2',
                            color: item.mySubmissionStatus === 0 ? '#fff' : '#B91C1C',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Jarima
                        </button>
                        {item.mySubmissionStatus !== null && item.mySubmissionStatus !== undefined && (
                          <button
                            onClick={() => handleSetItemStatus(selectedReport.assignmentId, item.id, detailReviewStudent.studentId, -1, item.title, detailReviewStudent.fullName)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--sky-border)',
                              background: '#fff',
                              color: 'var(--text-muted)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ↺ Bekor
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Vazifa qismlari topilmadi
                </div>
              )}
            </div>

            {/* Bottom Status Buttons */}
            <div style={{ padding: '16px 20px', borderTop: '1.5px solid var(--sky-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', background: '#F8FAFC' }}>
              <button
                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, detailReviewStudent.studentId, 1)}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16A34A',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.2)'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Bajarildi (Full done)</span>
              </button>

              {(detailReviewStudent.items?.some((i: any) => i.mySubmissionStatus === 0) || detailReviewStudent.status === 0) && (
                <button
                  onClick={() => setResolvePenaltyStudent(detailReviewStudent)}
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #F59E0B',
                    background: '#FEF3C7',
                    color: '#B45309',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>Jarimalar bajarildi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8.2. MANDATORY PUNISHMENT COMMENT MODAL                  */}
      {/* ======================================================== */}
      {penaltyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            maxWidth: '500px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid #FCA5A5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 900, fontSize: '18px' }}>
                <AlertTriangle size={22} />
                <span>Jazo (Punishment) qo'llash</span>
              </div>
              <button
                onClick={() => setPenaltyModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 800, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
              Talaba: <b>{penaltyModal.studentName}</b>
              {penaltyModal.itemTitle && (
                <>
                  <br />
                  Qism: <b style={{ color: 'var(--primary-blue)' }}>{penaltyModal.itemTitle}</b>
                </>
              )}
              <br />
              Iltimos, ushbu o'quvchiga qo'llaniladigan jazo va vazifani batafsil yozing:
            </div>

            <textarea
              rows={4}
              value={penaltyComment}
              onChange={e => {
                setPenaltyComment(e.target.value);
                if (penaltyError) setPenaltyError(null);
              }}
              placeholder="Masalan: 50 ta yangi so'z yozish va ovozli o'qib berish, yoki mavzuni qaytadan gapirib berish..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '2px solid #EF4444',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />

            {penaltyError && (
              <div style={{ color: '#DC2626', fontSize: '13px', fontWeight: 700 }}>
                ⚠️ {penaltyError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPenaltyModal(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--sky-border)',
                  background: '#fff',
                  color: 'var(--text-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Bekor qilish
              </button>

              <button
                onClick={handleConfirmPenalty}
                disabled={isSubmittingPenalty || !penaltyComment.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: penaltyComment.trim() ? 'pointer' : 'not-allowed',
                  opacity: penaltyComment.trim() ? 1 : 0.6
                }}
              >
                {isSubmittingPenalty ? 'Saqlanmoqda...' : '🚨 Jarima qo\'llash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8.3. JARIMALAR BAJARILDI / RESOLVE PENALTIES MODAL       */}
      {/* ======================================================== */}
      {resolvePenaltyStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 130,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid #FDE68A',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1.5px solid var(--sky-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFBEB'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#B45309', fontWeight: 900, fontSize: '17px' }}>
                <AlertTriangle size={22} color="#D97706" />
                <span>Jarimalarni ko'rib chiqish va bajarilgan deb belgilash</span>
              </div>
              <button
                onClick={() => setResolvePenaltyStudent(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 800, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Student Info */}
            <div style={{ padding: '16px 24px 10px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #F1F5F9' }}>
              <img
                src={resolvePenaltyStudent.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"}
                alt={resolvePenaltyStudent.fullName}
                style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #FDE68A' }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-navy)' }}>
                  {resolvePenaltyStudent.fullName}
                </div>
                <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 700 }}>
                  ⚠️ Quyidagi topshiriqlar bo'yicha jarima qo'llanilgan:
                </div>
              </div>
            </div>

            {/* Penalized Items List */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {(() => {
                const penalizedItems = (resolvePenaltyStudent.items || []).filter((i: any) => i.mySubmissionStatus === 0);
                if (penalizedItems.length === 0) {
                  return (
                    <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px', padding: '14px', color: '#991B1B', fontSize: '13px' }}>
                      <div style={{ fontWeight: 800, marginBottom: '4px' }}>Umumiy topshiriq jarimasi:</div>
                      <div>💬 "{resolvePenaltyStudent.comment || 'Jazo qo\'llanilgan'}"</div>
                    </div>
                  );
                }

                return penalizedItems.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#FFFBEB',
                      border: '1.5px solid #FDE68A',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{item.itemType === 'video' || item.itemType === 'MediaSubmission' ? '🎬' : item.itemType === 'audio' ? '🎙️' : item.itemType === 'vocab' || item.itemType === 'Vocabulary' ? '📚' : '📝'}</span>
                        <span>{item.title}</span>
                      </div>
                      <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                        ❌ Jarima
                      </span>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#991B1B' }}>
                      🚨 <b>Jazo izohi:</b> "{item.mySubmissionComment || resolvePenaltyStudent.comment || 'Jazo izohi kiritilmagan'}"
                    </div>

                    {/* Media Attachments if available */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        {item.attachments.map((att: any) => (
                          <div key={att.id} style={{ background: '#fff', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              📎 {att.fileType}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSendAttachmentToBot(att.id)}
                              disabled={sendingAttId === att.id}
                              style={{
                                background: 'var(--ice-blue-bg)',
                                border: '1px solid var(--sky-border)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--primary-blue)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <ExternalLink size={12} />
                              <span>Botda ochish</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* Footer with Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1.5px solid var(--sky-border)',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              background: '#F8FAFC'
            }}>
              <button
                type="button"
                onClick={() => setResolvePenaltyStudent(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--sky-border)',
                  background: '#fff',
                  color: 'var(--text-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Bekor qilish
              </button>

              <button
                type="button"
                onClick={() => handleResolveStudentPenalties(resolvePenaltyStudent)}
                disabled={isResolvingPenalties}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16A34A',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: isResolvingPenalties ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isResolvingPenalties ? 'Saqlanmoqda...' : 'Jarimalarni bajarilgan deb hisoblash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. STUDENT TIMELINE MODAL (CHAT-STYLE HISTORY)           */}
      {/* ======================================================== */}
      {showTimelineModal && selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--pure-white)',
            borderRadius: '24px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ice-blue-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={selectedStudent.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"} alt={selectedStudent.fullName} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-navy)' }}>{selectedStudent.fullName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 700 }}>Topshiriqlar Tarixi (Timeline)</div>
                </div>
              </div>
              <button onClick={() => setShowTimelineModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 800, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isLoadingTimeline ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Tarix yuklanmoqda...</div>
              ) : studentTimeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Topshiriqlar tarixi topilmadi.</div>
              ) : (
                studentTimeline.map(tl => (
                  <div key={tl.assignmentId} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Chat-style Date Chip */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ background: 'var(--sky-border)', color: 'var(--text-navy)', padding: '4px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 800 }}>
                        📅 {new Date(tl.createdAt).toLocaleDateString('uz-UZ', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div style={{ background: 'var(--ice-blue-bg)', borderRadius: '16px', padding: '14px', border: '1px solid var(--sky-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-navy)' }}>
                        {tl.title}
                      </div>

                      {/* Sections with Status */}
                      {tl.items.map(it => (
                        <div key={it.id} style={{ background: '#fff', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', border: '1px solid var(--sky-border)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-navy)' }}>{it.title}</span>
                          <div>
                            {it.mySubmissionStatus === 1 ? (
                              <span style={{ color: '#15803D', fontWeight: 800 }}>✅ 1 Bajarildi</span>
                            ) : it.mySubmissionStatus === 0 ? (
                              <span style={{ color: '#B91C1C', fontWeight: 800 }}>❌ 0 Jarima</span>
                            ) : it.mySubmissionStatus === 2 ? (
                              <span style={{ color: '#B45309', fontWeight: 800 }}>⚠️ 2 Jarima</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>⏳ Topshirilmagan</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* GROUP SELECTION BOTTOM SHEET / DRAWER                     */}
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
              {isLoadingGroups ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
              ) : groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px', fontSize: '16px' }}>
                    Guruhlar topilmadi
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-navy-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    O'quvchilaringiz mavjud bo'lgan Telegram guruhingizga <b>@lanswitchbot</b> ni qo'shing va administrator qiling.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGroupDrawer(false);
                        handleAddGroupClick();
                      }}
                      className="btn-big-blue"
                      style={{ width: '100%', minHeight: '44px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Send size={16} />
                      <span>➕ Botni guruhga qo'shish</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowGroupDrawer(false);
                        try {
                          await setRole('Student');
                        } catch (e) {
                          console.warn(e);
                        }
                        localStorage.setItem('lanswitch_last_route', '/student');
                        const search = window.location.search || '';
                        navigate(`/student${search}`);
                      }}
                      className="btn-big-white"
                      style={{ width: '100%', minHeight: '42px', fontSize: '13px' }}
                    >
                      <span>🎓 Talaba rejimiga o'tish</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {groups.map(g => {
                    const isSelected = selectedGroup?.id === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          handleSelectGroup(g);
                          setShowGroupDrawer(false);
                        }}
                        style={{
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-card-sm)',
                          border: (g.isGroupLimitExceeded || g.isSubscriptionExpired)
                            ? '1.5px solid #FCA5A5'
                            : isSelected
                            ? '2px solid var(--primary-blue)'
                            : '1.5px solid var(--sky-border)',
                          background: (g.isGroupLimitExceeded || g.isSubscriptionExpired)
                            ? '#FEF2F2'
                            : isSelected
                            ? 'var(--ice-blue-bg)'
                            : 'var(--pure-white)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {g.isGroupLimitExceeded ? (
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
                              marginBottom: '6px'
                            }}>
                              <AlertTriangle size={12} color="#DC2626" />
                              <span>Limit oshib ketgan ({g.currentGroupCount}/{g.groupLimit}) - Guruh ishlamaydi</span>
                            </div>
                          ) : (!isTeacherSubActive || g.isSubscriptionExpired) && (
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
                              marginBottom: '6px'
                            }}>
                              <AlertTriangle size={12} color="#DC2626" />
                              <span>{subscription?.targetRole === 'Student' ? "🔒 Boshqaruv cheklangan (Student Premium)" : "Tarif muddati tugagan (Topshiriqlar ko'rinmaydi)"}</span>
                            </div>
                          )}
                          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.title}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {g.memberCount} ta a'zo • Telegram ID: {g.telegramChatId}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {g.isOwner && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupToDelete(g);
                              }}
                              title="Guruhni o'chirish"
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

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
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupDrawer(false);
                      handleAddGroupClick();
                    }}
                    className="btn-big-blue"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '6px'
                    }}
                  >
                    <PlusCircle size={16} />
                    <span>➕ Yangi guruh ulash</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GROUP DELETION CONFIRMATION MODAL */}
      {groupToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--pure-white)',
            borderRadius: '24px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid #FCA5A5'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#DC2626'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h3 style={{
              fontSize: '20px',
              fontWeight: 900,
              color: '#B91C1C',
              textAlign: 'center',
              margin: '0 0 10px 0'
            }}>
              Guruhni o'chirishni tasdiqlaysizmi?
            </h3>

            <p style={{
              fontSize: '14px',
              color: 'var(--text-navy)',
              lineHeight: 1.6,
              textAlign: 'center',
              margin: '0 0 16px 0'
            }}>
              Haqiqatan ham <strong>"{groupToDelete.title}"</strong> guruhini o'chirmoqchimisiz?
            </p>

            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '12px',
              padding: '14px',
              color: '#991B1B',
              fontSize: '13px',
              lineHeight: 1.5,
              marginBottom: '24px'
            }}>
              ⚠️ <strong>DIQQAT:</strong> Ushbu guruh o'chirilganda unga tegishli barcha ma'lumotlar (vazifalar, o'quvchilar topshirgan ishlar va hisobotlar) o'chib ketadi!
              <br /><br />
              <span style={{ fontSize: '12px', color: '#B91C1C' }}>
                ℹ️ <i>Xavfsizlik maqsadida barcha ma'lumotlar alohida arxiv bazasiga to'liq nusxalanadi va saqlanadi.</i>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                disabled={isDeletingGroup}
                className="btn-big-white"
                style={{ flex: 1, minHeight: '44px', fontSize: '14px', fontWeight: 800 }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                disabled={isDeletingGroup}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: isDeletingGroup ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={16} />
                <span>{isDeletingGroup ? "O'chirilmoqda..." : "Ha, o'chirilsin"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FIXED BOTTOM NAVIGATION BAR                              */}
      {/* ======================================================== */}
      {viewMode !== 'create_assignment' && (
        <BottomNav
          role="teacher"
          activeTab={
            mainTab === 'movies'
              ? 'movies'
              : mainTab === 'vocabulary'
              ? 'vocabulary'
              : viewMode === 'students'
              ? 'students'
              : 'assignments'
          }
          onChangeTab={(tabId) => {
            if (tabId === 'movies') {
              setMainTab('movies');
              loadMovies();
            } else if (tabId === 'vocabulary') {
              setMainTab('vocabulary');
              loadVocabBooks();
            } else {
              setMainTab('classroom');
              setViewMode(tabId as 'assignments' | 'students');
            }
          }}
          badgeCount={0}
        />
      )}

      <SubscriptionPlansModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscriptionUpdated={() => {
          checkSubscription();
          loadGroups();
        }}
      />
    </div>
  );
}
