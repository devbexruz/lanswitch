import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './AdminPage.css';
import settings from '../settings.json';

interface AdminMediaEditModalProps {
  media: any;
  onClose: () => void;
  onUpdate: () => void;
}

const AdminMediaEditModal: React.FC<AdminMediaEditModalProps> = ({ media, onClose, onUpdate }) => {
  const [isFilm, setIsFilm] = useState(media.isFilm);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [title, setTitle] = useState(media.title || '');
  const [description, setDescription] = useState(media.description || '');
  const [videoUrl, setVideoUrl] = useState(media.videoUrl || '');
  const [languageId, setLanguageId] = useState<number>(media.languageId || 2);
  const [level, setLevel] = useState(media.level || 'A1');
  const [languages, setLanguages] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(media.categoryIds || []);
  
  // Episode management
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpNumber, setNewEpNumber] = useState('');
  const [newEpVideoUrl, setNewEpVideoUrl] = useState('');

  // Subtitles management
  const [subtitlesCount, setSubtitlesCount] = useState<number | null>(null);
  const [uploadingSubtitles, setUploadingSubtitles] = useState(false);
  const [subtitlePasteText, setSubtitlePasteText] = useState('');
  const [showSubtitlePasteModal, setShowSubtitlePasteModal] = useState(false);
  const [targetSubtitleEpisodeId, setTargetSubtitleEpisodeId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/language')
      .then(res => res.json())
      .then(data => setLanguages(data))
      .catch(err => console.error(err));
    fetch('/api/media/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error(err));
    
    fetchSubtitleCount();
  }, []);

  useEffect(() => {
    if (!isFilm) {
      fetchEpisodes();
    }
  }, [isFilm]);

  const fetchSubtitleCount = async (epId: number | null = null) => {
    try {
      const url = epId ? `/api/subtitle?episodeId=${epId}` : `/api/subtitle?mediaId=${media.id}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSubtitlesCount(data.length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEpisodes = async () => {
    try {
      const res = await fetch(`/api/episodes/media/${media.id}`);
      if (res.ok) {
        setEpisodes(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleType = async () => {
    try {
      const res = await fetch(`/api/media/${media.id}/toggle-type`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        setIsFilm(data.isFilm);
        onUpdate();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        const newUrl = data.url;
        
        const updateRes = await fetch(`/api/media/${media.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...media, thumbnailUrl: newUrl })
        });
        
        if (updateRes.ok) {
          onUpdate();
        } else {
          alert("Kino ma'lumotlarini yangilashda xatolik yuz berdi");
        }
      } else {
        alert("Rasm yuklashda xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
      alert("Tarmoq xatosi (Rasm yuklash)");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveMainInfo = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...media,
          title,
          description,
          videoUrl,
          languageId,
          level,
          categoryIds: selectedCategoryIds
        })
      });
      if (res.ok) {
        alert("Ma'lumotlar muvaffaqiyatli saqlandi!");
        onUpdate();
      } else {
        alert("Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateEpisodeSubmit = async () => {
    if (!newEpTitle) return;
    try {
      const res = await fetch('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mediaId: media.id, 
          title: newEpTitle,
          episodeNumber: newEpNumber ? parseInt(newEpNumber) : null,
          videoUrl: newEpVideoUrl
        })
      });
      
      if (res.ok) {
        fetchEpisodes();
        setIsAddingEpisode(false);
        setNewEpTitle('');
        setNewEpNumber('');
        setNewEpVideoUrl('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm("Ushbu epizodni o'chirishga ishonchingiz komilmi?")) return;
    try {
      const res = await fetch(`/api/episodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEpisodes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Subtitle file upload
  const handleSubtitleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, epId: number | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSubtitles(true);
    const formData = new FormData();
    formData.append('file', file);
    if (epId) {
      formData.append('episodeId', epId.toString());
    } else {
      formData.append('mediaId', media.id.toString());
    }
    formData.append('replaceExisting', 'true');

    try {
      const res = await fetch('/api/subtitle/upload-file', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Subtitrlar muvaffaqiyatli yuklandi!");
        fetchSubtitleCount(epId);
      } else {
        alert(data || "Subtitr faylini yuklashda xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
      alert("Tarmoq xatosi (Subtitr yuklash)");
    } finally {
      setUploadingSubtitles(false);
      e.target.value = '';
    }
  };

  // Subtitle text upload
  const handleSaveSubtitleText = async () => {
    if (!subtitlePasteText.trim()) return;
    setUploadingSubtitles(true);
    try {
      const res = await fetch('/api/subtitle/upload-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: targetSubtitleEpisodeId ? null : media.id,
          episodeId: targetSubtitleEpisodeId,
          content: subtitlePasteText,
          replaceExisting: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Subtitrlar saqlandi!");
        setShowSubtitlePasteModal(false);
        setSubtitlePasteText('');
        fetchSubtitleCount(targetSubtitleEpisodeId);
      } else {
        alert(data || "Subtitr formatida xatolik");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setUploadingSubtitles(false);
    }
  };

  const handleUploadFilmVideo = () => {
    window.open(`tg://resolve?domain=${settings.botUsername || 'lanswitchbot'}&start=upload_film_${media.id}`, '_blank');
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '850px', maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Tahrirlash: {media.title}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body modal-grid" style={{ marginTop: '20px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Sarlavha</label>
            <input 
              type="text" 
              className="form-control" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>

          <div className="modal-grid-full">
            <label style={{ display: 'block', marginBottom: '5px' }}>Ta'rif</label>
            <textarea 
              className="form-control" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              rows={3}
            />
          </div>

          <div className="modal-grid-full">
            <label style={{ display: 'block', marginBottom: '5px' }}>Video URL (MP4 / HLS / R2 URL)</label>
            <input 
              type="text" 
              className="form-control" 
              value={videoUrl} 
              onChange={(e) => setVideoUrl(e.target.value)} 
              placeholder="https://... (to'g'ridan-to'g'ri video manzili)"
            />
          </div>

          <div className="modal-grid-full" style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Til</label>
              <select 
                className="form-control" 
                value={languageId} 
                onChange={(e) => setLanguageId(Number(e.target.value))}
              >
                {languages.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Daraja</label>
              <select 
                className="form-control" 
                value={level} 
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper-Intermediate</option>
                <option value="C1">C1 - Advanced</option>
                <option value="C2">C2 - Proficiency</option>
              </select>
            </div>
          </div>

          <div className="modal-grid-full">
            <label style={{ display: 'block', marginBottom: '8px' }}>Janrlar</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryIds(prev =>
                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                  )}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1.5px solid',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    borderColor: selectedCategoryIds.includes(cat.id) ? '#6366f1' : 'rgba(255,255,255,0.2)',
                    background: selectedCategoryIds.includes(cat.id) ? '#6366f1' : 'transparent',
                    color: 'white'
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-grid-full">
            <button className="btn btn-primary" onClick={handleSaveMainInfo} disabled={isSaving}>
              {isSaving ? "Saqlanmoqda..." : "Asosiy ma'lumotlarni saqlash"}
            </button>
          </div>

          <div className="modal-grid-full" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontWeight: 'bold' }}>Turi:</span>
            <button 
              className={`btn ${isFilm ? 'btn-primary' : 'btn-outline-light'}`}
              onClick={toggleType}
            >
              Kino
            </button>
            <button 
              className={`btn ${!isFilm ? 'btn-primary' : 'btn-outline-light'}`}
              onClick={toggleType}
            >
              Serial
            </button>
          </div>

          {/* Subtitles Management Section for Film */}
          {isFilm && (
            <div className="glass-panel modal-grid-full" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>📝 Subtitrlar boshqaruvi</h3>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                    Bazadagi subtitrlar soni: <strong>{subtitlesCount !== null ? `${subtitlesCount} ta` : 'Aniqlanmoqda...'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <label className="btn btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploadingSubtitles ? 'Yuklanmoqda...' : '📁 .SRT / .VTT fayl yuklash'}
                    <input
                      type="file"
                      accept=".srt,.vtt,.txt"
                      style={{ display: 'none' }}
                      onChange={(e) => handleSubtitleFileUpload(e, null)}
                      disabled={uploadingSubtitles}
                    />
                  </label>
                  <button
                    className="btn btn-outline-light"
                    onClick={() => {
                      setTargetSubtitleEpisodeId(null);
                      setShowSubtitlePasteModal(true);
                    }}
                  >
                    ✏️ Matn orqali kiritish
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Thumbnail image upload */}
          <div className="modal-grid-full" style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Muqova rasmini o'zgartirish</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {media.thumbnailUrl && (
                <img src={media.thumbnailUrl} alt="Thumbnail" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
              )}
              <div style={{ flex: 1 }}>
                <input 
                  type="file" 
                  accept="image/*"
                  className="form-control" 
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                {uploadingImage && <div style={{ marginTop: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rasmni R2 ga yuklab, saqlanmoqda...</div>}
              </div>
            </div>
          </div>

          <div className="glass-panel modal-grid-full" style={{ padding: '20px', borderRadius: '12px' }}>
            {isFilm ? (
              <div style={{ textAlign: 'center' }}>
                <h3>Kino Videosi</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '15px' }}>
                  {videoUrl ? `Video URL mavjud: ${videoUrl.substring(0, 50)}...` : "Video havolasini yuqoridagi maydonga yozing yoki bot orqali yuklang."}
                </p>
                <button className="btn btn-outline-light" onClick={handleUploadFilmVideo}>
                  ✈️ Telegram Bot orqali Video Yuklash
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3>Epizodlar ro'yxati</h3>
                  <button className="btn btn-primary" onClick={() => setIsAddingEpisode(!isAddingEpisode)}>
                    {isAddingEpisode ? "Bekor qilish" : "+ Yangi Epizod"}
                  </button>
                </div>
                
                {isAddingEpisode && (
                  <div style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Nomi (Sarlavha)</label>
                        <input type="text" className="form-control" value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="Epizod nomi" />
                      </div>
                      <div style={{ width: '100px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Raqami</label>
                        <input type="number" className="form-control" value={newEpNumber} onChange={e => setNewEpNumber(e.target.value)} placeholder="Avto" />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Video URL (ixtiyoriy)</label>
                      <input type="text" className="form-control" value={newEpVideoUrl} onChange={e => setNewEpVideoUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button className="btn btn-outline-light" onClick={() => setIsAddingEpisode(false)}>Bekor qilish</button>
                      <button className="btn btn-primary" onClick={handleCreateEpisodeSubmit} disabled={!newEpTitle}>Saqlash</button>
                    </div>
                  </div>
                )}
                
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {episodes.map(ep => (
                    <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <div>
                        <strong>{ep.episodeNumber}-qism:</strong> {ep.title} 
                        {ep.videoUrl ? <span style={{ color: '#4ade80', marginLeft: '10px', fontSize: '0.8rem' }}>✓ Video bor</span> : <span style={{ color: '#ef4444', marginLeft: '10px', fontSize: '0.8rem' }}>✗ Video yo'q</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label className="btn btn-outline-light" style={{ padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                          📁 Subtitr
                          <input
                            type="file"
                            accept=".srt,.vtt,.txt"
                            style={{ display: 'none' }}
                            onChange={(e) => handleSubtitleFileUpload(e, ep.id)}
                          />
                        </label>
                        <button className="btn btn-outline-light" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => window.open(`tg://resolve?domain=${settings.botUsername || 'lanswitchbot'}&start=upload_episode_${ep.id}`, '_blank')}>✈️ Bot</button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDeleteEpisode(ep.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                  {episodes.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>Hali epizodlar yo'q.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle Paste Modal */}
      {showSubtitlePasteModal && (
        <div className="modal-overlay" onClick={() => setShowSubtitlePasteModal(false)} style={{ zIndex: 100000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '650px', maxWidth: '90vw' }}>
            <div className="modal-header">
              <h3>Subtitr matnini joylashtirish (.srt / .vtt)</h3>
              <button className="icon-btn" onClick={() => setShowSubtitlePasteModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>
                SRT yoki WebVTT formatidagi subtitr matnini quyidagi maydonga qo'ying:
              </p>
              <textarea
                className="form-control"
                rows={12}
                value={subtitlePasteText}
                onChange={e => setSubtitlePasteText(e.target.value)}
                placeholder={`1\n00:00:01,000 --> 00:00:04,000\nHello world!\n\n2\n00:00:05,000 --> 00:00:08,000\nWelcome to Lanswitch.`}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button className="btn btn-outline-light" onClick={() => setShowSubtitlePasteModal(false)}>Bekor qilish</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSubtitleText}
                  disabled={uploadingSubtitles || !subtitlePasteText.trim()}
                >
                  {uploadingSubtitles ? 'Saqlanmoqda...' : 'Subtitrlarni saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default AdminMediaEditModal;
