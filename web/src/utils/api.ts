// API Client for Lanswitch Platform

const API_BASE = '/api/v1';

export interface TeacherGroup {
  id: number;
  telegramChatId: number;
  title: string;
  isOwner: boolean;
  memberCount: number;
  activeAssignmentsCount: number;
  isSubscriptionExpired?: boolean;
}

export interface StudentGroup {
  id: number;
  telegramChatId: number;
  title: string;
  isTeacherSubscriptionExpired?: boolean;
}

export interface CreateAssignmentItem {
  orderIndex: number;
  itemType: 'TextReminder' | 'Vocabulary' | 'MediaSubmission';
  title: string;
  instructions?: string;
  targetUnitId?: number;
}

export interface CreateAssignmentPayload {
  groupId: number;
  title: string;
  deadline: string;
  items: CreateAssignmentItem[];
}

export interface AttachmentItem {
  id: number;
  fileType: string;
  fileSizeBytes: number;
  telegramDeepLink: string;
  streamUrl?: string;
  telegramFileId?: string;
}

export interface AssignmentItemDetail {
  id: number;
  orderIndex: number;
  itemType: 'TextReminder' | 'Vocabulary' | 'MediaSubmission';
  title: string;
  instructions?: string;
  targetUnitId?: number;
  targetUnitTitle?: string;
  bookTitle?: string;
  submissionId?: number;
  mySubmissionStatus?: number | null; // 1: Bajarildi, 0: Jarima, 2: Jarima Bajarildi, null: Tekshirilmagan
  mySubmissionComment?: string;
  mySubmittedAt?: string;
  attachments?: AttachmentItem[];
}

export interface AssignmentDetail {
  id: number;
  groupId: number;
  groupTitle: string;
  title: string;
  deadline: string;
  status: string;
  items: AssignmentItemDetail[];
}

export interface SubmissionReview {
  submissionId: number;
  assignmentId: number;
  assignmentTitle: string;
  assignmentItemId: number;
  itemTitle: string;
  itemType: string;
  studentId: number;
  studentName: string;
  studentAvatarUrl?: string;
  status?: number | null;
  comment?: string;
  submittedAt: string;
  attachments: AttachmentItem[];
}

export interface Book {
  id: number;
  title: string;
  description?: string;
  coverUrl?: string;
}

export interface BookPart {
  id: number;
  bookId: number;
  partNumber: number;
  title?: string;
}

export interface BookUnit {
  id: number;
  partId: number;
  unitNumber: number;
  title: string;
}

export interface BookWord {
  id: number;
  unitId: number;
  word: string;
  ipa?: string;
  translationUz: string;
  partOfSpeech?: string;
  exampleSentence?: string;
}

export interface QuizQuestion {
  wordId: number;
  questionText: string;
  direction: 'EN_TO_UZ' | 'UZ_TO_EN';
  ipa?: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
}

export interface AssignmentSummary {
  id: number;
  groupId: number;
  title: string;
  deadline: string;
  status: string;
  createdAt: string;
  itemsCount: number;
  totalMembersCount: number;
  submittedCount: number;
  missingCount: number;
  fullCount?: number;
  partialCount?: number;
  penaltyCount?: number;
}

export interface GroupMember {
  studentId: number;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  telegramId?: string;
  isActive: boolean;
  joinedAt: string;
}

export interface ReviewItemDetail {
  submissionId: number;
  assignmentItemId: number;
  itemTitle: string;
  itemType: string;
  status?: number | null;
  comment?: string;
  submittedAt: string;
  attachments: AttachmentItem[];
}

export interface StudentReviewGroup {
  studentId: number;
  studentName: string;
  studentAvatarUrl?: string;
  assignmentId: number;
  assignmentTitle: string;
  latestSubmittedAt: string;
  overallStatus?: number | null;
  items: ReviewItemDetail[];
}

export interface StudentTimelineAssignment {
  assignmentId: number;
  title: string;
  createdAt: string;
  deadline: string;
  overallStatus?: number | null;
  items: AssignmentItemDetail[];
}

export interface StudentAssignmentStatus {
  studentId: number;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  telegramId?: string;
  hasSubmitted: boolean;
  status?: number | null; // 1 = Bajarildi, 0 = Jarima, 2 = Jarima Bajarildi, null = Tekshirilmagan
  comment?: string;
  submittedAt?: string;
  itemsCompleted: number;
  totalItems: number;
  attachments: AttachmentItem[];
  items?: AssignmentItemDetail[];
}

export interface AssignmentReport {
  assignmentId: number;
  groupId: number;
  groupTitle: string;
  title: string;
  deadline: string;
  status: string;
  createdAt: string;
  totalMembersCount: number;
  submittedCount: number;
  missingCount: number;
  fullCount?: number;
  punishmentCount?: number;
  punishedCount?: number;
  submittedStudents: StudentAssignmentStatus[];
  missingStudents: StudentAssignmentStatus[];
}

export interface SyncMembersResult {
  syncedCount: number;
  totalCount: number;
  message: string;
}

export const api = {
  // Teacher Groups
  async getTeacherGroups(tab: 'All' | 'Owned' | 'Admin' = 'All', teacherId?: number): Promise<TeacherGroup[]> {
    try {
      const url = teacherId ? `${API_BASE}/groups/teacher?tab=${tab}&teacherId=${teacherId}` : `${API_BASE}/groups/teacher?tab=${tab}`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  // Get user by Telegram ID
  async getUserByTelegram(telegramId: string | number): Promise<{ id: number; fullName: string; telegramId: string; profileImage?: string; isAdmin: boolean } | null> {
    try {
      const res = await fetch(`/api/users/by-telegram/${telegramId}`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  // Telegram Auto Login
  async telegramAutoLogin(payload: {
    telegramId?: string;
    userId?: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    initData?: string;
  }): Promise<{ user: any; accessToken: string; userId: number } | null> {
    try {
      const res = await fetch('/api/auth/telegram-auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('lanswitch_user', JSON.stringify(data.user));
        }
        if (data.accessToken) {
          localStorage.setItem('lanswitch_token', data.accessToken);
        }
        return data;
      }
    } catch (e) {
      console.warn('Auto-login error:', e);
    }
    return null;
  },

  // Student Groups
  async getStudentGroups(studentId = 1): Promise<StudentGroup[]> {
    try {
      const res = await fetch(`${API_BASE}/groups/student?studentId=${studentId}`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 1, telegramChatId: -1001928374, title: "IELTS Morning B1" },
      { id: 3, telegramChatId: -1001746352, title: "Speaking Club Intermediate" }
    ];
  },

  // Student Assignments (5 filters)
  async getStudentAssignments(groupId: number, filter = 'All', studentId = 1): Promise<AssignmentDetail[]> {
    try {
      const res = await fetch(`${API_BASE}/assignments/student?groupId=${groupId}&filter=${filter}&studentId=${studentId}`);
      if (res.ok) return await res.json();
    } catch {}
    // Mock assignments
    return [
      {
        id: 101,
        groupId,
        groupTitle: "IELTS Morning B1",
        title: "22.10.2026 Lesson",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        status: "Published",
        items: [
          {
            id: 201,
            orderIndex: 1,
            itemType: "TextReminder",
            title: "Kitob mutolaasi",
            instructions: "Reader Book kitobining 45-betidagi hikoyani o'qib kelish",
            mySubmissionStatus: 1,
            mySubmissionComment: "Darsda tekshirildi"
          },
          {
            id: 202,
            orderIndex: 2,
            itemType: "Vocabulary",
            title: "So'z boyligi (Destination B1 • Unit 4)",
            instructions: "20 ta yangi so'zni flashcard orqali yodlang va testni 70%+ bajaring",
            targetUnitId: 4,
            targetUnitTitle: "Unit 4: Family & Relationships",
            bookTitle: "Destination B1",
            mySubmissionStatus: 1,
            mySubmissionComment: "Test natijasi: 19/20 (95%)"
          },
          {
            id: 203,
            orderIndex: 3,
            itemType: "MediaSubmission",
            title: "Speaking: Describe Your Hometown",
            instructions: "O'z shaxringiz haqida kamida 1 daqiqalik ovozli xabar yoki video yuboring",
            mySubmissionStatus: null // Tekshirilmagan / Kutilmoqda
          }
        ]
      },
      {
        id: 100,
        groupId,
        groupTitle: "IELTS Morning B1",
        title: "20.10.2026 Lesson",
        deadline: new Date(Date.now() - 86400000).toISOString(),
        status: "Published",
        items: [
          {
            id: 199,
            orderIndex: 1,
            itemType: "TextReminder",
            title: "Grammatika mashqi",
            instructions: "Past Simple va Present Perfect qoidalarini daftarga yozish",
            mySubmissionStatus: 1
          },
          {
            id: 200,
            orderIndex: 2,
            itemType: "MediaSubmission",
            title: "Listening Homework: Podcast Audio",
            instructions: "Podkastni tinglab, asosiy xulosani ovozli xabar qilib yuboring",
            mySubmissionStatus: 0,
            mySubmissionComment: "Jarima: Topshiriq muddati o'tib ketgan"
          }
        ]
      }
    ];
  },

  // Teacher Create Assignment
  async createAssignment(payload: CreateAssignmentPayload, teacherId = 1): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/assignments?teacherId=${teacherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch {}
    return true;
  },

  // Teacher Delete Assignment
  async deleteAssignment(assignmentId: number, teacherId?: number): Promise<{ success: boolean; message?: string }> {
    try {
      const url = teacherId 
        ? `${API_BASE}/assignments/${assignmentId}?teacherId=${teacherId}`
        : `${API_BASE}/assignments/${assignmentId}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return { success: false, message: err?.message || 'Vazifani o\'chirishda xatolik yuz berdi' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Server bilan aloqa xatosi' };
    }
  },

  // Teacher Review Queue
  async getTeacherSubmissions(groupId: number, filter?: string, teacherId?: number): Promise<SubmissionReview[]> {
    try {
      const url = teacherId 
        ? `${API_BASE}/assignments/review?groupId=${groupId}${filter ? `&filter=${filter}` : ''}&teacherId=${teacherId}`
        : `${API_BASE}/assignments/review?groupId=${groupId}${filter ? `&filter=${filter}` : ''}`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  // Teacher Grade Submission
  async gradeSubmission(submissionId: number, status: number, comment?: string, teacherId = 1): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/assignments/submissions/${submissionId}/grade?teacherId=${teacherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment })
      });
      return res.ok;
    } catch {}
    return true;
  },

  // Vocabulary & Books
  async getBooks(): Promise<Book[]> {
    try {
      const res = await fetch(`${API_BASE}/vocabulary/books`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 1, title: "Destination B1: Grammar & Vocabulary", description: "Intermediate darajadagi eng mashhur darslik" },
      { id: 2, title: "4000 Essential English Words 1", description: "Boshlang'ich va asosiy so'z boyligi" },
      { id: 3, title: "Oxford Word Skills (Basic)", description: "Mavzuli so'zlar to'plami" }
    ];
  },

  async getUnitWords(unitId: number): Promise<BookWord[]> {
    try {
      const res = await fetch(`${API_BASE}/vocabulary/units/${unitId}/words`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 1, unitId, word: "Breakthrough", ipa: "/ˈbreɪkˌθruː/", translationUz: "Yutuq, muhim kashfiyot", partOfSpeech: "noun", exampleSentence: "Scientists have made a major breakthrough in cancer research." },
      { id: 2, unitId, word: "Sibling", ipa: "/ˈsɪb.lɪŋ/", translationUz: "Aka-uka yoki opa-singil", partOfSpeech: "noun", exampleSentence: "I have two siblings: a brother and a sister." },
      { id: 3, unitId, word: "Persevere", ipa: "/ˌpɜː.sɪˈvɪər/", translationUz: "Matonat ko'rsatmoq, qat'iyat bilan davom etmoq", partOfSpeech: "verb", exampleSentence: "Despite the difficulties, she persevered with her studies." },
      { id: 4, unitId, word: "Heritage", ipa: "/ˈher.ɪ.tɪdʒ/", translationUz: "Meros, madaniy boylik", partOfSpeech: "noun", exampleSentence: "We must preserve our national cultural heritage." }
    ];
  },

  async generateQuiz(unitId: number): Promise<QuizQuestion[]> {
    try {
      const res = await fetch(`${API_BASE}/vocabulary/units/${unitId}/quiz`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      {
        wordId: 1,
        questionText: "Breakthrough",
        direction: "EN_TO_UZ",
        ipa: "/ˈbreɪkˌθruː/",
        options: [
          { text: "To'siq, g'ov", isCorrect: false },
          { text: "Yutuq, muhim kashfiyot", isCorrect: true },
          { text: "Tanaffus vaqti", isCorrect: false },
          { text: "Tasodifiy uchrashuv", isCorrect: false }
        ]
      },
      {
        wordId: 2,
        questionText: "Aka-uka yoki opa-singil",
        direction: "UZ_TO_EN",
        options: [
          { text: "Sibling", isCorrect: true },
          { text: "Nephew", isCorrect: false },
          { text: "Ancestor", isCorrect: false },
          { text: "Colleague", isCorrect: false }
        ]
      },
      {
        wordId: 3,
        questionText: "Persevere",
        direction: "EN_TO_UZ",
        ipa: "/ˌpɜː.sɪˈvɪər/",
        options: [
          { text: "Voz kechmoq", isCorrect: false },
          { text: "Matonat ko'rsatmoq", isCorrect: true },
          { text: "Shoshilmoq", isCorrect: false },
          { text: "Qo'rqmoq", isCorrect: false }
        ]
      }
    ];
  },

  async submitQuizResult(assignmentItemId: number, correctAnswers: number, totalQuestions: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/assignments/items/submit-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentItemId, correctAnswers, totalQuestions })
      });
      return res.ok;
    } catch {}
    return true;
  },

  async syncGroupMembers(groupId: number, teacherId = 1): Promise<SyncMembersResult> {
    const res = await fetch(`${API_BASE}/groups/${groupId}/sync-members?teacherId=${teacherId}`, {
      method: 'POST'
    });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({ message: 'Guruh a\'zolarini yangilashda xatolik yuz berdi' }));
    throw new Error(err.message || 'Xatolik');
  },

  async getGroupAssignments(groupId: number, teacherId = 1): Promise<AssignmentSummary[]> {
    try {
      const res = await fetch(`${API_BASE}/assignments/group/${groupId}?teacherId=${teacherId}`);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  async getAssignmentReport(assignmentId: number, teacherId = 1): Promise<AssignmentReport | null> {
    try {
      const res = await fetch(`${API_BASE}/assignments/${assignmentId}/report?teacherId=${teacherId}`);
      if (res.ok) return await res.json();
      const err = await res.json().catch(() => null);
      if (err?.message) {
        throw new Error(err.message);
      }
    } catch (e: any) {
      if (e?.message) throw e;
    }
    return null;
  },

  async remindMissingStudents(assignmentId: number, teacherId = 1): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/assignments/${assignmentId}/remind-missing?teacherId=${teacherId}`, {
        method: 'POST'
      });
      return res.ok;
    } catch {}
    return false;
  },

  // Group Members List & Management
  async getGroupMembersList(groupId: number, includeInactive = false): Promise<GroupMember[]> {
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/members-list?includeInactive=${includeInactive}`);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  async removeMember(groupId: number, studentId: number, teacherId?: number): Promise<boolean> {
    try {
      const url = teacherId
        ? `${API_BASE}/groups/${groupId}/members/${studentId}?teacherId=${teacherId}`
        : `${API_BASE}/groups/${groupId}/members/${studentId}`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch {}
    return false;
  },

  async restoreMember(groupId: number, studentId: number, teacherId?: number): Promise<boolean> {
    try {
      const url = teacherId
        ? `${API_BASE}/groups/${groupId}/members/${studentId}/restore?teacherId=${teacherId}`
        : `${API_BASE}/groups/${groupId}/members/${studentId}/restore`;
      const res = await fetch(url, { method: 'POST' });
      return res.ok;
    } catch {}
    return false;
  },

  // Review Groups (Ordered by latest student submission first)
  async getTeacherReviewGroups(groupId: number, filter?: string, teacherId?: number): Promise<StudentReviewGroup[]> {
    try {
      const url = teacherId
        ? `${API_BASE}/assignments/review-groups?groupId=${groupId}${filter ? `&filter=${filter}` : ''}&teacherId=${teacherId}`
        : `${API_BASE}/assignments/review-groups?groupId=${groupId}${filter ? `&filter=${filter}` : ''}`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  // Student Timeline History
  async getStudentTimelineHistory(groupId: number, studentId: number): Promise<StudentTimelineAssignment[]> {
    try {
      const res = await fetch(`${API_BASE}/assignments/groups/${groupId}/students/${studentId}/history`);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  // Toggle student assignment status (Bajarildi / Bajarilmadi)
  async toggleStudentAssignmentStatus(assignmentId: number, studentId: number, isCompleted = true, teacherId?: number): Promise<boolean> {
    try {
      const url = teacherId
        ? `${API_BASE}/assignments/${assignmentId}/students/${studentId}/toggle-status?isCompleted=${isCompleted}&teacherId=${teacherId}`
        : `${API_BASE}/assignments/${assignmentId}/students/${studentId}/toggle-status?isCompleted=${isCompleted}`;
      const res = await fetch(url, { method: 'POST' });
      return res.ok;
    } catch {}
    return false;
  },

  async setStudentAssignmentStatus(assignmentId: number, studentId: number, status: number, teacherId?: number, comment?: string): Promise<{ success: boolean; message?: string }> {
    try {
      let url = `${API_BASE}/assignments/${assignmentId}/students/${studentId}/set-status?status=${status}`;
      if (teacherId) url += `&teacherId=${teacherId}`;
      if (comment) url += `&comment=${encodeURIComponent(comment)}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return { success: false, message: err?.message || 'Statusni yangilashda xatolik yuz berdi' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Server bilan aloqa xatosi' };
    }
  },

  async setStudentItemStatus(assignmentId: number, itemId: number, studentId: number, status: number, teacherId?: number, comment?: string): Promise<{ success: boolean; message?: string }> {
    try {
      let url = `${API_BASE}/assignments/${assignmentId}/items/${itemId}/students/${studentId}/grade?status=${status}`;
      if (teacherId) url += `&teacherId=${teacherId}`;
      if (comment) url += `&comment=${encodeURIComponent(comment)}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return { success: false, message: err?.message || 'Qism statusini yangilashda xatolik yuz berdi' };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Server bilan aloqa xatosi' };
    }
  },

  // Delete attachment
  async deleteAttachment(attachmentId: number, userId?: number): Promise<boolean> {
    try {
      const url = userId
        ? `${API_BASE}/assignments/attachments/${attachmentId}?userId=${userId}`
        : `${API_BASE}/assignments/attachments/${attachmentId}`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch {}
    return false;
  },

  // Prepare media upload via Telegram Bot
  async prepareMediaUpload(itemId: number, studentId?: number): Promise<{ success: boolean; botUsername?: string; botUrl?: string; message?: string }> {
    try {
      const url = studentId 
        ? `${API_BASE}/assignments/items/${itemId}/prepare-upload?studentId=${studentId}`
        : `${API_BASE}/assignments/items/${itemId}/prepare-upload`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(studentId ? { 'X-User-Id': studentId.toString() } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          botUsername: data.botUsername,
          botUrl: data.botUrl || `tg://resolve?domain=${data.botUsername || 'lanswitchbot'}`,
          message: data.message
        };
      }
      return {
        success: false,
        message: data?.message || 'Yuklashni tayyorlashda xatolik yuz berdi'
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Server bilan aloqa xatosi'
      };
    }
  },

  // Send attachment directly to Telegram bot chat
  async sendAttachmentToBot(attachmentId: number, userId?: number): Promise<{ success: boolean; botUsername?: string; botUrl?: string; message?: string }> {
    try {
      const url = userId
        ? `${API_BASE}/assignments/attachments/${attachmentId}/send-to-bot?userId=${userId}`
        : `${API_BASE}/assignments/attachments/${attachmentId}/send-to-bot`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId.toString() } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          botUsername: data.botUsername,
          botUrl: data.botUrl || `tg://resolve?domain=${data.botUsername || 'lanswitchbot'}`,
          message: data.message
        };
      }
      return {
        success: false,
        message: data?.message || 'Faylni yuborishda xatolik yuz berdi'
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Server bilan aloqa xatosi'
      };
    }
  },

  // Books hierarchy
  async getBookParts(bookId: number): Promise<BookPart[]> {
    try {
      const res = await fetch(`${API_BASE}/vocabulary/books/${bookId}/parts`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 1, bookId, partNumber: 1, title: "Part 1: Grammar Basics" },
      { id: 2, bookId, partNumber: 2, title: "Part 2: Core Vocabulary" }
    ];
  },

  async getBookUnits(partId: number): Promise<BookUnit[]> {
    try {
      const res = await fetch(`${API_BASE}/vocabulary/parts/${partId}/units`);
      if (res.ok) return await res.json();
    } catch {}
    return [
      { id: 1, partId, unitNumber: 1, title: "Unit 1: Introductions & Daily Routine" },
      { id: 2, partId, unitNumber: 2, title: "Unit 2: Family & Friends" },
      { id: 3, partId, unitNumber: 3, title: "Unit 3: School & Education" },
      { id: 4, partId, unitNumber: 4, title: "Unit 4: Travel & Transport" }
    ];
  },

  // English Movies
  async getMovies(): Promise<any[]> {
    try {
      const res = await fetch('/api/media');
      if (res.ok) return await res.json();
    } catch {}
    return [];
  },

  // User Role management (Persisted in DB)
  async updateUserRole(role: 'Student' | 'Teacher', userId?: number): Promise<boolean> {
    try {
      const res = await fetch('/api/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, userId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};

/**
 * Botga to'g'ridan-to'g'ri o'tish:
 * - Mobile Telegram Mini App da: tg.close() orqali ekran yopilib to'g'ridan-to'g'ri bot chatiga o'tadi
 * - Oddiy veb / brauzerda: https:// orqali emas, tg://resolve?domain=... orqali ochiladi,
 *   shunda brauzerdagi joriy sahifa o'chib ketmaydi (saqlanib qoladi).
 */
export function openTelegramBotChat(botUsername: string = 'lanswitchbot') {
  const cleanUsername = (botUsername || 'lanswitchbot').replace(/^@/, '');
  const tgDeepLink = `tg://resolve?domain=${cleanUsername}`;
  const tg = (window as any).Telegram?.WebApp;

  if (tg && (tg.initData || typeof tg.close === 'function')) {
    // Mobile TMA muhiti:
    try {
      if (typeof tg.openTelegramLink === 'function') {
        tg.openTelegramLink(`https://t.me/${cleanUsername}`);
      }
    } catch (e) {
      console.warn('tg.openTelegramLink error:', e);
    }

    // Mobile da ekran yopilib to'g'ridan-to'g'ri bot chatiga o'tadi:
    setTimeout(() => {
      try {
        if (typeof tg.close === 'function') {
          tg.close();
        }
      } catch (e) {
        console.warn('tg.close error:', e);
      }
    }, 100);
  } else {
    // Web / Brauzer muhiti:
    // https:// bilan emas, tg:// orqali birdan ochiladi, joriy sahifa saqlanib qoladi!
    try {
      const a = document.createElement('a');
      a.href = tgDeepLink;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 300);
    } catch {
      window.location.href = tgDeepLink;
    }
  }
}



