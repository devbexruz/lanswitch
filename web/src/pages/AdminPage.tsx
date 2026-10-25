import React, { useState, useEffect } from 'react';
import './AdminPage.css';
import { useAuth } from '../context/AuthContext';
import AdminMediaEditModal from './AdminMediaEditModal';
import CreateMediaModal from './CreateMediaModal';
import ReactMarkdown from 'react-markdown';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingMedia, setEditingMedia] = useState<any>(null);
  const [isCreatingMedia, setIsCreatingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState<'media' | 'subscriptions' | 'users' | 'categories' | 'grammar'>('media');
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

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
  }, []);

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
            <p className="admin-subtitle">Tariflar, erkin to'lovlar, kvitansiyalar va platforma boshqaruvi</p>
          </div>
        </div>

        <div className="admin-nav-tabs">
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
        </div>
      </div>

      <div className="admin-glass-container">
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
    </div>
  );
};

export default AdminPage;
