import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [userData, setUserData] = useState<any>(null);
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const [cardSettings, setCardSettings] = useState<CardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [canClaimBonus, setCanClaimBonus] = useState<boolean>(false);
  const [hasPriorSubscription, setHasPriorSubscription] = useState<boolean>(false);
  const [claimingBonus, setClaimingBonus] = useState<boolean>(false);
  const [bonusAmount, setBonusAmount] = useState<number>(25000);
  const [minAmount, setMinAmount] = useState<number>(15000);

  // 1-Step Switch / Start Confirmation
  const [confirmSwitchPlan, setConfirmSwitchPlan] = useState<Plan | null>(null);
  const [switchingPlan, setSwitchingPlan] = useState(false);

  // 1-Step Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<Plan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);

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
      const token = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const [plansRes, myRes, cardRes] = await Promise.all([
        fetch('/api/subscription/plans'),
        fetch('/api/subscription/my', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('/api/subscription/card-settings')
      ]);

      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }
      if (myRes.ok) {
        const myData = await myRes.json();
        setUserData(myData.user);
        setMySubscription(myData.subscription);
        setCanClaimBonus(Boolean(myData.canClaimBonus));
        setHasPriorSubscription(Boolean(myData.hasPriorSubscription));
        if (myData.bonusAmount) setBonusAmount(Number(myData.bonusAmount));
        if (myData.minAmount) setMinAmount(Number(myData.minAmount));

        if (myData.user) {
          setLiveBalance(myData.user.liveBalance ?? myData.user.balance ?? 0);
        }
      }
      if (cardRes.ok) {
        const cSettings = await cardRes.json();
        setCardSettings(cSettings);
        if (cSettings.initialBonusAmount) setBonusAmount(Number(cSettings.initialBonusAmount));
        if (cSettings.minAmount) setMinAmount(Number(cSettings.minAmount));
      }
    } catch (e) {
      console.error("Tarif ma'lumotlarini yuklashda xatolik:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async () => {
    setClaimingBonus(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const res = await fetch('/api/subscription/claim-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`🎁 Tabriklaymiz! ${bonusAmount.toLocaleString('uz-UZ')} so'm boshlang'ich bonus balansingizga qo'shildi!`);
        setCanClaimBonus(false);
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        setErrorMessage(data.message || "Bonusni olishda xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Tarmoq xatosi yuz berdi");
    } finally {
      setClaimingBonus(false);
    }
  };

  const handleClaimBonusAndStart = async (plan: Plan) => {
    setClaimingBonus(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const res = await fetch('/api/subscription/claim-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ targetPlanId: getPlanId(plan) })
      });
      const data = await res.json();
      if (res.ok) {
        setCanClaimBonus(false);
        setConfirmSwitchPlan(null);
        setSuccessMessage(`✅ Tabriklaymiz! ${bonusAmount.toLocaleString('uz-UZ')} so'm bonus qabul qilindi va "${plan.name}" tarifi faollashtirildi!`);
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        setErrorMessage(data.message || "Bonusni olishda xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Tarmoq xatosi yuz berdi");
    } finally {
      setClaimingBonus(false);
    }
  };

  // Real-time Balance & Duration countdown ticker
  useEffect(() => {
    if (!isOpen) return;

    const tick = () => {
      if (mySubscription) {
        const now = Date.now();
        const startMs = new Date(mySubscription.startDate).getTime();
        const endMs = new Date(mySubscription.endDate).getTime();
        const monthlyPrice = mySubscription.price || 50000;
        const perSecRate = mySubscription.perSecondRate || (monthlyPrice / (30 * 24 * 3600));

        if (now >= endMs) {
          setLiveBalance(0);
          setRemainingSeconds(0);
        } else {
          const elapsedSecs = Math.max(0, (now - startMs) / 1000);
          const initBal = mySubscription.initialBalance > 0 
            ? mySubscription.initialBalance 
            : (userData?.balance || 0);
          const spent = Math.min(initBal, Math.round(elapsedSecs * perSecRate));
          const currentBal = Math.max(0, initBal - spent);
          setLiveBalance(currentBal);

          const remSec = Math.max(0, Math.floor((endMs - now) / 1000));
          setRemainingSeconds(remSec);
        }
      } else {
        setLiveBalance(userData?.balance || 0);
        setRemainingSeconds(0);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isOpen, mySubscription, userData]);

  const getPlanId = (plan: Plan) => plan.planId || plan.id || '';
  const getPlanPrice = (plan: Plan) => plan.monthlyPrice ?? plan.price ?? 50000;

  // Format clean digital countdown
  const formatDurationClean = (totalSec: number) => {
    if (totalSec <= 0) return "Tugagan";
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (days > 0) {
      return `${days} kun, ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  };

  // Estimate days for target plan
  const getEstDays = (plan: Plan) => {
    const price = getPlanPrice(plan);
    const perSec = price / (30 * 24 * 3600);
    const secs = liveBalance / perSec;
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    if (days > 0) return `${days} kun ${hours > 0 ? hours + 's' : ''}`;
    return `${hours} soat`;
  };

  // 1-Step Switch Plan / Start Plan execution
  const handleSwitchPlan = async (targetPlanId: string) => {
    setSwitchingPlan(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/subscription/switch-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ targetPlanId })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("✅ Tarif muvaffaqiyatli faollashtirildi!");
        setConfirmSwitchPlan(null);
        await loadData();
        if (onSubscriptionUpdated) onSubscriptionUpdated();
      } else {
        setErrorMessage(data.message || data || "Tarifni faollashtirishda xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Tarmoq xatosi yuz berdi");
    } finally {
      setSwitchingPlan(false);
    }
  };

  // Open 1-Step Payment modal and trigger bot instruction message
  const openPayment = async (plan?: Plan) => {
    const target = plan || plans.find(p => p.planId === mySubscription?.planId) || plans[0] || null;
    setSelectedPlanForPayment(target);
    setPaymentAmount('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setErrorMessage(null);
    setShowPaymentModal(true);

    try {
      await fetch('/api/subscription/request-topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('lanswitch_token')}`
        },
        body: JSON.stringify({ planId: target ? getPlanId(target) : null })
      });
    } catch (e) {
      console.error("Top-up bot notification error:", e);
    }
  };

  const handleOpenBot = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        tg.openTelegramLink("https://t.me/lanswitchbot");
      } catch {}
      try {
        tg.close();
      } catch {}
    } else {
      window.open("https://t.me/lanswitchbot", "_blank");
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

  // 1-Step Submit Payment Receipt
  const handleSubmitReceipt = async () => {
    if (!selectedPlanForPayment) return;
    if (!receiptFile) {
      setErrorMessage("Iltimos, to'lov cheki screenshotini yuklang!");
      return;
    }

    setSubmittingPayment(true);
    setErrorMessage(null);
    try {
      const amt = typeof paymentAmount === 'number' && paymentAmount > 0 ? paymentAmount : 0;
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      formData.append('planId', getPlanId(selectedPlanForPayment));
      formData.append('amount', amt.toString());

      const res = await fetch('/api/subscription/submit-receipt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('lanswitch_token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("✅ To'lov chekingiz adminga yuborildi! Admin chekni ko'rib tasdiqlashi bilan hisobingizga qo'shiladi.");
        setShowPaymentModal(false);
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

  return createPortal(
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div className="subscription-modal-container animate-fade-in" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="compact-modal-header">
          <div>
            <h2 className="compact-modal-title">👑 Obunalar va Balans</h2>
            <p className="compact-modal-subtitle">
              Talabalar dars va lug'atlardan bepul foydalanishadi. Student Premium faqat kinolar va AI yordamchi uchun kerak.
            </p>
          </div>
          <button className="compact-close-x" onClick={onClose} title="Yopish">✕</button>
        </div>

        {/* ======================================================== */}
        {/* 25 000 SO'M INITIAL BONUS BANNER                        */}
        {/* ======================================================== */}
        {canClaimBonus && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.28) 100%)',
            border: '2px solid #F59E0B',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.22)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#fff',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
              }}>
                🎁
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#FEF3C7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{bonusAmount.toLocaleString('uz-UZ')} so'm Boshlang'ich Bonus!</span>
                  <span style={{ background: '#10B981', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>BEPUL</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#CBD5E1', marginTop: '2px', lineHeight: 1.4 }}>
                  Siz hali obuna faollashtirmagansiz. {bonusAmount.toLocaleString('uz-UZ')} so'm bonusni oling va istalgan tarifni sinab ko'ring!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClaimBonus}
              disabled={claimingBonus}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '13.5px',
                fontWeight: 900,
                cursor: claimingBonus ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <span>{claimingBonus ? "Yuklanmoqda..." : `🎁 ${bonusAmount.toLocaleString('uz-UZ')} bonusni olish`}</span>
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* COMPACT REALTIME BALANCE BAR                             */}
        {/* ======================================================== */}
        <div className="compact-balance-bar">
          <div className="balance-info-left">
            <div className="balance-row">
              <span className="balance-dot"></span>
              <span className="balance-label">Hisob balansi:</span>
              <span className="balance-val">
                {liveBalance.toLocaleString('uz-UZ')} <span className="currency">so'm</span>
              </span>
            </div>

            <div className="sub-status-row">
              {mySubscription ? (
                <>
                  <span className="status-plan-name">● {mySubscription.planName}</span>
                  <span className="status-divider">•</span>
                  <span className="status-time">⏳ {formatDurationClean(remainingSeconds)}</span>
                  {mySubscription.endDate && (
                    <span className="status-expiry">({new Date(mySubscription.endDate).toLocaleDateString('uz-UZ')} gacha)</span>
                  )}
                </>
              ) : hasPriorSubscription && !canClaimBonus ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 800 }}>
                    ⚠️ Tarif muddati tugagan
                  </span>
                  <span className="status-welcome-sub" style={{ color: '#fca5a5' }}>
                    Balansingizni minimal {minAmount.toLocaleString('uz-UZ')}+ so'mga to'ldirib kino ko'rish va boshqa imkoniyatlardan foydalanishda davom eting!
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="status-free-badge">🎓 Tarifsiz rejim</span>
                  <span className="status-welcome-sub">
                    {canClaimBonus
                      ? `${bonusAmount.toLocaleString('uz-UZ')} so'm bonusni oling va istalgan tarifni bepul sinab ko'ring!`
                      : "Barcha darslar, lug'at va vazifalar bepul. Faqat kinolar uchun Student Premium talab etiladi."}
                  </span>
                </div>
              )}
            </div>
          </div>

          {canClaimBonus ? (
            <button 
              className="compact-topup-btn"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                border: 'none',
                cursor: claimingBonus ? 'wait' : 'pointer'
              }}
              onClick={handleClaimBonus}
              disabled={claimingBonus}
            >
              <span>🎁</span> {claimingBonus ? "Olinmoqda..." : `${bonusAmount.toLocaleString('uz-UZ')} bonusni olish`}
            </button>
          ) : (
            <button 
              className="compact-topup-btn"
              onClick={() => openPayment()}
            >
              <span>➕</span> Balansni to'ldirish
            </button>
          )}
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="compact-alert success">
            <span>🎉</span>
            <div>{successMessage}</div>
            <button className="alert-x" onClick={() => setSuccessMessage(null)}>✕</button>
          </div>
        )}

        {errorMessage && (
          <div className="compact-alert error">
            <span>⚠️</span>
            <div>{errorMessage}</div>
            <button className="alert-x" onClick={() => setErrorMessage(null)}>✕</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1-STEP SWITCH / START CONFIRMATION MODAL                 */}
        {/* ======================================================== */}
        {confirmSwitchPlan && (
          <div className="mini-confirm-overlay animate-fade-in" onClick={() => setConfirmSwitchPlan(null)}>
            <div className="mini-confirm-card" onClick={e => e.stopPropagation()}>
              <div className="mini-confirm-header">
                <span className="mini-icon">{mySubscription ? '🔄' : '🚀'}</span>
                <div>
                  <h3 className="mini-title">
                    {mySubscription ? "Tarifni almashtirish" : "Tarifni faollashtirish"}
                  </h3>
                  <p className="mini-sub">
                    {mySubscription ? "1 qadamda yangi tarifga o'tish" : "Balans hisobidan darhol boshlash"}
                  </p>
                </div>
              </div>

              <div className="mini-confirm-body">
                <p>
                  <strong>{confirmSwitchPlan.name}</strong> tarifini {mySubscription ? "o'tishni" : "boshlashni"} tasdiqlaysizmi?
                </p>
                <div className="mini-stat-badge">
                  💰 Hozirgi balansingiz: <strong>{liveBalance.toLocaleString('uz-UZ')} so'm</strong>
                  <br />
                  ⏳ Ushbu tarifda taxminan: <strong style={{ color: '#fde047' }}>{getEstDays(confirmSwitchPlan)}</strong> yetadi
                </div>
                <div className="mini-help-text">
                  {mySubscription
                    ? "* Avvalgi tarifingizdan hozirgi soniyasigacha hisob-kitob qilinadi va qolgan mablag' to'liq yangi tarifga yo'naltiriladi."
                    : "* Balansingizdan tarifingiz bo'yicha har soniyada tejamkor tarzda sarflanib boradi."}
                </div>
              </div>

              <div className="mini-confirm-actions">
                <button
                  className="mini-btn-cancel"
                  onClick={() => setConfirmSwitchPlan(null)}
                  disabled={switchingPlan}
                >
                  Bekor qilish
                </button>
                <button
                  className="mini-btn-confirm"
                  onClick={() => handleSwitchPlan(getPlanId(confirmSwitchPlan))}
                  disabled={switchingPlan}
                >
                  {switchingPlan ? "Bajarilmoqda..." : (mySubscription ? "🔄 Ha, o'tish" : "🚀 Ha, boshlash")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1-STEP PAYMENT MODAL (Oddiy va tushunarli)               */}
        {/* ======================================================== */}
        {showPaymentModal && selectedPlanForPayment && (
          <div className="mini-confirm-overlay animate-fade-in" onClick={() => setShowPaymentModal(false)}>
            <div className="compact-payment-card" onClick={e => e.stopPropagation()}>
              
              <div className="payment-top-row">
                <div>
                  <span className="payment-tag">💳 TO'LOV VA AKTIVATSIYA</span>
                  <h3 className="payment-heading">Balansni to'ldirish</h3>
                </div>
                <button className="payment-close-btn" onClick={() => setShowPaymentModal(false)}>✕</button>
              </div>

              {/* Telegram Bot Notification Box */}
              <div className="bot-sent-notice-box">
                <div className="notice-icon">🤖</div>
                <div className="notice-text">
                  To'lov rekvizitlari Telegram botingizga (<strong>@lanswitchbot</strong>) yuborildi!
                  <div className="notice-sub">
                    O'tkazma summasini o'zingiz belgilaysiz (minimum {minAmount.toLocaleString('uz-UZ')} so'm). To'lov chekini botga rasm shaklida yuboring.
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleOpenBot}
                className="open-bot-action-btn"
              >
                <span>💬</span> Telegram Botga O'tish (@lanswitchbot)
              </button>

              {/* 1. Karta ma'lumotlari */}
              <div className="compact-bank-card" style={{ marginTop: '14px' }}>
                <div className="bank-meta">
                  <span>{cardSettings?.bankName || 'Humo / Uzcard'}</span>
                  <span className="holder">{cardSettings?.cardHolder || 'LANSWITCH ADMIN'}</span>
                </div>
                <div className="bank-num-row">
                  <span className="number">{cardSettings?.cardNumber || '9860 0000 0000 0000'}</span>
                  <button type="button" className="copy-btn" onClick={handleCopyCard}>
                    {copiedCard ? '✓ Nusxalandi' : '📋 Nusxalash'}
                  </button>
                </div>
              </div>

              {/* 2. Web orqali yuklash varianti */}
              <div className="web-upload-toggle">
                <span className="toggle-label">Yoki chekni to'g'ridan-to'g'ri shu yerda yuklang:</span>

                <div className="compact-form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">To'langan summa (so'm, ixtiyoriy):</label>
                  <input
                    type="number"
                    className="compact-number-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Chekdagi summa (ixtiyoriy, admin belgilaydi)"
                    step={1000}
                  />
                  <div className="compact-pills-row">
                    <button type="button" onClick={() => setPaymentAmount(minAmount)}>{minAmount.toLocaleString('uz-UZ')}</button>
                    <button type="button" onClick={() => setPaymentAmount(getPlanPrice(selectedPlanForPayment))}>
                      1 oylik ({getPlanPrice(selectedPlanForPayment).toLocaleString('uz-UZ')})
                    </button>
                    <button type="button" onClick={() => setPaymentAmount(getPlanPrice(selectedPlanForPayment) * 2)}>
                      2 oylik
                    </button>
                    <button type="button" onClick={() => setPaymentAmount('')}>Tozalash</button>
                  </div>
                </div>

                <div className="compact-form-group">
                  <label className="form-label">To'lov cheki (screenshot):</label>
                  <div className="file-upload-row">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="compact-file-input"
                    />
                    {receiptPreview && (
                      <div className="receipt-thumb">
                        <img src={receiptPreview} alt="Receipt preview" />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="compact-submit-btn"
                  onClick={handleSubmitReceipt}
                  disabled={submittingPayment || !receiptFile}
                >
                  {submittingPayment ? "Yuborilmoqda..." : "🚀 Chekni tasdiqlash uchun yuborish"}
                </button>

                <button
                  type="button"
                  className="compact-cancel-btn"
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Bekor qilish
                </button>
              </div>

              <div className="compact-disclaimer">
                💡 Admin tasdiqlashi bilan pul balansingizga qo'shiladi va tarifingiz asosida real vaqtda sarflanib boradi.
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* COMPACT PLANS GRID                                       */}
        {/* ======================================================== */}
        {loading ? (
          <div className="subscription-loading">Tariflar yuklanmoqda...</div>
        ) : (
          <div className="compact-plans-grid">
            {plans.map((plan) => {
              const pId = getPlanId(plan);
              const isCurrent = mySubscription?.planId === pId;
              const isStudentPlan = plan.targetRole === 'Student';
              const price = getPlanPrice(plan);
              const features = parseFeatures(plan);

              return (
                <div
                  key={pId}
                  className={`compact-plan-card ${isCurrent ? 'active-card' : ''}`}
                >
                  {plan.badge && (
                    <div className="compact-card-badge">
                      {plan.badge}
                    </div>
                  )}

                  <div className="compact-card-header">
                    <h3 className="card-title">{plan.name}</h3>
                    <div className="card-role">
                      {isStudentPlan ? '🎒 Talaba rejimi' : `👨‍🏫 Ustoz (${plan.maxGroups} ta guruh)`}
                    </div>
                    <div className="card-price-row">
                      <span className="card-price">{price.toLocaleString('uz-UZ')}</span>
                      <span className="card-currency">so'm / oy</span>
                    </div>
                  </div>

                  <ul className="compact-features">
                    {features.slice(0, 4).map((feat, fIdx) => (
                      <li key={fIdx}>
                        <span className="check">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="compact-card-actions">
                    {/* Main 1-step action button */}
                    {isCurrent ? (
                      <button className="btn-current" disabled>
                        ✓ Joriy faol tarif
                      </button>
                    ) : canClaimBonus ? (
                      <button
                        className="btn-start"
                        style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', fontWeight: 900 }}
                        onClick={() => handleClaimBonusAndStart(plan)}
                        disabled={claimingBonus}
                      >
                        🎁 {bonusAmount.toLocaleString('uz-UZ')} bonus bilan boshlash
                      </button>
                    ) : !mySubscription && liveBalance > 0 ? (
                      <button
                        className="btn-start"
                        onClick={() => setConfirmSwitchPlan(plan)}
                      >
                        🚀 Boshlash (~{getEstDays(plan)})
                      </button>
                    ) : mySubscription && liveBalance > 0 ? (
                      <button
                        className="btn-switch"
                        onClick={() => setConfirmSwitchPlan(plan)}
                      >
                        🔄 O'tish (~{getEstDays(plan)})
                      </button>
                    ) : (
                      <button
                        className="btn-pay"
                        onClick={() => openPayment(plan)}
                      >
                        💳 Tanlash & To'lov
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="compact-footer-note">
          💡 <strong>Qulaylik:</strong> Istalgan summada to'lov qiling — muddat soat va minutlarigacha adolatli hisoblab beriladi. Balansingiz real vaqtda sarflanib boradi va istalgan payt boshqa tarifga o'tishingiz mumkin.
        </div>

      </div>
    </div>,
    document.body
  );
};

export default SubscriptionPlansModal;
