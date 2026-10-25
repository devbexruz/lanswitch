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

  // Subscriptions state
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Tizimni boshqarish paneli</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'media' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
          <button
            className={`btn ${activeTab === 'subscriptions' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => {
              setActiveTab('subscriptions');
              fetchSubscriptions();
            }}
          >
            👑 Tariflar & Obunalar
          </button>
          <button
            className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('categories')}
          >
            Janrlar
          </button>
          <button
            className={`btn ${activeTab === 'grammar' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('grammar')}
          >
            📖 Grammatika
          </button>
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab('users')}
          >
            Foydalanuvchilar
          </button>
        </div>
      </div>

      <div className="admin-content glass-panel">
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
        {activeTab === 'subscriptions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>👑 Tariflar va Obunalar boshqaruvi</h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Barcha foydalanuvchilarning aktiv obunalari va sinov muddatlarini nazorat qilish
                </p>
              </div>
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

            {/* Plans Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {plansList.map(p => (
                <div key={p.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>{p.badge}</div>
                  <h4 style={{ margin: '4px 0 8px 0', fontSize: '1.05rem', color: '#fff' }}>{p.name}</h4>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>{p.formattedPrice}</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                    {p.targetRole === 'Student' ? 'Talabalar rejimi' : `${p.maxGroups} tagacha guruh`}
                    {p.hasTrial && ' • 14 kun bepul sinov'}
                  </div>
                </div>
              ))}
            </div>

            {/* Subscriptions Table */}
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
                    <th>Muddat</th>
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
                            14 kunlik sinov
                          </span>
                        ) : (
                          <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
                            Pullik
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {new Date(sub.startDate).toLocaleDateString('uz-UZ')} — {new Date(sub.endDate).toLocaleDateString('uz-UZ')}
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
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
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
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                        Hali obunalar mavjud emas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
    </div>
  );
};

export default AdminPage;
