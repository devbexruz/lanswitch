import React, { useState, useEffect } from 'react';
import './SubscriptionPlansModal.css';

interface Plan {
  id?: string;
  planId?: string;
  name: string;
  targetRole: string;
  price?: number;
  monthlyPrice?: number;
  formattedPrice?: string;
  period: string;
  maxGroups: number;
  hasTrial: boolean;
  trialDays: number;
  features?: string[];
  featuresJson?: string;
  badge: string;
}

interface CardSettings {
  cardNumber: string;
  cardHolder: string;
  bankName: string;
  minAmount: number;
  instructions: string;
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
  const [cardSettings, setCardSettings] = useState<CardSettings | null>(null);
  const [usedStudentTrial, setUsedStudentTrial] = useState(false);
  const [usedTeacherTrial, setUsedTeacherTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment View State
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<Plan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(50000);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [switchCalculation, setSwitchCalculation] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const [plansRes, myRes, cardRes] = await Promise.all([
        fetch('/api/subscription/plans'),
        fetch('/api/subscription/my', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/subscription/card-settings')
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
      if (cardRes.ok) {
        setCardSettings(await cardRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPlanId = (plan: Plan) => plan.planId || plan.id || '';
  const getPlanPrice = (plan: Plan) => plan.monthlyPrice ?? plan.price ?? 50000;

  const handleStartTrial = async (planId: string) => {
    setActivatingPlanId(planId);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/subscription/start-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || "14 kunlik bepul sinov muddati faollashtirildi!");
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        setErrorMessage(data.message || data || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Tarmoq xatosi yuz berdi");
    } finally {
      setActivatingPlanId(null);
    }
  };

  const openPaymentForPlan = (plan: Plan) => {
    setSelectedPlanForPayment(plan);
    const price = getPlanPrice(plan);
    setPaymentAmount(price);
    setReceiptFile(null);
    setReceiptPreview(null);
    setErrorMessage(null);
    calculateDurationOrSwitch(getPlanId(plan), price);
  };

  const calculateDurationOrSwitch = async (planId: string, amount: number) => {
    try {
      const res = await fetch('/api/subscription/calculate-switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          targetPlanId: planId,
          additionalAmount: amount || 0
        })
      });

      if (res.ok) {
        setSwitchCalculation(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAmountChange = (newAmount: number) => {
    setPaymentAmount(newAmount);
    if (selectedPlanForPayment) {
      calculateDurationOrSwitch(getPlanId(selectedPlanForPayment), newAmount);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReceiptPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyCard = () => {
    if (cardSettings?.cardNumber) {
      navigator.clipboard.writeText(cardSettings.cardNumber.replace(/\s+/g, ''));
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2000);
    }
  };

  const handleSubmitReceipt = async () => {
    if (!selectedPlanForPayment) return;
    if (!receiptFile) {
      setErrorMessage("Iltimos, to'lov cheki screenshotini yuklang!");
      return;
    }
    const min = cardSettings?.minAmount || 15000;
    if (!paymentAmount || paymentAmount < min) {
      setErrorMessage(`Minimal to'lov summasi ${min.toLocaleString('uz-UZ')} so'm!`);
      return;
    }

    setSubmittingPayment(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      formData.append('planId', getPlanId(selectedPlanForPayment));
      formData.append('amount', paymentAmount.toString());

      const res = await fetch('/api/subscription/submit-receipt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("✅ To'lov chekingiz tekshirish uchun yuborildi! Admin tasdiqlashi bilan Telegram botingizga xabar boradi va muddat avtomatik hisoblab qo'shiladi.");
        setSelectedPlanForPayment(null);
        setReceiptFile(null);
        setReceiptPreview(null);
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        setErrorMessage(data.message || "To'lov chekini yuborishda xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Tarmoq xatosi yuz berdi. Iltimos qaytadan urinib ko'ring.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const parseFeatures = (plan: Plan): string[] => {
    if (plan.features && Array.isArray(plan.features)) return plan.features;
    if (plan.featuresJson) {
      try {
        return JSON.parse(plan.featuresJson);
      } catch {}
    }
    return [];
  };

  if (!isOpen) return null;

  return (
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div className="subscription-modal-container animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="subscription-modal-header">
          <div>
            <div className="subscription-eyebrow">👑 Lanswitch Obunalari</div>
            <h2 className="subscription-modal-title">Tariflar va To'lov Tizimi</h2>
            <p className="subscription-modal-subtitle">
              Har qanday summada to'lov qiling — muddat soat va minutlarigacha adolatli hisoblab beriladi!
            </p>
          </div>
          <button className="subscription-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Current Active Subscription Banner */}
        {mySubscription && (
          <div className="current-sub-banner">
            <div className="current-sub-icon">👑</div>
            <div className="current-sub-info" style={{ flex: 1 }}>
              <div className="current-sub-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Joriy tarifingiz: <strong>{mySubscription.planName}</strong></span>
                {mySubscription.isTrial && <span className="trial-pill">14 kunlik sinov</span>}
                <span style={{ fontSize: '12px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px' }}>
                  Faol holatda
                </span>
              </div>
              <div className="current-sub-expiry" style={{ marginTop: '4px', fontSize: '13px', opacity: 0.9 }}>
                Qolgan vaqt: <strong>{mySubscription.daysLeft} kun ({mySubscription.hoursLeft} soat)</strong> •
                Tugash vaqti: <strong>{new Date(mySubscription.endDate).toLocaleString('uz-UZ')}</strong>
              </div>
              {mySubscription.lastActivatedAt && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  🕒 Oxirgi aktivatsiya vaqti: <strong>{new Date(mySubscription.lastActivatedAt).toLocaleString('uz-UZ')}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="sub-success-alert" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', padding: '14px 18px', borderRadius: '14px', marginBottom: '18px', fontSize: '14px' }}>
            <span>🎉</span> {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '14px 18px', borderRadius: '14px', marginBottom: '18px', fontSize: '14px' }}>
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {/* PAYMENT CHECKOUT VIEW (Karta orqali to'lov shakli) */}
        {selectedPlanForPayment ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(56, 189, 248, 0.35)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>💳 To'lov va Aktivatsiya</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#fff' }}>
                  {selectedPlanForPayment.name} tarifi uchun to'lov
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPlanForPayment(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}
              >
                ← Tariflar ro'yxatiga qaytish
              </button>
            </div>

            {/* SWITCH TARIFF NOTIFICATION (agar boshqa tarifda bo'lsa) */}
            {switchCalculation && switchCalculation.hasCurrentSubscription && switchCalculation.currentPlanName !== selectedPlanForPayment.name && (
              <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 800, color: '#fde047', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔄</span> Tarif almashtirish (Pro-rata hisob):
                </div>
                <div style={{ fontSize: '13px', color: '#fef08a', marginTop: '6px', lineHeight: 1.5 }}>
                  Siz hozir <strong>{switchCalculation.currentPlanName}</strong> tarifidasiz. Avvalgi tarifingizda qolgan <strong>{switchCalculation.currentRemainingHours} soat</strong> muddat (qiymati: <strong>{switchCalculation.residualValue.toLocaleString('uz-UZ')} so'm</strong>) avtomatik yangi tarifingizga hisoblanib o'tkaziladi!
                </div>
              </div>
            )}

            {/* CARD DETAILS BOX */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1.5px solid #3b82f6', borderRadius: '16px', padding: '18px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>{cardSettings?.bankName || 'Humo / Uzcard'}</span>
                  <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Rasmiy karta</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '2px', color: '#f8fafc', margin: '14px 0 6px 0', fontFamily: 'monospace' }}>
                  {cardSettings?.cardNumber || '9860 0000 0000 0000'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 700 }}>{cardSettings?.cardHolder || 'LANSWITCH ADMIN'}</span>
                  <button 
                    onClick={handleCopyCard}
                    style={{ background: copiedCard ? '#10b981' : '#2563eb', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {copiedCard ? '✓ Nusxalandi!' : '📋 Nusxalash'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 800, marginBottom: '6px' }}>
                  💡 Moslashuvchan to'lov:
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {cardSettings?.instructions || "Xohlagancha pul o'tkazing, minimum 15,000 so'm. Tarifingizga mos ravishda muddat soat va minutlarigacha hisoblab qo'shiladi."}
                </div>
              </div>
            </div>

            {/* AMOUNT INPUT & LIVE CALCULATOR */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '18px', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#e2e8f0', marginBottom: '8px' }}>
                💰 O'tkazilgan summani kiriting (so'm):
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => handleAmountChange(Number(e.target.value))}
                  min={cardSettings?.minAmount || 15000}
                  step={1000}
                  placeholder="Masalan: 50000"
                  style={{ flex: 1, minWidth: '180px', background: '#1e293b', border: '1.5px solid #475569', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '16px', fontWeight: 800 }}
                />
                <button
                  type="button"
                  onClick={() => handleAmountChange(15000)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                >
                  Min: 15 000
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountChange(getPlanPrice(selectedPlanForPayment))}
                  style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                >
                  1 oylik narx ({getPlanPrice(selectedPlanForPayment).toLocaleString('uz-UZ')})
                </button>
              </div>

              {/* LIVE RESULT BOX */}
              {switchCalculation && (
                <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(56, 189, 248, 0.1)', border: '1px dashed #38bdf8', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ushbu summa evaziga hisoblangan muddat:</span>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8' }}>
                      ⏳ {switchCalculation.formattedDuration}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#cbd5e1' }}>
                    1 oy = 30 kun (720 soat) me'yorida aniq soat/minutgacha
                  </div>
                </div>
              )}
            </div>

            {/* CRITICAL ACCURACY WARNING */}
            <div style={{ background: 'rgba(220, 38, 38, 0.12)', border: '1.5px solid #ef4444', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                  <strong style={{ color: '#fca5a5', fontSize: '13.5px' }}>
                    DIQQAT: Summani 1 so'migacha kvitansiyadagi (chek) bilan bir xil va to'liq kiriting!
                  </strong>
                  <p style={{ margin: '4px 0 0 0', color: '#fecaca', fontSize: '12.5px', lineHeight: 1.45 }}>
                    Kiritilgan summa chekdagi haqiqiy summa bilan 100% mos kelishi shart. Agar kiritilgan summa chekdagidan farq qilsa, to'lovingiz soxta deb topilib rad etilishi yoki admin tomonidan qayta tekshiruvga yuborilishi mumkin!
                  </p>
                </div>
              </div>
            </div>

            {/* RECEIPT SCREENSHOT UPLOAD */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#e2e8f0', marginBottom: '8px' }}>
                📸 To'lov cheki screenshotini yuklang:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ background: '#1e293b', border: '1.5px dashed #64748b', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
                />
                {receiptPreview && (
                  <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #3b82f6' }}>
                    <img src={receiptPreview} alt="Receipt preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              onClick={handleSubmitReceipt}
              disabled={submittingPayment || !receiptFile}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: submittingPayment || !receiptFile ? '#475569' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 900,
                cursor: submittingPayment || !receiptFile ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              {submittingPayment ? "Yuklanmoqda va adminga yuborilmoqda..." : "🚀 Chekni tasdiqlash uchun yuborish"}
            </button>
          </div>
        ) : null}

        {/* PLANS GRID */}
        {loading ? (
          <div className="subscription-loading">Tariflar yuklanmoqda...</div>
        ) : (
          <div className="subscription-plans-grid">
            {plans.map((plan) => {
              const pId = getPlanId(plan);
              const isCurrent = mySubscription?.planId === pId;
              const isStudentPlan = plan.targetRole === 'Student';
              const canTrial = plan.hasTrial && (isStudentPlan ? !usedStudentTrial : !usedTeacherTrial);
              const price = getPlanPrice(plan);
              const features = parseFeatures(plan);

              return (
                <div
                  key={pId}
                  className={`subscription-plan-card ${isCurrent ? 'active-plan' : ''} ${pId === 'teacher_standart' || pId === 'teacher_pro' ? 'featured-plan' : ''}`}
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
                      <span className="plan-price-amount">{price.toLocaleString('uz-UZ')} so'm</span>
                      <span className="plan-price-period">/ oy</span>
                    </div>

                    {plan.hasTrial && (
                      <div className="plan-trial-note">
                        🎁 {plan.trialDays || 14} kun bepul sinov muddati
                      </div>
                    )}
                  </div>

                  <div className="plan-features-list">
                    <div className="plan-features-label">Imkoniyatlar:</div>
                    {features.map((feat, fIdx) => (
                      <div key={fIdx} className="plan-feature-item">
                        <span className="feature-check">✓</span>
                        <span className="feature-text">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="plan-action-block" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {canTrial && (
                      <button
                        className="plan-btn plan-btn-trial"
                        onClick={() => handleStartTrial(pId)}
                        disabled={activatingPlanId === pId}
                      >
                        {activatingPlanId === pId ? 'Faollashtirilmoqda...' : '🎁 14 kun bepul sinab ko\'rish'}
                      </button>
                    )}

                    <button
                      className="plan-btn plan-btn-buy"
                      onClick={() => openPaymentForPlan(plan)}
                      style={{
                        background: isCurrent 
                          ? 'linear-gradient(135deg, #10b981, #059669)' 
                          : 'linear-gradient(135deg, #3b82f6, #2563eb)'
                      }}
                    >
                      {isCurrent ? "💳 Muddatni uzaytirish" : "💳 Kartaga to'lov qilish"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="subscription-footer-info">
          <p>
            ℹ️ <strong>Eslatma:</strong> 30 kunlik bazaviy narx asosida siz o'tkazgan summa qancha bo'lishidan qat'i nazar (minimum 15,000 so'm), vaqt soat va minutlarigacha aniq hisoblab beriladi. Agar boshqa tarifga o'tsangiz, avvalgi qolgan muddat yangi tarifingizga avtomatik konvertatsiya qilinadi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlansModal;
