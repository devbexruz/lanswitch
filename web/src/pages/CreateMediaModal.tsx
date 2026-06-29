import React, { useState } from 'react';
import ReactDOM from 'react-dom';

interface CreateMediaModalProps {
  onClose: () => void;
  onCreated: (newMedia: any) => void;
}

const CreateMediaModal: React.FC<CreateMediaModalProps> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isFilm, setIsFilm] = useState(true);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [languageId, setLanguageId] = useState<number>(2);
  const [level, setLevel] = useState('A1');
  const [languages, setLanguages] = useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/language')
      .then(res => res.json())
      .then(data => {
        setLanguages(data);
        if (data.length > 0) setLanguageId(data[0].id);
      })
      .catch(err => console.error(err));
  }, []);

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
        setThumbnailUrl(data.url);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          isFilm,
          thumbnailUrl,
          languageId,
          level
        })
      });

      if (res.ok) {
        const newMedia = await res.json();
        onCreated(newMedia);
      } else {
        alert("Saqlashda xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
      alert("Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" style={{ width: '800px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yangi Media Qo'shish</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body modal-grid" style={{ marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Nomi (Sarlavha)</label>
            <input 
              type="text" 
              className="form-control" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="Masalan: Interstellar"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Tavsif</label>
            <textarea 
              className="form-control" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Qisqacha ta'rifi..."
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Turi</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button"
                className={`btn ${isFilm ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setIsFilm(true)}
              >
                Kino
              </button>
              <button 
                type="button"
                className={`btn ${!isFilm ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setIsFilm(false)}
              >
                Serial
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
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
              <input 
                type="text" 
                className="form-control" 
                placeholder="Masalan: B1, C1" 
                value={level} 
                onChange={(e) => setLevel(e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Muqova (Rasm yuklash)</label>
            <input 
              type="file" 
              accept="image/*"
              className="form-control" 
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
            {uploadingImage && <div style={{ marginTop: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Yuklanmoqda...</div>}
            {thumbnailUrl && (
              <div style={{ marginTop: '10px' }}>
                <img src={thumbnailUrl} alt="Thumbnail preview" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', maxHeight: '150px' }} />
              </div>
            )}
          </div>

          <div className="modal-grid-full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
            <button type="button" className="btn btn-outline-light" onClick={onClose}>Bekor qilish</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateMediaModal;
