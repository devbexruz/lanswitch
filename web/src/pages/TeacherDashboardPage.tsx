import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { 
  TeacherGroup, CreateAssignmentPayload, AssignmentSummary, 
  AssignmentReport, GroupMember, StudentTimelineAssignment,
  Book, BookPart, BookUnit, BookWord, QuizQuestion
} from '../utils/api';
import { 
  PlusCircle, CheckCircle2, XCircle, AlertTriangle, 
  Send, BookOpen, ChevronRight, ChevronLeft, RefreshCw, Clock, Shield,
  Trash2, UserCheck, Eye, Volume2, Play, Search, ArrowLeft, Trophy, Sparkles, Check,
  Film, Library, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from '../components/ProfileDropdown';
import BottomNav from '../components/BottomNav';

export default function TeacherDashboardPage() {
  const { user, isAuthenticated, checkAuth } = useAuth();
  const navigate = useNavigate();

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
  const [viewMode, setViewMode] = useState<'assignments' | 'students'>(() => {
    const saved = localStorage.getItem('lanswitch_teacher_view_mode');
    return (saved === 'assignments' || saved === 'students') ? saved : 'assignments';
  });
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
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

  // Punishment Comment Modal State
  const [penaltyModal, setPenaltyModal] = useState<{ assignmentId: number; studentId: number; studentName: string } | null>(null);
  const [penaltyComment, setPenaltyComment] = useState('');
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const [isSubmittingPenalty, setIsSubmittingPenalty] = useState(false);

  // Student Detail Review Modal ("Ko'rish & Tekshirish")
  const [detailReviewStudent, setDetailReviewStudent] = useState<any | null>(null);

  // Create Assignment Modal State (NO DEADLINE INPUT)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customTitle, setCustomTitle] = useState(`${new Date().toLocaleDateString('ru-RU')} Lesson`);
  const [items, setItems] = useState<Array<{
    orderIndex: number;
    itemType: 'TextReminder' | 'Vocabulary' | 'MediaSubmission';
    title: string;
    instructions: string;
    targetUnitId?: number;
    vocabMode?: 'book' | 'custom';
  }>>([
    { orderIndex: 1, itemType: 'TextReminder', title: 'Reading Task', instructions: 'Read Reader Book chapter 4' },
    { orderIndex: 2, itemType: 'Vocabulary', title: 'Vocabulary Unit 4', instructions: 'Learn 20 words and pass quiz', targetUnitId: 4, vocabMode: 'book' },
    { orderIndex: 3, itemType: 'MediaSubmission', title: 'Speaking Homework', instructions: '1-minute audio describing hometown' }
  ]);

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
    localStorage.setItem('lanswitch_last_route', '/teacher');
  }, []);

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

    if (res.length > 0) {
      const savedGroupId = localStorage.getItem('lanswitch_teacher_selected_group_id');
      const found = res.find(g => g.id.toString() === savedGroupId) || res.find(g => g.id === selectedGroup?.id);
      const target = found || res[0];
      setSelectedGroup(target);
      loadGroupAssignments(target.id, currentTeacherId);
      loadMembers(target.id);
    } else {
      setSelectedGroup(null);
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
    const rep = await api.getAssignmentReport(assignmentId, user?.id);
    if (rep) {
      setSelectedReport(rep);
      setShowReportModal(true);
      setReportFilter('all');
      setRemindSuccess(null);
      setDetailReviewStudent(null);
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

  const handleConfirmPenalty = async () => {
    if (!penaltyModal) return;
    if (!penaltyComment.trim()) {
      setPenaltyError("Jarima qo'llash uchun jazo izohi yozilishi shart!");
      return;
    }

    setIsSubmittingPenalty(true);
    setPenaltyError(null);
    try {
      const res = await api.setStudentAssignmentStatus(
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

  const handleRemoveMember = async (studentId: number) => {
    if (!selectedGroup) return;
    if (!window.confirm("Haqiqatdan ham ushbu o'quvchini tizimdan o'chirmoqchimisiz? (Telegram guruhdan chiqarilmaydi, faqat tizimda yashiriladi)")) return;
    const ok = await api.removeMember(selectedGroup.id, studentId, user?.id);
    if (ok) {
      await loadMembers(selectedGroup.id);
      await loadGroups();
    }
  };

  const handleRestoreMember = async (studentId: number) => {
    if (!selectedGroup) return;
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

  // Create Assignment
  const handleCreateAssignment = async () => {
    if (!selectedGroup) return;
    const payload: CreateAssignmentPayload = {
      groupId: selectedGroup.id,
      title: customTitle,
      deadline: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      items: items.map((it, idx) => ({ ...it, orderIndex: idx + 1 }))
    };

    await api.createAssignment(payload, user?.id);
    setShowCreateModal(false);
    alert('Vazifa muvaffaqiyatli yaratildi va Telegram guruhga e\'lon qilindi!');
    loadGroupAssignments(selectedGroup.id);
  };

  const handleAddItem = (type: 'TextReminder' | 'Vocabulary' | 'MediaSubmission') => {
    let title = 'Reading Task';
    let instructions = 'Darslikdagi matnni o\'qib kelish';
    let targetUnitId = undefined;

    if (type === 'Vocabulary') {
      title = `So'z boyligi (${items.length + 1}-qism)`;
      instructions = '20 ta yangi so\'zni flashcard orqali yodlang va testdan o\'ting';
      targetUnitId = 4;
    } else if (type === 'MediaSubmission') {
      title = `Speaking / Audio (${items.length + 1}-qism)`;
      instructions = 'Topshiriq bo\'yicha 1 daqiqalik audio yoki video yuboring';
    }

    setItems([...items, {
      orderIndex: items.length + 1,
      itemType: type,
      title,
      instructions,
      targetUnitId,
      vocabMode: 'book'
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Load Books Hierarchy for Create Assignment Modal
  useEffect(() => {
    if (showCreateModal) {
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
  }, [showCreateModal]);

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
    <div className="app-page-wrapper" style={{ minHeight: '100vh', background: 'var(--ice-blue-bg)', paddingBottom: '100px', fontFamily: 'var(--font-main)' }}>
      {/* ======================================================== */}
      {/* 1. TOPBAR (IDENTICAL TO STUDENT TOPBAR)                  */}
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
        {mainTab === 'classroom' ? (
          <button
            onClick={() => setShowGroupDrawer(true)}
            style={{
              background: 'var(--ice-blue-bg)',
              border: '2px solid var(--primary-blue)',
              color: 'var(--primary-blue)',
              borderRadius: 'var(--radius-pill)',
              padding: '10px 18px',
              fontSize: '15px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
              maxWidth: '240px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            <ChevronLeft size={18} strokeWidth={3} />
            <span>{selectedGroup ? selectedGroup.title : 'Guruhni tanlang'}</span>
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
        <ProfileDropdown onNavigateTab={(t) => setMainTab(t as any)} variant="teacher" />
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
                ) : (
                  <>

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
                      <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={!selectedGroup}
                        className="btn-big-blue"
                        style={{ minHeight: '40px', padding: '0 18px', fontSize: '13px' }}
                      >
                        <PlusCircle size={16} />
                        <span>Yangi Vazifa Tuzish</span>
                      </button>
                    </div>
                    {assignments.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', background: 'var(--pure-white)', borderRadius: '20px', border: '1.5px dashed var(--sky-border)' }}>
                        Ushbu guruhda hali topshiriqlar yaratilmagan.
                      </div>
                    ) : (
                      assignments.map(ass => (
                        <div
                          key={ass.id}
                          style={{
                            background: 'var(--pure-white)',
                            border: '1.5px solid var(--sky-border)',
                            borderRadius: '20px',
                            padding: '20px 24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '16px',
                            boxShadow: 'var(--shadow-card)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-navy)', marginBottom: '4px' }}>
                              {ass.title}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span>📅 Yaratildi: {new Date(ass.createdAt).toLocaleDateString('uz-UZ')}</span>
                              <span>📌 Bo'limlar soni: {ass.itemsCount} ta</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 800 }}>
                                ✅ {ass.submittedCount} ta topshirdi
                              </span>
                              <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 800 }}>
                                ⚠️ {ass.missingCount} ta qilmadi
                              </span>
                            </div>

                            <button
                              onClick={() => handleOpenReport(ass.id)}
                              className="btn-big-blue"
                              style={{ minHeight: '40px', padding: '0 18px', fontSize: '13px' }}
                            >
                              <span>Hisobot & Tekshirish</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
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
                        style={{ minHeight: '40px', padding: '0 16px', fontSize: '13px' }}
                      >
                        <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                        <span>{isSyncing ? "Yangilanmoqda..." : "A'zolarni yangilash"}</span>
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
                              title="Tizimdan o'chirish"
                              style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', padding: '6px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreMember(m.studentId)}
                              title="Qayta qo'shish"
                              style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', padding: '6px' }}
                            >
                              <UserCheck size={18} />
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
                        onClick={() => navigate(`/legacy/player/${movie.id}`)}
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
      {/* 7. CREATE ASSIGNMENT MODAL (NO DEADLINE INPUT)           */}
      {/* ======================================================== */}
      {showCreateModal && (
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
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            border: '2px solid var(--sky-border)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--sky-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ice-blue-bg)' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-navy)' }}>Yangi Topshiriq Yaratish</div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 800, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-navy)' }}>Topshiriq nomi:</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--sky-border)', marginTop: '4px', fontSize: '15px' }}
                />
              </div>

              {/* Items Constructor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-navy)' }}>Bo'limlar ({items.length} ta):</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddItem('Vocabulary')}
                      className="btn-big-white"
                      style={{ minHeight: '34px', padding: '0 10px', fontSize: '12px' }}
                    >
                      + Lug'at
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItem('MediaSubmission')}
                      className="btn-big-white"
                      style={{ minHeight: '34px', padding: '0 10px', fontSize: '12px' }}
                    >
                      + Media (Bot)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItem('TextReminder')}
                      className="btn-big-white"
                      style={{ minHeight: '34px', padding: '0 10px', fontSize: '12px' }}
                    >
                      + Matn
                    </button>
                  </div>
                </div>

                {items.map((it, idx) => (
                  <div key={idx} style={{ background: 'var(--ice-blue-bg)', borderRadius: '14px', padding: '14px', border: '1px solid var(--sky-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary-blue)' }}>
                        {idx + 1}-bo'lim: {it.itemType}
                      </span>
                      {items.length > 1 && (
                        <button onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                          O'chirish
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={it.title}
                      onChange={e => {
                        const copy = [...items];
                        copy[idx].title = e.target.value;
                        setItems(copy);
                      }}
                      placeholder="Sarlavha"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--sky-border)', fontSize: '13px' }}
                    />

                    {it.itemType === 'Vocabulary' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const copy = [...items];
                              copy[idx].vocabMode = 'book';
                              setItems(copy);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: it.vocabMode === 'book' ? '1.5px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                              background: it.vocabMode === 'book' ? 'var(--primary-blue)' : '#fff',
                              color: it.vocabMode === 'book' ? '#fff' : 'var(--text-navy)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            📖 Kitob Unitidan tanlash
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const copy = [...items];
                              copy[idx].vocabMode = 'custom';
                              setItems(copy);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: it.vocabMode === 'custom' ? '1.5px solid var(--primary-blue)' : '1px solid var(--sky-border)',
                              background: it.vocabMode === 'custom' ? 'var(--primary-blue)' : '#fff',
                              color: it.vocabMode === 'custom' ? '#fff' : 'var(--text-navy)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ✍️ O'z so'zlar ro'yxatimni kiritish
                          </button>
                        </div>

                        {it.vocabMode === 'book' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            <select
                              value={selectedBookId || ''}
                              onChange={e => handleBookSelect(Number(e.target.value))}
                              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--sky-border)', fontSize: '12px' }}
                            >
                              {booksList.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                            </select>

                            <select
                              value={selectedPartId || ''}
                              onChange={e => handlePartSelect(Number(e.target.value))}
                              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--sky-border)', fontSize: '12px' }}
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
                              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--sky-border)', fontSize: '12px' }}
                            >
                              {partUnitsList.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <textarea
                      rows={2}
                      value={it.instructions}
                      onChange={e => {
                        const copy = [...items];
                        copy[idx].instructions = e.target.value;
                        setItems(copy);
                      }}
                      placeholder={it.vocabMode === 'custom' ? "So'zlar ro'yxati (masalan: apple - olma\nbook - kitob)" : "Yo'riqnoma"}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--sky-border)', fontSize: '13px' }}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateAssignment}
                className="btn-big-blue"
                style={{ width: '100%', minHeight: '50px', fontSize: '15px', marginTop: '10px' }}
              >
                <span>🚀 E'LON QILISH (GURUHGA YUBORISH)</span>
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
          overflowY: 'auto'
        }}>
          {/* Top Sticky Bar */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--pure-white)',
            borderBottom: '1.5px solid var(--sky-border)',
            padding: '12px 20px',
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

            {selectedReport.missingCount > 0 ? (
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
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                <Send size={14} />
                <span>Eslatma ({selectedReport.missingCount})</span>
              </button>
            ) : <div style={{ width: '80px' }} />}
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
              <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto', padding: '20px 16px 80px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

                          {/* Items Rows (Clean rows, item title + status only, NO media players here) */}
                          {st.items && st.items.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC', borderRadius: '12px', padding: '10px', border: '1px solid var(--sky-border)' }}>
                              {st.items.map((item: any) => (
                                <div
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '13px',
                                    padding: '4px 6px'
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{item.itemType === 'video' || item.itemType === 'MediaSubmission' ? '🎬' : item.itemType === 'audio' ? '🎙️' : item.itemType === 'vocab' || item.itemType === 'Vocabulary' ? '📚' : item.itemType === 'test' ? '📝' : '📄'}</span>
                                    <span>{item.title}</span>
                                  </span>
                                  <span>
                                    {item.mySubmissionStatus === 1 ? (
                                      <span style={{ color: '#15803D', fontWeight: 700, fontSize: '12px' }}>✅ Bajarildi</span>
                                    ) : item.mySubmissionStatus === 0 ? (
                                      <span style={{ color: '#B91C1C', fontWeight: 700, fontSize: '12px' }}>❌ Jarima</span>
                                    ) : item.mySubmissionStatus === 2 ? (
                                      <span style={{ color: '#B45309', fontWeight: 700, fontSize: '12px' }}>⚠️ Jarima bajardi</span>
                                    ) : item.attachments?.length ? (
                                      <span style={{ color: '#0369A1', fontWeight: 700, fontSize: '12px' }}>⏳ Tekshirilmoqda</span>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: '12px' }}>— Topshirilmagan</span>
                                    )}
                                  </span>
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
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: isFullDone ? '2px solid #16A34A' : '1px solid #BBF7D0',
                                  background: isFullDone ? '#16A34A' : '#DCFCE7',
                                  color: isFullDone ? '#fff' : '#15803D',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Bajarildi
                              </button>

                              <button
                                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, st.studentId, 0)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: isPunishment ? '2px solid #DC2626' : '1px solid #FECACA',
                                  background: isPunishment ? '#DC2626' : '#FEE2E2',
                                  color: isPunishment ? '#fff' : '#B91C1C',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Jarima
                              </button>

                              <button
                                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, st.studentId, 2)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: isPunished ? '2px solid #D97706' : '1px solid #FDE68A',
                                  background: isPunished ? '#D97706' : '#FEF3C7',
                                  color: isPunished ? '#fff' : '#B45309',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Jarima Bajardi
                              </button>

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
                            {att.fileType === 'photo' ? (
                              <img
                                src={att.streamUrl}
                                alt="Submission"
                                style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px', background: '#F8FAFC' }}
                              />
                            ) : att.fileType === 'audio' || att.fileType === 'voice' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Volume2 size={16} color="var(--primary-blue)" />
                                  <span>Ovozli xabar / Audio</span>
                                </div>
                                <audio controls src={att.streamUrl} style={{ width: '100%' }} />
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <video
                                  controls
                                  src={att.streamUrl}
                                  style={{ width: '100%', maxHeight: '380px', borderRadius: '8px', background: '#000' }}
                                />
                                <a
                                  href={att.telegramDeepLink || att.streamUrl || `https://t.me/lanswitchbot?start=view_att_${att.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-blue)', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}
                                >
                                  <Play size={14} />
                                  <span>🎬 Videoni Telegram botda ko'rish</span>
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
                  minWidth: '100px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16A34A',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ✅ Full done
              </button>
              <button
                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, detailReviewStudent.studentId, 0)}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ❌ Jarima (Punishment)
              </button>
              <button
                onClick={() => handleSetStudentStatus(selectedReport.assignmentId, detailReviewStudent.studentId, 2)}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#D97706',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Jarima Bajardi
              </button>
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
              {isLoadingGroups ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
              ) : groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  Guruhlar topilmadi. Botni guruhga qo'shing va /start buyrug'ini yuboring.
                </div>
              ) : (
                groups.map(g => {
                  const isSelected = selectedGroup?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        handleSelectGroup(g);
                        setShowGroupDrawer(false);
                      }}
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
                          {g.memberCount} ta a'zo • Telegram ID: {g.telegramChatId}
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
      {/* FIXED BOTTOM NAVIGATION BAR                              */}
      {/* ======================================================== */}
      <BottomNav
        role="teacher"
        activeTab={
          mainTab === 'movies'
            ? 'movies'
            : mainTab === 'vocabulary'
            ? 'vocabulary'
            : viewMode
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
    </div>
  );
}
