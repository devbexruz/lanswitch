import React, { useState, useEffect } from 'react';
import './SubscriptionPlansModal.css';
import settings from '../settings.json';

interface Plan {
  id: string;
  name: string;
  targetRole: string;
  price: number;
  formattedPrice: string;
  period: string;
  maxGroups: number;
  hasTrial: boolean;
  trialDays: number;
  features: string[];
  badge: string;
}

interface SubscriptionPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionUpdated?: () => void;
}

const SubscriptionPlansModal: React.FC<SubscriptionPlansModalProps> = ({
  isOpen,
  onClose,
  onSubscriptionUpdated
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [usedStudentTrial, setUsedStudentTrial] = useState(false);
  const [usedTeacherTrial, setUsedTeacherTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const [plansRes, myRes] = await Promise.all([
        fetch('/api/subscription/plans'),
        fetch('/api/subscription/my')
      ]);

      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }
      if (myRes.ok) {
        const myData = await myRes.json();
        setMySubscription(myData.subscription);
        setUsedStudentTrial(myData.usedStudentTrial);
        setUsedTeacherTrial(myData.usedTeacherTrial);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async (planId: string) => {
    setActivatingPlanId(planId);
    try {
      const res = await fetch('/api/subscription/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || "14 kunlik bepul sinov muddati faollashtirildi!");
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        alert(data.message || data || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Tarmoq xatosi");
    } finally {
      setActivatingPlanId(null);
    }
  };

  const handleSubscribeViaBot = (planId: string) => {
    const botUrl = `tg://resolve?domain=${settings.botUsername || 'lanswitchbot'}&start=sub_${planId}`;
    window.location.href = botUrl;
  };

  if (!isOpen) return null;

  return (
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div className="subscription-modal-container animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="subscription-modal-header">
          <div>
            <div className="subscription-eyebrow">👑 Lanswitch Obunalari</div>
            <h2 className="subscription-modal-title">Tariflar va Imkoniyatlar</h2>
            <p className="subscription-modal-subtitle">
              Talabalar va Ustozlar uchun mo'ljallangan qulay tariflar
            </p>
          </div>
          <button className="subscription-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Current Active Subscription Banner */}
        {mySubscription && (
          <div className="current-sub-banner">
            <div className="current-sub-icon">👑</div>
            <div className="current-sub-info">
              <div className="current-sub-title">
                Sizning joriy tarifingiz: <strong>{mySubscription.planName}</strong>
                {mySubscription.isTrial && <span className="trial-pill">14 kunlik sinov</span>}
              </div>
              <div className="current-sub-expiry">
                Qolgan vaqt: <strong>{mySubscription.daysLeft} kun</strong> (Amal qilish muddati: {new Date(mySubscription.endDate).toLocaleDateString('uz-UZ')})
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="sub-success-alert">
            <span>🎉</span> {successMessage}
          </div>
        )}

        {loading ? (
          <div className="subscription-loading">Tariflar yuklanmoqda...</div>
        ) : (
          <div className="subscription-plans-grid">
            {plans.map((plan) => {
              const isCurrent = mySubscription?.planId === plan.id;
              const isStudentPlan = plan.targetRole === 'Student';
              const canTrial = plan.hasTrial && (isStudentPlan ? !usedStudentTrial : !usedTeacherTrial);

              return (
                <div
                  key={plan.id}
                  className={`subscription-plan-card ${isCurrent ? 'active-plan' : ''} ${plan.id === 'teacher_standart' || plan.id === 'teacher_pro' ? 'featured-plan' : ''}`}
                >
                  {plan.badge && (
                    <div className="plan-badge-top">
                      {plan.badge}
                    </div>
                  )}

                  <div className="plan-header-block">
                    <h3 className="plan-name">{plan.name}</h3>
                    <div className="plan-target-role">
                      {isStudentPlan ? '🎒 Talaba rejimi' : `👨‍🏫 O'qituvchi (${plan.maxGroups} tagacha guruh)`}
                    </div>

                    <div className="plan-price-wrap">
                      <span className="plan-price-amount">{plan.formattedPrice.split('/')[0]}</span>
                      <span className="plan-price-period">/ oy</span>
                    </div>

                    {plan.hasTrial && (
                      <div className="plan-trial-note">
                        🎁 14 kun (2 hafta) bepul sinov muddati
                      </div>
                    )}
                  </div>

                  <div className="plan-features-list">
                    <div className="plan-features-label">Imkoniyatlar:</div>
                    {plan.features.map((feat, fIdx) => (
                      <div key={fIdx} className="plan-feature-item">
                        <span className="feature-check">✓</span>
                        <span className="feature-text">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="plan-action-block">
                    {isCurrent ? (
                      <button className="plan-btn plan-btn-active" disabled>
                        ✓ Sizning joriy tarifingiz
                      </button>
                    ) : canTrial ? (
                      <button
                        className="plan-btn plan-btn-trial"
                        onClick={() => handleStartTrial(plan.id)}
                        disabled={activatingPlanId === plan.id}
                      >
                        {activatingPlanId === plan.id ? 'Faollashtirilmoqda...' : '🎁 14 kun bepul sinab ko\'rish'}
                      </button>
                    ) : (
                      <button
                        className="plan-btn plan-btn-buy"
                        onClick={() => handleSubscribeViaBot(plan.id)}
                      >
                        ⚡ Obuna bo'lish
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="subscription-footer-info">
          <p>
            ℹ️ Barcha tariflarda kinolar va sun'iy intellekt tahlili to'liq ochiq bo'ladi. Ustozlar uchun qo'shimcha guruh boshqaruvi va avtomatik tekshiruv taqdim etiladi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlansModal;
