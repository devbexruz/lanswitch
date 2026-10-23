import { Link } from 'react-router-dom';
import { Users, Smartphone, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LanswitchPortalPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ice-blue-bg)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      fontFamily: 'var(--font-main)'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', maxWidth: '640px', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--pure-white)',
          border: '1.5px solid var(--sky-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '6px 18px',
          fontSize: '13px',
          fontWeight: 800,
          color: 'var(--primary-blue)',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <ShieldCheck size={16} /> Telegram-Native English Learning Platform
        </div>

        <h1 style={{
          fontSize: '38px',
          fontWeight: 900,
          color: 'var(--text-navy)',
          letterSpacing: '-1px',
          lineHeight: 1.2,
          marginBottom: '12px'
        }}>
          LANSWITCH <span style={{ color: 'var(--primary-blue)' }}>ACADEMY</span>
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--text-navy-secondary)',
          lineHeight: 1.5
        }}>
          Ingliz tili guruhlari, topshiriqlar va Telegram ekotizimi uchun mo'ljallangan zamonaviy ta'lim platformasi.
        </p>
      </div>

      {/* 2 Role Choice Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        maxWidth: '840px',
        width: '100%'
      }}>
        {/* 1. Teacher Dashboard Card */}
        <div style={{
          background: 'var(--pure-white)',
          borderRadius: 'var(--radius-card)',
          border: '2px solid var(--sky-border)',
          padding: '32px 28px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '9999px',
              background: 'var(--ice-blue-bg)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              border: '2px solid var(--sky-border)'
            }}>
              <Users size={32} />
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
              English • Web Panel
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '12px' }}>
              Teacher Dashboard
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              O'qituvchilar uchun qulay web panel (Mobile & Desktop). Telegram guruhlarni boshqarish, dars topshiriqlarini tuzish va uyga vazifalarni (1, 0, 2) baholash.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> Guruhlar: All / Owned / Admin tablari
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> K-qismli vazifalar konstruktori
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> Katta videolar uchun 1-bosishda ochish
              </div>
            </div>
          </div>

          <Link
            to="/teacher"
            className="btn-big-blue"
            style={{ width: '100%', minHeight: '56px', fontSize: '16px' }}
          >
            <span>Open Teacher Web</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* 2. Student TMA Card */}
        <div style={{
          background: 'var(--pure-white)',
          borderRadius: 'var(--radius-card)',
          border: '2px solid var(--sky-border)',
          padding: '32px 28px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '9999px',
              background: 'var(--ice-blue-bg)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              border: '2px solid var(--sky-border)'
            }}>
              <Smartphone size={32} />
            </div>

            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
              O'zbekcha • Mini App
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-navy)', marginBottom: '12px' }}>
              Student Mini App (TMA)
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
              O'quvchilar uchun Telegram Mini App. Guruh topshiriqlarini bajarish, kitob va lug'at flashcardlari, 4-variantli test va media yuborish.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> 5 ta filtr: Barchasi, Bajarilgan, Jarima...
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> Interaktiv Flashcard & 4-Variantli Test
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-navy-secondary)', fontWeight: 600 }}>
                <CheckCircle size={16} color="var(--primary-blue)" /> Telegram Bot media oqimi
              </div>
            </div>
          </div>

          <Link
            to="/tma"
            className="btn-big-white"
            style={{ width: '100%', minHeight: '56px', fontSize: '16px', borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}
          >
            <span>Mini App'ni ochish</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
