import React, { useState, useEffect, useRef } from 'react';
import './AdminPage.css';
import { useAuth } from '../context/AuthContext';
import AdminMediaEditModal from './AdminMediaEditModal';
import CreateMediaModal from './CreateMediaModal';
import ReactMarkdown from 'react-markdown';
import { 
  Send, Megaphone, Archive, Trash2, Bold, Italic, Underline, Strikethrough, 
  Code, Quote, Link2, Eye, RefreshCw, AlertTriangle, Sparkles, Plus, 
  ExternalLink, Copy 
} from 'lucide-react';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingMedia, setEditingMedia] = useState<any>(null);
  const [isCreatingMedia, setIsCreatingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState<'broadcast' | 'subscriptions' | 'media' | 'users' | 'grammar' | 'categories' | 'archives'>('broadcast');
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Telegram Broadcast state
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'students' | 'teachers' | 'premium' | 'free'>('all');
  const [broadcastStats, setBroadcastStats] = useState<any>(null);
  const [loadingBroadcastStats, setLoadingBroadcastStats] = useState(false);
  const [broadcastMessageHtml, setBroadcastMessageHtml] = useState<string>(
`🔥 <b>LANSWITCH — ZAMONAVIY TIL O'RGANISH PLATFORMASI!</b>

Ingliz tilini tez va oson o'rganish uchun barcha qulayliklar bitta joyda:

🎬 <b>Interaktiv Kinolar & Seriallar:</b>
Subtitrlar ustiga bosib so'zlarni bir zumda tarjima qiling va lug'atingizga qo'shing.

🤖 <b>Sun'iy Intellekt (AI) Tahlili:</b>
Har bir gapning arxitekturasi va so'zma-so'z chuqur ma'nosi bilan tanishing.

📚 <b>Interaktiv Lug'atlar & Qiziqarli Testlar:</b>
O'rgangan so'zlaringizni mustahkamlang va lug'at boyligingizni oshiring.

👨‍🏫 <b>O'qituvchilar va Kurslar uchun:</b>
Telegram guruhlaringizni ulang, avtomatik vazifalar bering va talabalarni qulay tekshiring!

🎁 <b>START BONUS:</b> Hozir kiring va <b>25 000 so'm</b> bonusga ega bo'ling!

<i>Boshlash uchun quyidagi tugmani bosing 👇</i>`
  );
  const [broadcastPhotoUrl, setBroadcastPhotoUrl] = useState<string>('');
  const [broadcastButtons, setBroadcastButtons] = useState<Array<{ text: string; url: string }>>([
    { text: '📱 Platformaga kirish (Mini App)', url: 'https://lanswitch.developerlogic.uz/tma' },
    { text: '⭐ Imkoniyatlar va Tariflar', url: 'https://t.me/lanswitchbot?start=premium' }
  ]);
  const [broadcastAlsoInApp, setBroadcastAlsoInApp] = useState<boolean>(true);
  const [broadcastInAppTitle, setBroadcastInAppTitle] = useState<string>("🔥 Lanswitch Yangi Imkoniyatlari va 25,000 so'm Bonus!");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [isTestingBroadcast, setIsTestingBroadcast] = useState(false);
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<string | null>(null);

  // Archives state
  const [archivesList, setArchivesList] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [archiveEntityType, setArchiveEntityType] = useState<string>('all');
  const [selectedArchiveJson, setSelectedArchiveJson] = useState<any | null>(null);

  // Subscriptions management state
  const [subTab, setSubTab] = useState<'receipts' | 'plans_settings' | 'active_subs' | 'logs'>('receipts');
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState<number | ''>('');
  const [grantPlanId, setGrantPlanId] = useState('student_monthly');
  const [grantDurationDays, setGrantDurationDays] = useState(30);
  const [grantIsTrial, setGrantIsTrial] = useState(false);
  const [grantNotes, setGrantNotes] = useState('');
  const [grantingSub, setGrantingSub] = useState(false);

  // Payment Requests state
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [correctingRequest, setCorrectingRequest] = useState<any | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState<number>(0);
  const [correctingNotes, setCorrectingNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Card settings state
  const [cardSettings, setCardSettings] = useState<any>({
    cardNumber: '9860 0000 0000 0000',
    cardHolder: 'ADMINISTRATOR',
    bankName: 'Humo / Uzcard',
    minAmount: 15000,
    initialBonusAmount: 25000,
    instructions: "Xohlagancha pul o'tkazing, minimum 15,000 so'm. Tarifingizga mos ravishda muddat soat va minutlarigacha hisoblab qo'shiladi.",
    isActive: true
  });
  const [savingCardSettings, setSavingCardSettings] = useState(false);

  // Editing plan state
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Logs & Stats state
  const [logsAndStats, setLogsAndStats] = useState<any | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Grammar state
  const [grammarList, setGrammarList] = useState<any[]>([]);
  const [loadingGrammar, setLoadingGrammar] = useState(false);
  const [grammarModalOpen, setGrammarModalOpen] = useState(false);
  const [editingGrammar, setEditingGrammar] = useState<any>(null);
  const [grammarForm, setGrammarForm] = useState({
    languageId: 1,
    name: '',
    description: '',
    content: '',
    videoUrl: '',
  });
  const [savingGrammar, setSavingGrammar] = useState(false);
  const [grammarPreviewOpen, setGrammarPreviewOpen] = useState(false);
  const [previewGrammar, setPreviewGrammar] = useState<any>(null);

  // Notification Modal State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [notifTargetUserId, setNotifTargetUserId] = useState<number | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  useEffect(() => {
    fetchMedia();
    fetchUsers();
    fetchCategories();
    fetchGrammar();
    fetchSubscriptions();
    fetchPlans();
    fetchPaymentRequests();
    fetchCardSettings();
    fetchLogsAndStats();
    fetchBroadcastStats();
    fetchArchives();
  }, []);

  const fetchBroadcastStats = async () => {
    setLoadingBroadcastStats(true);
    try {
      const res = await fetch('/api/notification/admin/broadcast/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-User-Id': user?.id?.toString() || ''
        }
      });
      if (res.ok) {
        setBroadcastStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBroadcastStats(false);
    }
  };

  const handleTestBroadcast = async () => {
    if (!broadcastMessageHtml.trim()) {
      alert("Xabar matnini kiriting!");
      return;
    }
    setIsTestingBroadcast(true);
    try {
      const res = await fetch('/api/notification/admin/broadcast/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-User-Id': user?.id?.toString() || ''
        },
        body: JSON.stringify({
          messageHtml: broadcastMessageHtml,
          photoUrl: broadcastPhotoUrl || null,
          buttons: broadcastButtons.filter(b => b.text.trim() && b.url.trim())
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || "✅ Test xabari Telegramingizga muvaffaqiyatli yuborildi!");
      } else {
        alert(`❌ ${data.message || 'Xatolik yuz berdi'}`);
      }
    } catch (e: any) {
      alert("Tarmoq xatosi: " + (e?.message || e));
    } finally {
      setIsTestingBroadcast(false);
    }
  };

  const handleSendBroadcast = async () => {
    setShowBroadcastConfirm(false);
    setIsSendingBroadcast(true);
    setBroadcastProgress("Xabarlar auditoriyaga tarqatilmoqda, iltimos kuting...");
    try {
      const res = await fetch('/api/notification/admin/broadcast/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-User-Id': user?.id?.toString() || ''
        },
        body: JSON.stringify({
          target: broadcastTarget,
          messageHtml: broadcastMessageHtml,
          photoUrl: broadcastPhotoUrl || null,
          buttons: broadcastButtons.filter(b => b.text.trim() && b.url.trim()),
          alsoSendInApp: broadcastAlsoInApp,
          inAppTitle: broadcastInAppTitle
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 Muvaffaqiyatli tarqatildi!\n\nJami auditoriya: ${data.totalRecipients} ta\n✅ Yetkazildi: ${data.sentCount} ta\n🚫 Botni bloklagan: ${data.blockedCount} ta\n❌ Xatolik: ${data.failedCount} ta`);
        fetchBroadcastStats();
      } else {
        alert(`❌ ${data.message || 'Xabar yuborishda xatolik yuz berdi'}`);
      }
    } catch (e: any) {
      alert("Xatolik: " + (e?.message || e));
    } finally {
      setIsSendingBroadcast(false);
      setBroadcastProgress(null);
    }
  };

  const handleLoadPromoTemplate = () => {
    setBroadcastMessageHtml(
`🔥 <b>LANSWITCH — ZAMONAVIY TIL O'RGANISH PLATFORMASI!</b>

Ingliz tilini tez va oson o'rganish uchun barcha qulayliklar bitta joyda:

🎬 <b>Interaktiv Kinolar & Seriallar:</b>
Subtitrlar ustiga bosib so'zlarni bir zumda tarjima qiling va lug'atingizga qo'shing.

🤖 <b>Sun'iy Intellekt (AI) Tahlili:</b>
Har bir gapning arxitekturasi va so'zma-so'z chuqur ma'nosi bilan tanishing.

📚 <b>Interaktiv Lug'atlar & Qiziqarli Testlar:</b>
O'rgangan so'zlaringizni mustahkamlang va lug'at boyligingizni oshiring.

👨‍🏫 <b>O'qituvchilar va Kurslar uchun:</b>
Telegram guruhlaringizni ulang, avtomatik vazifalar bering va talabalarni qulay tekshiring!

🎁 <b>START BONUS:</b> Hozir kiring va <b>25 000 so'm</b> bonusga ega bo'ling!

<i>Boshlash uchun quyidagi tugmani bosing 👇</i>`
    );
    setBroadcastButtons([
      { text: '🚀 Platformaga kirish (Mini App)', url: 'https://lanswitch.developerlogic.uz/tma' },
      { text: '⭐ Imkoniyatlar va Tariflar', url: 'https://t.me/lanswitchbot?start=premium' }
    ]);
    setBroadcastInAppTitle("🔥 Lanswitch Yangi Imkoniyatlari va 25,000 so'm Bonus!");
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBroadcastMessageHtml(prev => prev + textToInsert);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentText = broadcastMessageHtml;
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
    setBroadcastMessageHtml(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  const insertTag = (openTag: string, closeTag: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentText = broadcastMessageHtml;
    const selected = currentText.substring(start, end);

    const replacement = `${openTag}${selected || 'matn'}${closeTag}`;
    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    setBroadcastMessageHtml(newText);

    setTimeout(() => {
      el.focus();
      const newCursorPos = selected ? start + replacement.length : start + openTag.length;
      el.setSelectionRange(newCursorPos, selected ? newCursorPos : newCursorPos + 4);
    }, 10);
  };

  const handleInsertLink = () => {
    const el = textareaRef.current;
    const selected = el ? broadcastMessageHtml.substring(el.selectionStart, el.selectionEnd) : '';
    const url = prompt("Havola (URL) manzilini kiriting:", "https://");
    if (!url) return;
    const linkText = selected || prompt("Havola ko'rinadigan matnini kiriting:", "Batafsil ko'rish") || "havola";
    insertTextAtCursor(`<a href="${url}">${linkText}</a>`);
  };

  const handleSmartPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    if (htmlData) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');

        const convertNode = (node: Node): string => {
          if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();
            const childrenText = Array.from(el.childNodes).map(convertNode).join('');

            switch (tagName) {
              case 'b':
              case 'strong':
                return `<b>${childrenText}</b>`;
              case 'i':
              case 'em':
                return `<i>${childrenText}</i>`;
              case 'u':
              case 'ins':
                return `<u>${childrenText}</u>`;
              case 's':
              case 'strike':
              case 'del':
                return `<s>${childrenText}</s>`;
              case 'code':
                return `<code>${childrenText}</code>`;
              case 'pre':
                return `<pre>${childrenText}</pre>`;
              case 'blockquote':
                return `<blockquote>${childrenText}</blockquote>`;
              case 'tg-spoiler':
                return `<tg-spoiler>${childrenText}</tg-spoiler>`;
              case 'a':
                const href = el.getAttribute('href');
                return href ? `<a href="${href}">${childrenText}</a>` : childrenText;
              case 'p':
              case 'div':
                return `\n${childrenText}\n`;
              case 'br':
                return `\n`;
              case 'li':
                return `\n• ${childrenText}`;
              default:
                return childrenText;
            }
          }
          return '';
        };

        const converted = Array.from(doc.body.childNodes)
          .map(convertNode)
          .join('')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (converted && converted !== textData) {
          e.preventDefault();
          insertTextAtCursor(converted);
          return;
        }
      } catch (err) {
        console.warn('HTML paste parsing failed, falling back:', err);
      }
    }

    // Markdown paste auto-conversion (e.g. **bold**, *italic*, [text](url))
    if (textData && (/(\*\*|__|\*|_|\[.*?\]\(.*?\)|`)/.test(textData))) {
      let mdConverted = textData
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/__(.*?)__/g, '<b>$1</b>')
        .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '<i>$1</i>')
        .replace(/(?<!\w)_(.*?)_(?!\w)/g, '<i>$1</i>')
        .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');

      if (mdConverted !== textData) {
        e.preventDefault();
        insertTextAtCursor(mdConverted);
        return;
      }
    }
  };

  const fetchArchives = async () => {
    setLoadingArchives(true);
    try {
      const url = archiveEntityType !== 'all' 
        ? `/api/v1/groups/archives?entityType=${archiveEntityType}`
        : '/api/v1/groups/archives';
      const res = await fetch(url);
      if (res.ok) setArchivesList(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingArchives(false);
    }
  };

  const handleCleanupArchives = async () => {
    const daysStr = prompt("Necha kundan eski arxiv yozuvlarini tozalamoqchisiz?", "30");
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 0) return;
    try {
      const res = await fetch(`/api/v1/groups/archives/cleanup?olderThanDays=${days}`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || "Arxiv muvaffaqiyatli tozalandi");
      fetchArchives();
    } catch (e) {
      alert("Xatolik yuz berdi");
    }
  };

  const fetchSubscriptions = async () => {
    setLoadingSubscriptions(true);
    try {
      const res = await fetch('/api/subscription/admin/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setSubscriptionsList(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/subscription/plans');
      if (res.ok) setPlansList(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchPaymentRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/subscription/admin/payment-requests', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setPaymentRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchCardSettings = async () => {
    try {
      const res = await fetch('/api/subscription/card-settings');
      if (res.ok) setCardSettings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCardSettings = async () => {
    setSavingCardSettings(true);
    try {
      const res = await fetch('/api/subscription/admin/card-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(cardSettings)
      });
      if (res.ok) {
        alert("✅ Karta ma'lumotlari muvaffaqiyatli saqlandi!");
      } else {
        alert("Saqlashda xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setSavingCardSettings(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const planId = editingPlan.planId || editingPlan.id;
      const res = await fetch(`/api/subscription/admin/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editingPlan)
      });
      if (res.ok) {
        alert("✅ Tarif muvaffaqiyatli saqlandi!");
        setEditingPlan(null);
        fetchPlans();
      } else {
        alert("Tarifni saqlashda xatolik");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleApprovePayment = async (requestId: number, customAmount?: number, notes?: string) => {
    if (!customAmount && !window.confirm("Ushbu to'lovni tasdiqlamoqchimisiz? Foydalanuvchiga obuna qo'shiladi va botdan xabar boradi.")) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/subscription/admin/approve-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          requestId,
          correctedAmount: customAmount || null,
          adminNotes: notes || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "To'lov muvaffaqiyatli tasdiqlandi!");
        setCorrectingRequest(null);
        fetchPaymentRequests();
        fetchSubscriptions();
        fetchLogsAndStats();
      } else {
        alert(data.message || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async (requestId: number) => {
    const reason = window.prompt("To'lovni rad etish sababini kiriting (foydalanuvchiga botdan yuboriladi):", "Soxta chek yoki to'lov hisobga tushmagan");
    if (reason === null) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/subscription/admin/reject-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          requestId,
          reason
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "To'lov rad etildi!");
        fetchPaymentRequests();
      } else {
        alert(data.message || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchLogsAndStats = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/subscription/admin/logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setLogsAndStats(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleGrantSubscription = async () => {
    if (!grantUserId) {
      alert("Foydalanuvchini tanlang");
      return;
    }
    setGrantingSub(true);
    try {
      const res = await fetch('/api/subscription/admin/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: Number(grantUserId),
          planId: grantPlanId,
          durationDays: Number(grantDurationDays),
          isTrial: grantIsTrial,
          notes: grantNotes.trim() || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Obuna muvaffaqiyatli berildi!");
        setIsGrantModalOpen(false);
        setGrantNotes('');
        fetchSubscriptions();
      } else {
        alert(data.message || data || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setGrantingSub(false);
    }
  };

  const handleCancelSubscription = async (id: number) => {
    if (!window.confirm("Ushbu obunani bekor qilishga ishonchingiz komilmi?")) return;
    try {
      const res = await fetch(`/api/subscription/admin/cancel/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchSubscriptions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media');
      if (res.ok) {
        const data = await res.json();
        setMediaList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/media/categories');
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setUsersList(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchGrammar = async () => {
    setLoadingGrammar(true);
    try {
      const res = await fetch('/api/grammar');
      if (res.ok) setGrammarList(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrammar(false);
    }
  };

  const openCreateGrammar = () => {
    setEditingGrammar(null);
    setGrammarForm({ languageId: 1, name: '', description: '', content: '', videoUrl: '' });
    setGrammarModalOpen(true);
  };

  const openEditGrammar = (g: any) => {
    setEditingGrammar(g);
    setGrammarForm({
      languageId: g.languageId,
      name: g.name,
      description: g.description,
      content: g.content,
      videoUrl: g.videoUrl || '',
    });
    setGrammarModalOpen(true);
  };

  const handleSaveGrammar = async () => {
    if (!grammarForm.name.trim() || !grammarForm.description.trim() || !grammarForm.content.trim()) return;
    setSavingGrammar(true);
    try {
      const body = {
        languageId: grammarForm.languageId,
        name: grammarForm.name.trim(),
        description: grammarForm.description.trim(),
        content: grammarForm.content.trim(),
        videoUrl: grammarForm.videoUrl.trim() || null,
      };

      let res;
      if (editingGrammar) {
        res = await fetch(`/api/grammar/${editingGrammar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/grammar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        setGrammarModalOpen(false);
        fetchGrammar();
      } else {
        alert('Xatolik yuz berdi');
      }
    } catch (e) {
      console.error(e);
      alert('Tarmoq xatosi');
    } finally {
      setSavingGrammar(false);
    }
  };

  const handleDeleteGrammar = async (id: number) => {
    if (!window.confirm("Ushbu grammatik qoidani o'chirishga ishonchingiz komilmi?")) return;
    try {
      const res = await fetch(`/api/grammar/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setGrammarList(prev => prev.filter(g => g.id !== id));
      } else {
        alert("O'chirishda xatolik yuz berdi.");
      }
    } catch (e) {
      console.error(e);
      alert('Tarmoq xatosi');
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    setSendingNotif(true);
    try {
      const res = await fetch('/api/notification/admin/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: notifTargetUserId,
          title: notifTitle,
          message: notifMessage
        })
      });

      if (res.ok) {
        alert("Xabar muvaffaqiyatli yuborildi!");
        setIsNotifModalOpen(false);
        setNotifTitle('');
        setNotifMessage('');
      } else {
        alert("Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setSendingNotif(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Rostdan ham ushbu media faylni tizimdan o'chirib tashlamoqchimisiz?")) return;

    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMediaList(prev => prev.filter(m => m.id !== id));
      } else {
        alert("O'chirishda xatolik yuz berdi. Balki ruxsatingiz yo'qdir.");
      }
    } catch (err) {
      console.error(err);
      alert("Tizim bilan aloqada xatolik.");
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="admin-page animate-fade-in flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: '16px' }}>
          <h2>Kirish taqiqlanadi!</h2>
          <p>Ushbu sahifa faqat adminlar uchun.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page animate-fade-in">
      <div className="admin-header-wrap">
        <div className="admin-brand-block">
          <div className="admin-logo-badge">🛡️</div>
          <div>
            <h1 className="admin-title-text">
              Lanswitch Console
              <span className="admin-live-badge">● Jonli Tizim</span>
            </h1>
            <p className="admin-subtitle">Reklama tarqatish, tariflar, erkin to'lovlar, kvitansiyalar va boshqaruv</p>
          </div>
        </div>

        {/* Quick Stat Pills */}
        <div className="admin-stat-pills">
          <div className="admin-stat-pill" onClick={() => { setActiveTab('users'); fetchUsers(); }} style={{ cursor: 'pointer' }} title="Foydalanuvchilar">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
            <span>Foydalanuvchilar:</span>
            <strong>{broadcastStats?.totalUsers ?? usersList.length}</strong>
          </div>
          <div className="admin-stat-pill" onClick={() => { setActiveTab('subscriptions'); setSubTab('receipts'); }} style={{ cursor: 'pointer' }} title="Kutilayotgan cheklar">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span>Cheklar:</span>
            <strong style={{ color: paymentRequests.filter(r => r.status === 'Pending').length > 0 ? '#ef4444' : '#10b981' }}>
              {paymentRequests.filter(r => r.status === 'Pending').length} ta
            </strong>
          </div>
          <div className="admin-stat-pill" onClick={() => { setActiveTab('media'); fetchMedia(); }} style={{ cursor: 'pointer' }} title="Kinolar va seriallar">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} />
            <span>Kinolar:</span>
            <strong>{mediaList.length} ta</strong>
          </div>
          <div className="admin-stat-pill" onClick={() => { setActiveTab('broadcast'); fetchBroadcastStats(); }} style={{ cursor: 'pointer', borderColor: 'rgba(56, 189, 248, 0.4)' }} title="Telegram foydalanuvchilari">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Telegram Bot:</span>
            <strong style={{ color: '#38bdf8' }}>{broadcastStats?.telegramUsers ?? 0} ta</strong>
          </div>
        </div>

        <div className="admin-nav-tabs">
          <button
            className={`admin-nav-btn broadcast-pill ${activeTab === 'broadcast' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('broadcast');
              fetchBroadcastStats();
            }}
          >
            <span>🚀 Telegram Reklama & Broadcast</span>
            <span style={{ background: '#22c55e', color: '#000', fontSize: '9px', fontWeight: 900, padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.5px' }}>
              REKLAMA
            </span>
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('subscriptions');
              fetchSubscriptions();
              fetchPaymentRequests();
            }}
          >
            <span>👑 Tariflar & To'lovlar</span>
            {paymentRequests.filter(r => r.status === 'Pending').length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: '10.5px', fontWeight: 900, padding: '1px 6px', borderRadius: '10px' }}>
                {paymentRequests.filter(r => r.status === 'Pending').length}
              </span>
            )}
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            🎬 Kinolar & Seriallar
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📂 Janrlar
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'grammar' ? 'active' : ''}`}
            onClick={() => setActiveTab('grammar')}
          >
            📖 Grammatika
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Foydalanuvchilar
          </button>
          <button
            className={`admin-nav-btn ${activeTab === 'archives' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archives');
              fetchArchives();
            }}
          >
            🗄️ Arxivlar
          </button>
        </div>
      </div>

      <div className="admin-glass-container">
        {/* ========================================================== */}
        {/* 1. TELEGRAM REKLAMA & BROADCAST TAB                        */}
        {/* ========================================================== */}
        {activeTab === 'broadcast' && (
          <div className="broadcast-tab-wrapper animate-fade-in">
            {/* Header / Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🚀</span>
                  <span>Telegram Ommaviy Reklama & Broadcast Markazi</span>
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                  Barcha yoki maqsadli foydalanuvchilarga rasmli, boy formatlangan (bold, italic, link) va tugmali xabar tarqating.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline-light"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', borderRadius: '10px' }}
                  onClick={handleLoadPromoTemplate}
                  title="Platforma imkoniyatlari va 25,000 so'm bonus reklama matnini yuklash"
                >
                  <Sparkles size={16} color="#f59e0b" />
                  <span>🎁 Tayyor Reklama Shabloni</span>
                </button>
                <button
                  className="btn btn-outline-light"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', borderRadius: '10px' }}
                  onClick={fetchBroadcastStats}
                  disabled={loadingBroadcastStats}
                  title="Auditoriya sonlarini qayta sanash"
                >
                  <RefreshCw size={15} className={loadingBroadcastStats ? 'spin' : ''} />
                  <span>Auditoriyani Yangilash</span>
                </button>
              </div>
            </div>

            {/* Audience Segmentation Cards */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#cbd5e1', marginBottom: '10px' }}>
                🎯 Qaysi Auditoriyaga yuborilsin? (Kerakli toifani tanlang):
              </label>
              <div className="audience-grid">
                <div
                  className={`audience-card ${broadcastTarget === 'all' ? 'active' : ''}`}
                  onClick={() => setBroadcastTarget('all')}
                >
                  <div className="audience-card-title">
                    <span>🌐 Barchaga</span>
                  </div>
                  <div className="audience-card-count">
                    {broadcastStats?.telegramUsers ?? 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>ta</span>
                  </div>
                </div>

                <div
                  className={`audience-card ${broadcastTarget === 'free' ? 'active' : ''}`}
                  onClick={() => setBroadcastTarget('free')}
                  style={{ borderColor: broadcastTarget === 'free' ? '#f59e0b' : undefined }}
                >
                  <div className="audience-card-title" style={{ color: broadcastTarget === 'free' ? '#f59e0b' : undefined }}>
                    <span>🎁 Obunasiz (Bepul)</span>
                  </div>
                  <div className="audience-card-count" style={{ color: broadcastTarget === 'free' ? '#f59e0b' : undefined }}>
                    {broadcastStats?.freeUsers ?? 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>ta</span>
                  </div>
                </div>

                <div
                  className={`audience-card ${broadcastTarget === 'students' ? 'active' : ''}`}
                  onClick={() => setBroadcastTarget('students')}
                >
                  <div className="audience-card-title">
                    <span>🎓 Talabalar</span>
                  </div>
                  <div className="audience-card-count">
                    {broadcastStats?.students ?? 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>ta</span>
                  </div>
                </div>

                <div
                  className={`audience-card ${broadcastTarget === 'teachers' ? 'active' : ''}`}
                  onClick={() => setBroadcastTarget('teachers')}
                >
                  <div className="audience-card-title">
                    <span>👨‍🏫 O'qituvchilar</span>
                  </div>
                  <div className="audience-card-count">
                    {broadcastStats?.teachers ?? 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>ta</span>
                  </div>
                </div>

                <div
                  className={`audience-card ${broadcastTarget === 'premium' ? 'active' : ''}`}
                  onClick={() => setBroadcastTarget('premium')}
                >
                  <div className="audience-card-title">
                    <span>⭐ Faol Premium</span>
                  </div>
                  <div className="audience-card-count">
                    {broadcastStats?.premiumUsers ?? 0}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>ta</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2-Column Broadcast Builder & Preview */}
            <div className="broadcast-grid-layout">
              {/* Left Column: Editor & Builder */}
              <div>
                {/* Formatting Toolbar */}
                <div className="tg-toolbar-box">
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<b>', '</b>')}
                    title="Qalin matn (Bold)"
                  >
                    <Bold size={14} /> <b>B</b>
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<i>', '</i>')}
                    title="Kursiv matn (Italic)"
                  >
                    <Italic size={14} /> <i>I</i>
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<u>', '</u>')}
                    title="Tagchiziqli matn (Underline)"
                  >
                    <Underline size={14} /> <u>U</u>
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<s>', '</s>')}
                    title="O'chirilgan matn (Strikethrough)"
                  >
                    <Strikethrough size={14} /> <s>S</s>
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<tg-spoiler>', '</tg-spoiler>')}
                    title="Yashirin matn (Spoiler)"
                  >
                    <Eye size={14} /> Spoiler
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={handleInsertLink}
                    title="Havola qo'shish (Link)"
                  >
                    <Link2 size={14} /> Havola
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<code>', '</code>')}
                    title="Kod (Monospace)"
                  >
                    <Code size={14} /> Code
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<pre>', '</pre>')}
                    title="Kod bloki (Preformatted)"
                  >
                    Pre
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    onClick={() => insertTag('<blockquote>', '</blockquote>')}
                    title="Iqtibos (Quote)"
                  >
                    <Quote size={14} /> Quote
                  </button>
                  <button
                    type="button"
                    className="tg-tool-btn"
                    style={{ marginLeft: 'auto', color: '#f87171' }}
                    onClick={() => {
                      if (window.confirm("Xabar matnini tozalashga ishonchingiz komilmi?")) {
                        setBroadcastMessageHtml('');
                      }
                    }}
                    title="Tozalash"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Auto-Paste Helper Banner */}
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '8px 12px', fontSize: '11.5px', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span>
                  <span>
                    <b>Aqlli nusxalash:</b> Telegram yoki Word'dan nusxalab (Ctrl+V) tashlasangiz, <b>bold</b>, <i>italic</i> va havolalar avtomatik HTML teglarga aylanadi!
                  </span>
                </div>

                {/* Main Textarea */}
                <textarea
                  ref={textareaRef}
                  className="form-control tg-textarea-box"
                  value={broadcastMessageHtml}
                  onChange={e => setBroadcastMessageHtml(e.target.value)}
                  onPaste={handleSmartPaste}
                  placeholder="Telegram xabaringiz matnini bu yerga yozing yoki nusxalab tashlang..."
                  rows={13}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11.5px', color: '#64748b' }}>
                  <span>Belgilar: {broadcastMessageHtml.length} ta {broadcastPhotoUrl ? '(Rasm bilan max 1024)' : '(Matnli xabar max 4096)'}</span>
                  <span>HTML teglari qo'llab-quvvatlanadi</span>
                </div>

                {/* Photo URL Input */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>
                    🖼️ Banner Rasmi URL (Ixtiyoriy)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={broadcastPhotoUrl}
                      onChange={e => setBroadcastPhotoUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... yoki rasm havolasi"
                    />
                    {broadcastPhotoUrl && (
                      <button
                        className="btn btn-outline-light"
                        onClick={() => setBroadcastPhotoUrl('')}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    💡 Agar rasm URL manzili kiritilsa, xabar Telegramda rasm ostidagi izoh (caption) sifatida chiroyli yuboriladi.
                  </span>
                </div>

                {/* Inline Buttons Builder */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#cbd5e1' }}>
                      🔘 Telegram Havola Tugmalari (Inline Buttons):
                    </label>
                    {broadcastButtons.length < 5 && (
                      <button
                        type="button"
                        className="btn btn-outline-light"
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setBroadcastButtons([...broadcastButtons, { text: '', url: 'https://' }])}
                      >
                        <Plus size={13} /> Tugma qo'shish
                      </button>
                    )}
                  </div>

                  {broadcastButtons.map((btn, idx) => (
                    <div key={idx} className="tg-btn-builder-row">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Tugma matni (masalan: 🚀 Kirish)"
                        value={btn.text}
                        onChange={e => {
                          const updated = [...broadcastButtons];
                          updated[idx].text = e.target.value;
                          setBroadcastButtons(updated);
                        }}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Havola (URL: https://...)"
                        value={btn.url}
                        onChange={e => {
                          const updated = [...broadcastButtons];
                          updated[idx].url = e.target.value;
                          setBroadcastButtons(updated);
                        }}
                        style={{ flex: 1.4 }}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ color: '#ef4444' }}
                        onClick={() => {
                          setBroadcastButtons(broadcastButtons.filter((_, i) => i !== idx));
                        }}
                        title="Tugmani o'chirish"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {broadcastButtons.length === 0 && (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      Tugmalar qo'shilmagan (ixtiyoriy)
                    </div>
                  )}
                </div>

                {/* Also Send In-App Option */}
                <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="alsoInAppCheck"
                      checked={broadcastAlsoInApp}
                      onChange={e => setBroadcastAlsoInApp(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="alsoInAppCheck" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                      📱 Shuningdek, veb-sayt ichida ham bildirishnoma sifatida yuborilsin
                    </label>
                  </div>
                  {broadcastAlsoInApp && (
                    <div style={{ marginTop: '10px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Sayt ichidagi bildirishnoma sarlavhasi..."
                        value={broadcastInAppTitle}
                        onChange={e => setBroadcastInAppTitle(e.target.value)}
                        style={{ fontSize: '13px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions: Test and Broadcast */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    style={{ flex: 1, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}
                    onClick={handleTestBroadcast}
                    disabled={isTestingBroadcast || isSendingBroadcast || !broadcastMessageHtml.trim()}
                  >
                    <Send size={16} />
                    <span>{isTestingBroadcast ? 'Yuborilmoqda...' : '🧪 Menga Test Yuborish'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1.4, padding: '12px 22px', background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)' }}
                    onClick={() => {
                      if (!broadcastMessageHtml.trim()) {
                        alert("Xabar matnini kiriting!");
                        return;
                      }
                      setShowBroadcastConfirm(true);
                    }}
                    disabled={isSendingBroadcast || !broadcastMessageHtml.trim()}
                  >
                    <Megaphone size={18} />
                    <span>
                      🚀 Auditoriyaga Tarqatish (
                      {broadcastTarget === 'all'
                        ? (broadcastStats?.telegramUsers ?? 0)
                        : broadcastTarget === 'free'
                        ? (broadcastStats?.freeUsers ?? 0)
                        : broadcastTarget === 'students'
                        ? (broadcastStats?.students ?? 0)
                        : broadcastTarget === 'teachers'
                        ? (broadcastStats?.teachers ?? 0)
                        : (broadcastStats?.premiumUsers ?? 0)} ta)
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Telegram Device Mockup */}
              <div>
                <div style={{ position: 'sticky', top: '24px' }}>
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📱 Telegram Jonli Ko'rinishi (Preview)
                    </span>
                    <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      ● Jonli render
                    </span>
                  </div>

                  <div className="tg-preview-container">
                    {/* Telegram Mockup Top Bar */}
                    <div className="tg-preview-header">
                      <div className="tg-bot-avatar">
                        🛡️
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="tg-bot-info-title">
                          <span>Lanswitch Bot</span>
                          <span className="tg-bot-badge">bot</span>
                        </div>
                        <div className="tg-bot-subtitle">
                          @lanswitchbot • Rasmiy Platforma Boti
                        </div>
                      </div>
                    </div>

                    {/* Telegram Chat Bubble Canvas */}
                    <div className="tg-chat-canvas">
                      <div className="tg-message-bubble">
                        {broadcastPhotoUrl && (
                          <img
                            src={broadcastPhotoUrl}
                            alt="Banner Preview"
                            className="tg-bubble-photo"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}

                        <div
                          className="tg-bubble-body"
                          dangerouslySetInnerHTML={{
                            __html: broadcastMessageHtml || '<span style="opacity:0.4">Xabar matnini kiriting...</span>'
                          }}
                        />

                        <div className="tg-bubble-meta">
                          <span>{new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span style={{ color: '#4ade80', fontSize: '12px' }}>✓✓</span>
                        </div>
                      </div>

                      {/* Mockup Inline Buttons */}
                      {broadcastButtons.filter(b => b.text.trim()).length > 0 && (
                        <div className="tg-inline-buttons-wrap">
                          {broadcastButtons.filter(b => b.text.trim()).map((btn, idx) => (
                            <div key={idx} className="tg-mockup-inline-btn">
                              <span>{btn.text}</span>
                              <ExternalLink size={13} style={{ opacity: 0.8 }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hints card */}
                  <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '12px 14px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>🛡️ Xavfsiz va Ishonchli Tarqatish:</div>
                    <div>• Telegram Bot API Flood-limitlariga to'liq rioya etiladi (har bir xabar orasida 35ms pauza).</div>
                    <div>• Botni bloklagan foydalanuvchilar hisobdan chiqariladi va hisobotda ko'rsatiladi.</div>
                    <div>• Reklama yuborishdan avval <b>"🧪 Menga Test Yuborish"</b> tugmasi orqali o'zingizda tekshirib olishingiz mumkin.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
              <button className="btn btn-primary" onClick={() => setIsCreatingMedia(true)}>+ Yangi Media Qo'shish</button>
            </div>
            {loading ? (
              <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
            ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Rasm</th>
                <th>Nomi</th>
                <th>Turi</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {mediaList.map((media) => (
                <tr key={media.id}>
                  <td>{media.id}</td>
                  <td>
                    <img
                      src={media.thumbnailUrl || "https://ui-avatars.com/api/?name=Media"}
                      alt={media.title}
                      className="admin-thumb"
                    />
                  </td>
                  <td>{media.title}</td>
                  <td>
                    <span className={`type-badge ${media.isFilm ? 'kino-badge' : 'serial-badge'}`}>
                      {media.isFilm ? 'KINO' : 'SERIAL'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setEditingMedia(media)}
                      >
                        Tahrirlash
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(media.id)}
                      >
                        O'chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {mediaList.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Media topilmadi</td>
                </tr>
              )}
            </tbody>
          </table>
            )}
          </>
        )}

        {/* ===== SUBSCRIPTIONS & PLANS TAB ===== */}
        {/* ===== SUBSCRIPTIONS & PLANS TAB ===== */}
        {activeTab === 'subscriptions' && (
          <div>
            {/* Sub-tabs Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>👑 Tariflar, To'lovlar va Obunalar Markazi</h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Cheklarni tasdiqlash, narxlarni o'zgartirish, erkin pro-rata to'lovlar va foydalanish tarixi
                </p>
              </div>

              {/* Sub-tab Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                <button
                  className={`btn ${subTab === 'receipts' ? 'btn-primary' : 'btn-outline-light'}`}
                  style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setSubTab('receipts');
                    fetchPaymentRequests();
                  }}
                >
                  <span>💳 To'lov Cheklari</span>
                  {paymentRequests.filter(r => r.status === 'Pending').length > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 6px', borderRadius: '8px' }}>
                      {paymentRequests.filter(r => r.status === 'Pending').length}
                    </span>
                  )}
                </button>

                <button
                  className={`btn ${subTab === 'plans_settings' ? 'btn-primary' : 'btn-outline-light'}`}
                  style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '10px' }}
                  onClick={() => {
                    setSubTab('plans_settings');
                    fetchPlans();
                    fetchCardSettings();
                  }}
                >
                  ⚙️ Tarif Narxlari & Karta
                </button>

                <button
                  className={`btn ${subTab === 'active_subs' ? 'btn-primary' : 'btn-outline-light'}`}
                  style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '10px' }}
                  onClick={() => {
                    setSubTab('active_subs');
                    fetchSubscriptions();
                  }}
                >
                  👥 Aktiv Obunalar
                </button>

                <button
                  className={`btn ${subTab === 'logs' ? 'btn-primary' : 'btn-outline-light'}`}
                  style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '10px' }}
                  onClick={() => {
                    setSubTab('logs');
                    fetchLogsAndStats();
                  }}
                >
                  📊 Tarix & Statistika
                </button>
              </div>
            </div>

            {/* 1. TO'LOV CHEKLARI (PAYMENT REQUESTS) SUB-TAB */}
            {subTab === 'receipts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>
                    📥 Foydalanuvchilar tomonidan yuborilgan to'lov cheklari
                  </h4>
                  <button className="btn btn-outline-light" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={fetchPaymentRequests}>
                    🔄 Yangilash
                  </button>
                </div>

                {loadingRequests ? (
                  <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {paymentRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          background: req.status === 'Pending' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.03)',
                          border: `1.5px solid ${req.status === 'Pending' ? '#38bdf8' : req.status === 'Approved' ? '#10b981' : '#ef4444'}`,
                          borderRadius: '16px',
                          padding: '18px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '16px',
                          alignItems: 'center'
                        }}
                      >
                        {/* Chek Screenshot Thumbnail */}
                        <div
                          style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
                          onClick={() => setViewingReceiptUrl(req.receiptImageUrl)}
                        >
                          <img
                            src={req.receiptImageUrl}
                            alt="Receipt"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 800 }}>
                            🔍 Ko'rish
                          </div>
                        </div>

                        {/* Ma'lumotlar */}
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{req.userFullName}</strong>
                            {req.userUsername && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>@{req.userUsername}</span>}
                            <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                              ID: {req.userTelegramId || req.userId}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.88rem', marginTop: '6px' }}>
                            <div>
                              <span style={{ color: '#94a3b8' }}>Tarif: </span>
                              <strong style={{ color: '#38bdf8' }}>{req.planName}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8' }}>Kiritilgan summa: </span>
                              <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>{Number(req.amount).toLocaleString('uz-UZ')} so'm</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8' }}>Hisoblangan muddat: </span>
                              <strong style={{ color: '#4ade80' }}>
                                {Math.floor(req.calculatedDurationHours / 24)} kun {Math.round(req.calculatedDurationHours % 24)} soat
                              </strong>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                            Yuborilgan vaqt: {new Date(req.createdAt).toLocaleString('uz-UZ')}
                            {req.processedAt && ` • Ko'rilgan: ${new Date(req.processedAt).toLocaleString('uz-UZ')} (${req.processedBy})`}
                            {req.adminNotes && ` • Izoh: ${req.adminNotes}`}
                          </div>
                        </div>

                        {/* Holat & Amallar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
                          {req.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-primary"
                                style={{ background: '#10b981', borderColor: '#10b981', padding: '6px 12px', fontSize: '0.82rem' }}
                                disabled={actionLoading}
                                onClick={() => handleApprovePayment(req.id)}
                              >
                                ✅ Tasdiqlash
                              </button>

                              <button
                                className="btn btn-outline-light"
                                style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                                disabled={actionLoading}
                                onClick={() => {
                                  setCorrectingRequest(req);
                                  setCorrectedAmount(req.amount);
                                  setCorrectingNotes('');
                                }}
                              >
                                ✏️ Summani to'g'irlash
                              </button>

                              <button
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                                disabled={actionLoading}
                                onClick={() => handleRejectPayment(req.id)}
                              >
                                ❌ Bekor qilish (Soxta)
                              </button>
                            </div>
                          ) : (
                            <div>
                              {req.status === 'Approved' ? (
                                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '4px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>
                                  ✓ Tasdiqlangan ({req.approvedAmount?.toLocaleString('uz-UZ')} so'm)
                                </span>
                              ) : (
                                <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '4px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>
                                  ✕ Rad etilgan
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {paymentRequests.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', color: '#94a3b8' }}>
                        Hozircha hech qanday to'lov cheki yuborilmagan.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. TARIF NARXLARI & KARTA SOZLAMALARI SUB-TAB */}
            {subTab === 'plans_settings' && (
              <div>
                {/* Admin Karta Rekvizitlari */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '22px', marginBottom: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>💳 Admin Karta Rekvizitlari</h4>
                      <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                        Foydalanuvchilar to'lov sahifasida ko'radigan karta raqami va yo'riqnomasi
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveCardSettings}
                      disabled={savingCardSettings}
                    >
                      {savingCardSettings ? "Saqlanmoqda..." : "💾 Karta sozlamalarini saqlash"}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Karta Raqami</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cardSettings?.cardNumber || ''}
                        onChange={e => setCardSettings({ ...cardSettings, cardNumber: e.target.value })}
                        placeholder="8600 0000 0000 0000"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Karta Egasi (Ism-Familiya)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cardSettings?.cardHolder || ''}
                        onChange={e => setCardSettings({ ...cardSettings, cardHolder: e.target.value })}
                        placeholder="ADMINISTRATOR"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Bank Nomi</label>
                      <input
                        type="text"
                        className="form-control"
                        value={cardSettings?.bankName || ''}
                        onChange={e => setCardSettings({ ...cardSettings, bankName: e.target.value })}
                        placeholder="Humo / Uzcard"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Minimal to'lov summasi (so'm)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={cardSettings?.minAmount || 15000}
                        onChange={e => setCardSettings({ ...cardSettings, minAmount: Number(e.target.value) })}
                        min={1000}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>🎁 Boshlang'ich bonus miqdori (so'm)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={cardSettings?.initialBonusAmount ?? 25000}
                        onChange={e => setCardSettings({ ...cardSettings, initialBonusAmount: Number(e.target.value) })}
                        min={0}
                        step={1000}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>To'lov Yo'riqnomasi va Izohi</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={cardSettings?.instructions || ''}
                      onChange={e => setCardSettings({ ...cardSettings, instructions: e.target.value })}
                      placeholder="Xohlagancha pul o'tkazing..."
                    />
                  </div>
                </div>

                {/* 4 Ta Tarif Narxlari va Parametrlari */}
                <div>
                  <div style={{ marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>👑 4 Ta Tarif Parametrlari & Narxlari</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Har bir tarifning 30 kunlik bazaviy narxi, guruhlar limiti va sinov muddati
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    {plansList.map(p => (
                      <div
                        key={p.planId || p.id}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                      >
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>{p.badge}</div>
                          <h4 style={{ margin: '4px 0 6px 0', fontSize: '1.15rem', color: '#fff' }}>{p.name}</h4>
                          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b', marginBottom: '10px' }}>
                            {Number(p.monthlyPrice || p.price).toLocaleString('uz-UZ')} so'm <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ oy</span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
                            <div>🎯 Roli: <strong>{p.targetRole === 'Student' ? '🎒 Talaba' : "👨‍🏫 O'qituvchi"}</strong></div>
                            <div>👥 Guruh limiti: <strong>{p.maxGroups > 0 ? `${p.maxGroups} tagacha` : 'Guruhsiz (Talaba)'}</strong></div>
                            <div>🎁 Sinov muddati: <strong>{p.hasTrial ? `${p.trialDays || 14} kun bepul` : "Mavjud emas"}</strong></div>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                          onClick={() => setEditingPlan({ ...p })}
                        >
                          ✏️ Narx & Parametrlarni Tahrirlash
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. AKTIV OBUNALAR SUB-TAB */}
            {subTab === 'active_subs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                    👥 Foydalanuvchilarning faol obunalari ro'yxati
                  </h4>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setGrantUserId('');
                      setGrantPlanId('student_monthly');
                      setGrantDurationDays(30);
                      setGrantIsTrial(false);
                      setGrantNotes('');
                      setIsGrantModalOpen(true);
                    }}
                  >
                    + Foydalanuvchiga Obuna Berish
                  </button>
                </div>

                {loadingSubscriptions ? (
                  <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Foydalanuvchi</th>
                        <th>Telegram ID</th>
                        <th>Tarif</th>
                        <th>Turi</th>
                        <th>Boshlanish — Tugash</th>
                        <th>Oxirgi Aktivatsiya</th>
                        <th>Holat</th>
                        <th>Amallar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionsList.map(sub => (
                        <tr key={sub.id}>
                          <td>{sub.id}</td>
                          <td>
                            <strong>{sub.userFullName}</strong>
                            {sub.userUsername && <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>@{sub.userUsername}</div>}
                          </td>
                          <td>{sub.userTelegramId}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#38bdf8' }}>{sub.planName}</span>
                          </td>
                          <td>
                            {sub.isTrial ? (
                              <span style={{ background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
                                Sinov
                              </span>
                            ) : (
                              <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
                                Pullik
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(sub.startDate).toLocaleDateString('uz-UZ')} — {new Date(sub.endDate).toLocaleDateString('uz-UZ')}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {sub.lastActivatedAt ? new Date(sub.lastActivatedAt).toLocaleString('uz-UZ') : '—'}
                          </td>
                          <td>
                            {sub.isCurrentlyActive ? (
                              <span style={{ color: '#4ade80', fontWeight: 700 }}>● Faol</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>● {sub.status === 'Cancelled' ? 'Bekor qilingan' : 'Tugagan'}</span>
                            )}
                          </td>
                          <td>
                            {sub.status === 'Active' && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                onClick={() => handleCancelSubscription(sub.id)}
                              >
                                Bekor qilish
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {subscriptionsList.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                            Hali obunalar mavjud emas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 4. TARIX & STATISTIKA SUB-TAB */}
            {subTab === 'logs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>
                    📊 Har bir tarif bo'yicha jami vaqt va foydalanish statistikasi
                  </h4>
                  <button className="btn btn-outline-light" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={fetchLogsAndStats}>
                    🔄 Yangilash
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
                ) : (
                  <div>
                    {/* STATS CARDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                      <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', borderRadius: '16px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Jami Tushum</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', margin: '4px 0' }}>
                          {Number(logsAndStats?.totalRevenue || 0).toLocaleString('uz-UZ')} so'm
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Jami obuna amallari: {logsAndStats?.totalSubscriptionsCount || 0} ta
                        </div>
                      </div>

                      {logsAndStats?.planStats?.map((ps: any) => (
                        <div key={ps.planId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px' }}>
                          <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>{ps.planName}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>
                            ⏳ {ps.formattedTotalDuration}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            Tushum: {Number(ps.totalPaid).toLocaleString('uz-UZ')} so'm ({ps.count} ta to'lov)
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* DETAILED LOGS TABLE */}
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#cbd5e1' }}>
                      📜 Foydalanuvchilarning obuna vaqtlari tarixi (Logs)
                    </h5>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Foydalanuvchi</th>
                          <th>Tarif</th>
                          <th>Amal turi</th>
                          <th>To'langan summa</th>
                          <th>Qaysi paytdan — Qaysi paytgacha</th>
                          <th>Vaqt hajmi</th>
                          <th>Izohlar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsAndStats?.recentLogs?.map((log: any) => (
                          <tr key={log.id}>
                            <td>{log.id}</td>
                            <td>
                              <strong>{log.userFullName}</strong>
                              {log.userTelegramId && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>ID: {log.userTelegramId}</div>}
                            </td>
                            <td><strong style={{ color: '#38bdf8' }}>{log.planName}</strong></td>
                            <td>
                              <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                                {log.actionType}
                              </span>
                            </td>
                            <td>
                              {log.amountPaid > 0 ? (
                                <strong style={{ color: '#f59e0b' }}>{Number(log.amountPaid).toLocaleString('uz-UZ')} so'm</strong>
                              ) : (
                                <span style={{ opacity: 0.5 }}>0 so'm</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {new Date(log.periodStart).toLocaleDateString('uz-UZ')} — {new Date(log.periodEnd).toLocaleDateString('uz-UZ')}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#4ade80' }}>
                              {Math.floor(log.durationHours / 24)} kun {Math.round(log.durationHours % 24)} soat
                            </td>
                            <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                              {log.notes || '—'}
                            </td>
                          </tr>
                        ))}
                        {(!logsAndStats?.recentLogs || logsAndStats.recentLogs.length === 0) && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                              Hozircha obuna loglari mavjud emas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
              <button className="btn btn-primary" onClick={() => {
                setNotifTargetUserId(null);
                setIsNotifModalOpen(true);
              }}>
                📢 Barchaga Xabar Yuborish
              </button>
            </div>
            {loadingUsers ? (
              <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ismi</th>
                    <th>Telegram ID</th>
                    <th>Admin</th>
                    <th>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.fullName}</td>
                      <td>{u.telegramId}</td>
                      <td>{u.isAdmin ? 'Ha' : 'Yo\'q'}</td>
                      <td>
                        <button className="btn btn-outline-light" style={{ padding: '5px 10px', fontSize: '0.85rem' }} onClick={() => {
                          setNotifTargetUserId(u.id);
                          setIsNotifModalOpen(true);
                        }}>
                          💬 Xabar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Foydalanuvchilar topilmadi</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === 'categories' && (
          <div style={{ maxWidth: '520px' }}>
            <h3 style={{ marginBottom: '20px' }}>Janrlar boshqaruvi</h3>

            {/* Add new */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Yangi janr nomi..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={async e => { if (e.key === 'Enter') { setSavingCategory(true); await fetch('/api/media/categories', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: newCategoryName.trim() }) }); setNewCategoryName(''); fetchCategories(); setSavingCategory(false); } }}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                disabled={!newCategoryName.trim() || savingCategory}
                onClick={async () => {
                  if (!newCategoryName.trim()) return;
                  setSavingCategory(true);
                  await fetch('/api/media/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newCategoryName.trim() })
                  });
                  setNewCategoryName('');
                  fetchCategories();
                  setSavingCategory(false);
                }}
              >
                {savingCategory ? '...' : "Qo'shish"}
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>Hali janrlar yo'q</p>}
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: 500 }}>{cat.name}</span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '5px 12px', fontSize: '13px' }}
                    onClick={async () => {
                      if (!window.confirm(`"${cat.name}" janrini o'chirishga ishonchingiz komilmi?`)) return;
                      await fetch(`/api/media/categories/${cat.id}`, { method: 'DELETE' });
                      fetchCategories();
                    }}
                  >
                    O'chirish
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== GRAMMAR TAB ===== */}
        {activeTab === 'grammar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Grammatik qoidalar boshqaruvi</h3>
              <button className="btn btn-primary" onClick={openCreateGrammar}>
                + Yangi Qoida Qo'shish
              </button>
            </div>

            {loadingGrammar ? (
              <div className="flex-center" style={{ padding: '40px' }}>Yuklanmoqda...</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nomi (Formula)</th>
                    <th>Tavsif</th>
                    <th>Til ID</th>
                    <th>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {grammarList.map(g => (
                    <tr key={g.id}>
                      <td style={{ width: '60px' }}>{g.id}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px' }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {g.description}
                        </span>
                      </td>
                      <td>
                        <span className="grammar-lang-badge">{g.languageId === 1 ? '🇬🇧 EN' : g.languageId === 2 ? '🇷🇺 RU' : `ID:${g.languageId}`}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-outline-light"
                            style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                            onClick={() => { setPreviewGrammar(g); setGrammarPreviewOpen(true); }}
                          >
                            👁 Ko'rish
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                            onClick={() => openEditGrammar(g)}
                          >
                            ✏️ Tahrirlash
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                            onClick={() => handleDeleteGrammar(g.id)}
                          >
                            O'chirish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {grammarList.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                        Hali grammatik qoidalar yo'q
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* ARCHIVES (DELETED DATA SNAPSHOTS) TAB                      */}
        {/* ========================================================== */}
        {activeTab === 'archives' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Archive size={22} color="#f59e0b" />
                  <span>O'chirilgan Ma'lumotlar Arxiv Bazasi</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  O'chirilgan guruhlar, topshiriqlar va materiallar alohida xavfsiz SQLite bazada to'liq JSON snapshot sifatida saqlanadi.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  value={archiveEntityType}
                  onChange={e => {
                    setArchiveEntityType(e.target.value);
                    setTimeout(fetchArchives, 10);
                  }}
                  style={{ width: 'auto', fontSize: '13px' }}
                >
                  <option value="all">Barcha obyektlar</option>
                  <option value="group">Guruhlar</option>
                  <option value="assignment">Topshiriqlar</option>
                  <option value="material">Materiallar</option>
                </select>

                <button
                  className="btn btn-outline-light"
                  onClick={handleCleanupArchives}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={14} color="#ef4444" />
                  <span>Arxivni Tozalash</span>
                </button>

                <button
                  className="btn btn-outline-light"
                  onClick={fetchArchives}
                  style={{ fontSize: '12px' }}
                >
                  🔄 Yangilash
                </button>
              </div>
            </div>

            {loadingArchives ? (
              <div className="flex-center" style={{ padding: '50px' }}>Yuklanmoqda...</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Turi</th>
                    <th>Asl ID</th>
                    <th>O'chirgan Foydalanuvchi</th>
                    <th>O'chirish Sababi</th>
                    <th>O'chirilgan Sana</th>
                    <th>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {archivesList.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <span style={{
                          background: item.entityType === 'group' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: item.entityType === 'group' ? '#38bdf8' : '#c084fc',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {item.entityType}
                        </span>
                      </td>
                      <td>#{item.originalEntityId}</td>
                      <td>
                        <strong>{item.deletedByUserName || 'Noma\'lum'}</strong>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {item.deletedByUserId}</div>
                      </td>
                      <td style={{ maxWidth: '240px', fontSize: '12px', color: '#cbd5e1' }}>
                        {item.reason || 'Tarif limiti yoki foydalanuvchi so\'rovi'}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {new Date(item.archivedAt).toLocaleString('uz-UZ')}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-light"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => {
                            try {
                              setSelectedArchiveJson(JSON.parse(item.dataJson));
                            } catch {
                              setSelectedArchiveJson(item.dataJson);
                            }
                          }}
                        >
                          👁️ JSON Snapshot
                        </button>
                      </td>
                    </tr>
                  ))}
                  {archivesList.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                        Arxivda hozircha o'chirilgan ma'lumotlar mavjud emas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {editingMedia && (
        <AdminMediaEditModal
          media={editingMedia}
          onClose={() => setEditingMedia(null)}
          onUpdate={() => {
            fetchMedia();
            setEditingMedia(null);
          }}
        />
      )}

      {isCreatingMedia && (
        <CreateMediaModal
          onClose={() => setIsCreatingMedia(false)}
          onCreated={(newMedia) => {
            fetchMedia();
            setIsCreatingMedia(false);
            setEditingMedia(newMedia); // Open edit modal immediately for adding episodes/video
          }}
        />
      )}

      {/* Notification Modal */}
      {isNotifModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNotifModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '90vw' }}>
            <div className="modal-header">
              <h2>{notifTargetUserId ? 'Foydalanuvchiga xabar yuborish' : 'Barchaga xabar yuborish'}</h2>
              <button className="icon-btn" onClick={() => setIsNotifModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Sarlavha (Mavzu)</label>
                <input
                  type="text"
                  className="form-control"
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  placeholder="Masalan: Yangi Kino Qo'shildi!"
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Xabar matni</label>
                <textarea
                  className="form-control"
                  value={notifMessage}
                  onChange={e => setNotifMessage(e.target.value)}
                  rows={4}
                  placeholder="Matnni kiriting..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn btn-outline-light" onClick={() => setIsNotifModalOpen(false)}>Bekor qilish</button>
                <button className="btn btn-primary" onClick={handleSendNotification} disabled={sendingNotif || !notifTitle || !notifMessage}>
                  {sendingNotif ? 'Yuborilmoqda...' : 'Yuborish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grammar Create/Edit Modal */}
      {grammarModalOpen && (
        <div className="modal-overlay" onClick={() => setGrammarModalOpen(false)}>
          <div
            className="modal-content animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{ width: '680px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h2>{editingGrammar ? 'Grammatik qoidani tahrirlash' : "Yangi grammatik qoida qo'shish"}</h2>
              <button className="icon-btn" onClick={() => setGrammarModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                <div className="grammar-form-group">
                  <label>Nomi / Formula <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Masalan: Present Perfect + just/already"
                    value={grammarForm.name}
                    onChange={e => setGrammarForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grammar-form-group">
                  <label>Til</label>
                  <select
                    className="form-control"
                    value={grammarForm.languageId}
                    onChange={e => setGrammarForm(f => ({ ...f, languageId: Number(e.target.value) }))}
                  >
                    <option value={1}>🇬🇧 English</option>
                    <option value={2}>🇷🇺 Russian</option>
                  </select>
                </div>
              </div>

              <div className="grammar-form-group">
                <label>Qisqa tavsif <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Bu qoida haqida qisqa tushuntirish..."
                  value={grammarForm.description}
                  onChange={e => setGrammarForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grammar-form-group">
                <label>
                  Batafsil tushuntirish (Markdown)
                  <span style={{ color: '#ef4444' }}> *</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    **qalin**, *kursiv*, `kod`, &gt; iqtibos, - ro'yxat
                  </span>
                </label>
                <textarea
                  className="form-control grammar-content-textarea"
                  placeholder={`### Tushuntirish\nBu qoida haqida batafsil ma'lumot...\n\n**Qanday yasaladi:**\n> Asosiy qoida...\n\n**Misollar:**\n- Birinchi misol\n- Ikkinchi misol`}
                  value={grammarForm.content}
                  onChange={e => setGrammarForm(f => ({ ...f, content: e.target.value }))}
                  rows={10}
                />
              </div>

              <div className="grammar-form-group">
                <label>Video URL (ixtiyoriy)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://youtube.com/..."
                  value={grammarForm.videoUrl}
                  onChange={e => setGrammarForm(f => ({ ...f, videoUrl: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button className="btn btn-outline-light" onClick={() => setGrammarModalOpen(false)}>Bekor qilish</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveGrammar}
                  disabled={savingGrammar || !grammarForm.name.trim() || !grammarForm.description.trim() || !grammarForm.content.trim()}
                >
                  {savingGrammar ? 'Saqlanmoqda...' : editingGrammar ? 'Saqlash' : "Qo'shish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grammar Markdown Preview Modal */}
      {grammarPreviewOpen && previewGrammar && (
        <div className="modal-overlay" onClick={() => setGrammarPreviewOpen(false)}>
          <div
            className="modal-content animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{ width: '660px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{previewGrammar.name}</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{previewGrammar.description}</p>
              </div>
              <button className="icon-btn" onClick={() => setGrammarPreviewOpen(false)}>✕</button>
            </div>
            <div className="modal-body markdown-body" style={{ marginTop: '20px', color: 'var(--text-primary)', lineHeight: '1.75' }}>
              <ReactMarkdown>{previewGrammar.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Grant Subscription Modal */}
      {isGrantModalOpen && (
        <div className="modal-overlay" onClick={() => setIsGrantModalOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '560px', maxWidth: '92vw' }}>
            <div className="modal-header">
              <h2>👑 Foydalanuvchiga Obuna Berish</h2>
              <button className="icon-btn" onClick={() => setIsGrantModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Foydalanuvchi tanlang <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className="form-control"
                  value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">-- Foydalanuvchini tanlang --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (ID: {u.id}{u.telegramId ? `, @${u.telegramId}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Tarif tanlang</label>
                <select
                  className="form-control"
                  value={grantPlanId}
                  onChange={e => setGrantPlanId(e.target.value)}
                >
                  {plansList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.formattedPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Muddat (kunlarda)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={grantDurationDays}
                    onChange={e => setGrantDurationDays(Number(e.target.value))}
                    min={1}
                    max={730}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                  <input
                    type="checkbox"
                    id="grantIsTrial"
                    checked={grantIsTrial}
                    onChange={e => setGrantIsTrial(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="grantIsTrial" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    🎁 Bepul sinov statusi
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Izoh (ixtiyoriy)</label>
                <input
                  type="text"
                  className="form-control"
                  value={grantNotes}
                  onChange={e => setGrantNotes(e.target.value)}
                  placeholder="Masalan: Maxsus chegirma yoki sovg'a"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button className="btn btn-outline-light" onClick={() => setIsGrantModalOpen(false)}>Bekor qilish</button>
                <button
                  className="btn btn-primary"
                  onClick={handleGrantSubscription}
                  disabled={grantingSub || !grantUserId}
                >
                  {grantingSub ? 'Faollashtirilmoqda...' : 'Obunani Faollashtirish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Receipt Image Lightbox */}
      {viewingReceiptUrl && (
        <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(0,0,0,0.85)' }} onClick={() => setViewingReceiptUrl(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: 'auto', maxWidth: '90vw', maxHeight: '90vh', background: 'transparent', border: 'none', padding: 0, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button className="icon-btn" style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: '36px', height: '36px' }} onClick={() => setViewingReceiptUrl(null)}>✕</button>
            </div>
            <img
              src={viewingReceiptUrl}
              alt="Receipt full"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', border: '2px solid rgba(255,255,255,0.2)' }}
            />
          </div>
        </div>
      )}

      {/* Correct Amount & Approve Modal */}
      {correctingRequest && (
        <div className="modal-overlay" onClick={() => setCorrectingRequest(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '520px', maxWidth: '92vw' }}>
            <div className="modal-header">
              <h2>✏️ Summani To'g'rilash va Tasdiqlash</h2>
              <button className="icon-btn" onClick={() => setCorrectingRequest(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 14px', borderRadius: '12px', fontSize: '13px' }}>
                <div>Foydalanuvchi: <strong>{correctingRequest.userFullName}</strong></div>
                <div>Tarif: <strong style={{ color: '#38bdf8' }}>{correctingRequest.planName}</strong></div>
                <div>Foydalanuvchi kiritgan summa: <strong style={{ color: '#f59e0b' }}>{Number(correctingRequest.amount).toLocaleString('uz-UZ')} so'm</strong></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#e2e8f0', marginBottom: '6px' }}>
                  Chekdagi haqiqiy to'langan summa (so'm) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={correctedAmount}
                  onChange={e => setCorrectedAmount(Number(e.target.value))}
                  min={1000}
                  step={1000}
                />
                <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  💡 Obuna muddati ushbu aniq summaga mutanosib ravishda minutlarigacha hisoblab qo'shiladi!
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Admin izohi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={correctingNotes}
                  onChange={e => setCorrectingNotes(e.target.value)}
                  placeholder="Masalan: Chekda 40 000 so'm ko'ringanligi sababli to'g'irlandi"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button className="btn btn-outline-light" onClick={() => setCorrectingRequest(null)}>Bekor qilish</button>
                <button
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  disabled={actionLoading || !correctedAmount || correctedAmount < 1000}
                  onClick={() => handleApprovePayment(correctingRequest.id, correctedAmount, correctingNotes)}
                >
                  {actionLoading ? 'Tasdiqlanmoqda...' : '✅ To\'g\'irlab Tasdiqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="modal-overlay" onClick={() => setEditingPlan(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '560px', maxWidth: '92vw' }}>
            <div className="modal-header">
              <h2>⚙️ Tarifni Tahrirlash: {editingPlan.name}</h2>
              <button className="icon-btn" onClick={() => setEditingPlan(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Tarif Nomi</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Oylik Narxi (so'm)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editingPlan.monthlyPrice || editingPlan.price || 0}
                    onChange={e => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value), price: Number(e.target.value) })}
                    min={0}
                    step={1000}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Maksimal Guruhlar Soni</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editingPlan.maxGroups || 0}
                    onChange={e => setEditingPlan({ ...editingPlan, maxGroups: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Nishon (Badge)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingPlan.badge || ''}
                    onChange={e => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    placeholder="Masalan: Tavsiya etiladi"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Sinov muddati (kunlarda)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editingPlan.trialDays || 0}
                    onChange={e => setEditingPlan({ ...editingPlan, trialDays: Number(e.target.value), hasTrial: Number(e.target.value) > 0 })}
                    min={0}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '8px' }}>
                <input
                  type="checkbox"
                  id="planHasTrial"
                  checked={editingPlan.hasTrial || false}
                  onChange={e => setEditingPlan({ ...editingPlan, hasTrial: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="planHasTrial" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  🎁 Ushbu tarifda bepul sinov muddati mavjud
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button className="btn btn-outline-light" onClick={() => setEditingPlan(null)}>Bekor qilish</button>
                <button
                  className="btn btn-primary"
                  disabled={savingPlan}
                  onClick={handleSavePlan}
                >
                  {savingPlan ? 'Saqlanmoqda...' : '💾 Tarifni Saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Confirmation Modal */}
      {showBroadcastConfirm && (
        <div className="modal-overlay" onClick={() => setShowBroadcastConfirm(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '92vw' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle color="#f59e0b" size={24} />
                <span>Reklama Tarqatishni Tasdiqlash</span>
              </h2>
              <button className="icon-btn" onClick={() => setShowBroadcastConfirm(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '14px', fontSize: '13px', color: '#fcd34d', lineHeight: 1.5 }}>
                ⚠️ <b>Diqqat:</b> Ushbu xabar Telegram orqali tanlangan auditoriyadagi barcha foydalanuvchilarning shaxsiy xabarnomasiga (bot orqali) to'g'ridan-to'g'ri yuboriladi.
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Tanlangan auditoriya:</span>
                  <strong style={{ color: '#38bdf8', textTransform: 'uppercase' }}>
                    {broadcastTarget === 'all'
                      ? '🌐 Barcha Telegram foydalanuvchilari'
                      : broadcastTarget === 'free'
                      ? '🎁 Obunasiz (Bepul)'
                      : broadcastTarget === 'students'
                      ? '🎓 Talabalar'
                      : broadcastTarget === 'teachers'
                      ? '👨‍🏫 O\'qituvchilar'
                      : '⭐ Faol Premium'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Qabul qiluvchilar soni:</span>
                  <strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>
                    {broadcastTarget === 'all'
                      ? (broadcastStats?.telegramUsers ?? 0)
                      : broadcastTarget === 'free'
                      ? (broadcastStats?.freeUsers ?? 0)
                      : broadcastTarget === 'students'
                      ? (broadcastStats?.students ?? 0)
                      : broadcastTarget === 'teachers'
                      ? (broadcastStats?.teachers ?? 0)
                      : (broadcastStats?.premiumUsers ?? 0)} ta foydalanuvchi
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Banner rasmi:</span>
                  <span>{broadcastPhotoUrl ? '✅ Mavjud' : '❌ Yo\'q (Faqat matn)'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button className="btn btn-outline-light" onClick={() => setShowBroadcastConfirm(false)}>
                  Bekor qilish
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', fontWeight: 800 }}
                  onClick={handleSendBroadcast}
                >
                  Ha, Tarqatishni Boshlash 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast In-Progress Overlay Modal */}
      {isSendingBroadcast && (
        <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-content animate-fade-in" style={{ width: '420px', textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚀</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>Xabarlar Tarqatilmoqda...</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5 }}>
              {broadcastProgress || 'Telegram API orqali foydalanuvchilarga xabarlar yetkazilmoqda. Iltimos sahifani yopmang.'}
            </p>
            <div style={{ marginTop: '20px' }}>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: '#38bdf8', borderRadius: '2px', animation: 'fadeIn 1s infinite alternate' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive JSON Viewer Modal */}
      {selectedArchiveJson && (
        <div className="modal-overlay" onClick={() => setSelectedArchiveJson(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ width: '700px', maxWidth: '94vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2>🗄️ Arxivlangan Ma'lumot Snapshot (JSON)</h2>
              <button className="icon-btn" onClick={() => setSelectedArchiveJson(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '16px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <button
                  className="btn btn-outline-light"
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedArchiveJson, null, 2));
                    alert("JSON nusxalandi!");
                  }}
                >
                  <Copy size={12} /> Nusxa olish
                </button>
              </div>
              <pre style={{
                background: '#090d16',
                color: '#38bdf8',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '480px'
              }}>
                {typeof selectedArchiveJson === 'string' ? selectedArchiveJson : JSON.stringify(selectedArchiveJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
