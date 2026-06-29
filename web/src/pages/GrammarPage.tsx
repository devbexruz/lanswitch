import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './GrammarPage.css';
import { useLanguage } from '../context/LanguageContext';
import ReactMarkdown from 'react-markdown';

// Mock data
const mockGrammar: Record<'en' | 'ru', any[]> = {
  en: [
    { id: 1, formula: "Present Perfect + just/already", context: "O'tmishda tugagan, lekin natijasi hozirga ta'sir qiladigan harakatlar", status: "active", timesUsed: 24 },
    { id: 2, formula: "If + Past Simple, ... would + V1", context: "Second Conditional (Hozirgi vaqtdagi haqiqatga zid shartlar)", status: "inactive", timesUsed: 5 },
    { id: 3, formula: "Be used to + V-ing", context: "Biror narsaga o'rganib qolganlikni ifodalash", status: "new", timesUsed: 0 },
    { id: 4, formula: "Had better + V1", context: "Kimgadir maslahat berganda 'yaxshisi... qilsang bo'lardi'", status: "active", timesUsed: 12 },
  ],
  ru: [
    { id: 101, formula: "Творительный падеж (Кем? Чем?)", context: "Harakatning qanday qurol/vosita yordamida bajarilishini bildiradi", status: "new", timesUsed: 0 },
    { id: 102, formula: "Совершенный вид глагола", context: "Tugallangan va natijaga ega harakatlar", status: "active", timesUsed: 15 },
    { id: 103, formula: "Дательный падеж (Кому? Чему?)", context: "Harakat yo'naltirilgan ob'ektni ifodalash", status: "inactive", timesUsed: 3 },
  ]
};

const GrammarPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewFormula, setReviewFormula] = useState<any | null>(null);
  const { learningLanguage } = useLanguage();
  
  const currentGrammar = mockGrammar[learningLanguage];
  const filteredGrammar = filterStatus === 'all' ? currentGrammar : currentGrammar.filter(g => g.status === filterStatus);

  const mockMarkdownContent = `
### Tushuntirish
Bu grammatik qoida asosan **muhim va kundalik suhbatlarda** ko'p qo'llaniladi.

**Qanday yasaladi:**
> Asosiy qoida bu yerda joylashadi...

**Misollar:**
- Birinchi misol *(tarjimasi)*
- Ikkinchi misol *(tarjimasi)*

**Muhim:** Xatoga yo'l qo'ymaslik uchun maxsus istisnolarga e'tibor bering.
  `;

  return (
    <div className="grammar-page animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Grammatika va Kontekst</h1>
          <p className="page-subtitle">O'rganilgan sintaksis va formulalar to'plami</p>
        </div>
        <div className="header-actions-group">
          <button className="btn btn-primary">Kashf etish</button>
        </div>
      </div>

      {/* Stats Header */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">45</span>
            <span className="stat-label">Jami formulalar</span>
          </div>
        </div>
        
        <div className="stat-card glass-panel" style={{ borderColor: 'rgba(102, 155, 188, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(102, 155, 188, 0.2)', color: 'var(--color-steel-blue)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--color-steel-blue)' }}>30</span>
            <span className="stat-label">Faol (Active)</span>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderColor: 'rgba(244, 211, 94, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(244, 211, 94, 0.2)', color: 'var(--color-papaya-whip)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--color-papaya-whip)' }}>10</span>
            <span className="stat-label">Unutilayotgan (Inactive)</span>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ borderColor: 'rgba(193, 18, 31, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(193, 18, 31, 0.2)', color: 'var(--color-flag-red)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--color-flag-red)' }}>5</span>
            <span className="stat-label">Yangi o'rganilmagan (New)</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline-light'}`}
          onClick={() => setFilterStatus('all')}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '20px' }}
        >Barchasi</button>
        <button 
          className={`btn ${filterStatus === 'active' ? 'btn-primary' : 'btn-outline-light'}`}
          onClick={() => setFilterStatus('active')}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '20px' }}
        >Faol</button>
        <button 
          className={`btn ${filterStatus === 'inactive' ? 'btn-primary' : 'btn-outline-light'}`}
          onClick={() => setFilterStatus('inactive')}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '20px' }}
        >Takrorlang</button>
        <button 
          className={`btn ${filterStatus === 'new' ? 'btn-primary' : 'btn-outline-light'}`}
          onClick={() => setFilterStatus('new')}
          style={{ padding: '0.5rem 1.5rem', borderRadius: '20px' }}
        >Yangi</button>
      </div>

      {/* Grammar Context List */}
      <div className="grammar-list glass-panel">
         {filteredGrammar.map((item: any) => (
           <div key={item.id} className={`grammar-card status-${item.status}`}>
             <div className="grammar-card-header">
               <h3 className="grammar-formula">{item.formula}</h3>
               <span className={`status-pill ${item.status}`}>
                 {item.status === 'active' && 'Faol'}
                 {item.status === 'inactive' && 'Takrorlang'}
                 {item.status === 'new' && 'Yangi'}
               </span>
             </div>
             <p className="grammar-context">{item.context}</p>
             <div className="grammar-footer" style={{ flexWrap: 'wrap', gap: '10px' }}>
               <span className="times-used">Kinoda {item.timesUsed} marta ishlatingiz</span>
               <div style={{ display: 'flex', gap: '10px' }}>
                 {item.status === 'inactive' && (
                   <button className="btn btn-primary small-btn" onClick={() => setReviewFormula(item)}>
                     Takrorlash
                   </button>
                 )}
                 <button className="btn btn-outline-light small-btn" style={{ color: 'var(--color-royal-gold)', borderColor: 'rgba(244, 211, 94, 0.3)' }} onClick={() => alert('Bu funksiya tez orada ishga tushadi va u PRO tarifiga kiradi!')}>
                   ✨ AI Bilan Suhbat (PRO)
                 </button>
               </div>
             </div>
           </div>
         ))}
      </div>

      {/* Review Modal */}
      {reviewFormula && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setReviewFormula(null)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{reviewFormula.formula}</h2>
              <button className="close-btn" onClick={() => setReviewFormula(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="modal-body markdown-body" style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
              <ReactMarkdown>{mockMarkdownContent}</ReactMarkdown>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setReviewFormula(null)}>Tushundim</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GrammarPage;
