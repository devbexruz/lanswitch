import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';
import appPreview from '../assets/app_preview.png';

const HomePage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 50) {
            setScrolled(true);
          } else {
            setScrolled(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="homepage">
      {/* Navigation */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-brand">
          Lan<span className="accent">switch</span>
        </Link>
        <div className="nav-links">
          <a href="#features" className="nav-link">Imkoniyatlar</a>
          <a href="#desktop" className="nav-link">Desktop Ilova</a>
          <a href="#pricing" className="nav-link">Tariflar</a>
          <button className="btn btn-primary">Boshlash</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text animate-fade-in">
            <div style={{ display: 'inline-block', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-secondary)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1.5rem', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
              🎁 Asosiy qism to'liq bepul
            </div>
            <h1 className="hero-title">
              Animelarni yashab <span className="text-gradient">xorijiy tillarni egallang</span>
            </h1>
            <p className="hero-subtitle">
              Sevimli kinolaringiz olamiga sho'ng'ing. Aqlli subtitrlar, real vaqtda tarjima va kontekstual grammatika yordamida til o'rganish endi juda oson va tabiiy.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary">Web Versiyani Boshlash</button>
              <button className="btn btn-glass">Desktop Ilovani Yuklash</button>
            </div>
          </div>
          
          <div className="hero-image-container animate-fade-in delay-200">
            <div className="hero-glow"></div>
            <div className="hero-image-wrapper animate-float">
              <img 
                src={appPreview} 
                alt="Lanswitch Ilovasi Interfeysi" 
                className="hero-image"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-header animate-fade-in delay-300">
          <h2 className="section-title">Nima uchun aynan Lanswitch?</h2>
          <p className="section-subtitle">Til o'rganishning mutlaqo yangi bosqichi. Zerikarli darsliklarni unuting va tilni o'zining tabiiy muhitida his qiling.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card animate-fade-in delay-100">
            <div className="feature-icon">🧠</div>
            <h3 className="feature-title">Oldindan Tayyorgarlik</h3>
            <p className="feature-desc">
              Epizodni ko'rishdan avval muhim so'zlar va grammatikani yodlang. Videoni hech qanday tushunmovchiliklarsiz, zavq bilan uzluksiz tomosha qiling.
            </p>
          </div>

          <div className="feature-card animate-fade-in delay-200">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Real Vaqtda Analiz</h3>
            <p className="feature-desc">
              Istalgan subtitr so'ziga bosing va darhol uning tarjimasi, izohi va o'sha holatdagi grammatik qoidasini to'g'ridan-to'g'ri ekranning o'zida ko'ring.
            </p>
          </div>

          <div className="feature-card animate-fade-in delay-300">
            <div className="feature-icon">🖥️</div>
            <h3 className="feature-title">Desktop Imkoniyatlari</h3>
            <p className="feature-desc">
              O'zingiz xohlagan har qanday kinoni Lanswitch Desktop ilovasiga yuklang. Tizim o'zi avtomatik tarzda unga subtitr yaratadi va siz uchun tahlil qiladi.
            </p>
          </div>
          
          <div className="feature-card animate-fade-in delay-400">
            <div className="feature-icon">📚</div>
            <h3 className="feature-title">Aktiv So'zlar Nazorati</h3>
            <p className="feature-desc">
              O'rgangan so'zlaringiz shaxsiy faol lug'atingizda saqlanadi. Ular xotirangizdan o'chmasligi uchun Spaced Repetition (oraliq takrorlash) usulidan foydalanamiz.
            </p>
          </div>

          <div className="feature-card animate-fade-in delay-100">
            <div className="feature-icon">🎧</div>
            <h3 className="feature-title">Ikki Tildagi Ovoz</h3>
            <p className="feature-desc">
              Animelarni original ovozda yoki ingliz dublyajida tinglang. Jarayonni osonlashtirish maqsadida sizga o'zbek tilidagi yordamchi materiallar taqdim etiladi.
            </p>
          </div>

          <div className="feature-card animate-fade-in delay-200">
            <div className="feature-icon">🔖</div>
            <h3 className="feature-title">Keyin O'rganish Uchun Saqlash</h3>
            <p className="feature-desc">
              Kino jarayonini to'xtatishni xohlamaysizmi? Unda qiziqarli ko'ringan so'z yoki qoidalarni shunchaki belgilab qo'ying va ularni kino tugagandan so'ng o'rganing.
            </p>
          </div>
        </div>
      </section>
      {/* Pricing Section */}
      <section id="pricing" className="pricing features">
        <div className="section-header animate-fade-in delay-100">
          <h2 className="section-title">Oddiy va Shaffof Tariflar</h2>
          <p className="section-subtitle">Lanswitch ning asosiy qismi <strong>to'liq bepul</strong>. Faqatgina ilg'or Sun'iy Intellekt (AI) xizmatlari uchungina Pro tarifni xarid qilishingiz mumkin.</p>
        </div>

        <div className="features-grid">
          {/* Free Tier */}
          <div className="feature-card animate-fade-in delay-200" style={{ borderTop: '4px solid var(--accent-secondary)' }}>
            <h3 className="feature-title" style={{ fontSize: '2rem' }}>Asosiy</h3>
            <p className="feature-desc" style={{ marginBottom: '2rem' }}>To'liq Bepul (0$)</p>
            
            <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', lineHeight: '2', marginBottom: '2rem' }}>
              <li>✅ Kinolar va Animelarni cheksiz ko'rish</li>
              <li>✅ Aqlli subtitrlar va tezkor tarjimalar</li>
              <li>✅ Oldindan tayyorgarlik (Pre-Learning)</li>
              <li>✅ Shaxsiy lug'at va Spaced Repetition</li>
              <li>✅ Desktop ilovasiga istalgan kinoni yuklash</li>
            </ul>
            <button className="btn btn-glass" style={{ width: '100%' }}>Hoziroq Boshlash</button>
          </div>

          {/* Pro Tier */}
          <div className="feature-card animate-fade-in delay-300" style={{ borderTop: '4px solid var(--accent-primary)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--accent-gradient)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>TAVSIYA ETILADI</div>
            <h3 className="feature-title" style={{ fontSize: '2rem' }}>Pro (AI)</h3>
            <p className="feature-desc" style={{ marginBottom: '2rem' }}>Kengaytirilgan imkoniyatlar</p>
            
            <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', lineHeight: '2', marginBottom: '2rem' }}>
              <li>✨ <strong>Barcha Asosiy tarif imkoniyatlari</strong></li>
              <li>✨ AI yordamida chuqurlashtirilgan grammatik tahlil</li>
              <li>✨ Siz uchun maxsus moslashtirilgan AI maslahatlar</li>
              <li>✨ Kinodagi dialoglarni AI orqali rolga kirib gaplashish</li>
              <li>✨ Murakkab so'z birikmalarini kontekstual tushuntirish</li>
            </ul>
            <button className="btn btn-primary" style={{ width: '100%' }}>Pro Versiyaga O'tish</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
