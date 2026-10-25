import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './VerifyReceiptPage.css';

interface ReceiptData {
  id: number;
  userId: number;
  userFullName: string;
  userTelegramId: string;
  userUsername: string;
  planId: string;
  planName: string;
  amount: number;
  approvedAmount?: number;
  calculatedDurationHours: number;
  calculatedDurationMinutes: number;
  receiptImageUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  adminNotes?: string;
  processedAt?: string;
  processedBy?: string;
  createdAt: string;
  monthlyPrice: number;
  token?: string;
}

const VerifyReceiptPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [amountInput, setAmountInput] = useState<number | ''>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  // Reject modal / state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Success alert
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [imageZoomed, setImageZoomed] = useState(false);

  useEffect(() => {
    fetchReceipt();
  }, [id, token]);

  const fetchReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/subscription/receipt-verify/${id}?token=${encodeURIComponent(token)}`;
      const tokenHeader = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const headers: HeadersInit = {};
      if (tokenHeader) {
        headers['Authorization'] = `Bearer ${tokenHeader}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Chek ma'lumotlarini yuklab bo'lmadi");
      }

      const data: ReceiptData = await res.json();
      setReceipt(data);
      if (data.status === 'Pending') {
        setAmountInput(data.amount > 0 ? data.amount : '');
      } else {
        setAmountInput(data.approvedAmount ?? data.amount ?? '');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const getEstimatedDuration = (amt: number | '') => {
    if (!amt || amt <= 0 || !receipt) return null;
    const monthly = receipt.monthlyPrice > 0 ? receipt.monthlyPrice : 50000;
    const perSec = monthly / (30 * 24 * 3600);
    const secs = amt / perSec;
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);

    return `${days} kun ${hours} soat ${mins} minut`;
  };

  const handleApprove = async () => {
    if (!receipt) return;
    if (receipt.status !== 'Pending') {
      alert("⚠️ Ushbu chek allaqachon ko'rib chiqilgan!");
      return;
    }

    const finalAmount = typeof amountInput === 'number' ? amountInput : Number(amountInput);
    if (!finalAmount || finalAmount <= 0) {
      alert("Iltimos, chekdagi to'g'ri to'lov summasini kiriting!");
      return;
    }

    setSubmittingApprove(true);
    setActionSuccess(null);
    try {
      const url = `/api/subscription/receipt-verify/${id}/approve?token=${encodeURIComponent(token)}`;
      const tokenHeader = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenHeader) headers['Authorization'] = `Bearer ${tokenHeader}`;

      // Get current admin user name if available
      let adminName = 'Admin';
      try {
        const u = localStorage.getItem('lanswitch_user');
        if (u) adminName = JSON.parse(u)?.fullName || 'Admin';
      } catch {}

      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser) {
        adminName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || adminName;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: finalAmount,
          adminNotes: adminNotes.trim() || null,
          processedBy: adminName
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Tasdiqlashda xatolik yuz berdi");
      }

      setActionSuccess(`🎉 To'lov muvaffaqiyatli tasdiqlandi! Foydalanuvchi hisobiga ${finalAmount.toLocaleString('uz-UZ')} so'm qo'shildi.`);
      await fetchReceipt();
    } catch (e: any) {
      alert(e.message || "Xatolik yuz berdi");
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleReject = async () => {
    if (!receipt) return;
    if (receipt.status !== 'Pending') {
      alert("⚠️ Ushbu chek allaqachon ko'rib chiqilgan!");
      return;
    }

    if (!rejectReason.trim()) {
      alert("Iltimos, rad etish sababini ko'rsating!");
      return;
    }

    setSubmittingReject(true);
    setActionSuccess(null);
    try {
      const url = `/api/subscription/receipt-verify/${id}/reject?token=${encodeURIComponent(token)}`;
      const tokenHeader = localStorage.getItem('token') || localStorage.getItem('lanswitch_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenHeader) headers['Authorization'] = `Bearer ${tokenHeader}`;

      let adminName = 'Admin';
      try {
        const u = localStorage.getItem('lanswitch_user');
        if (u) adminName = JSON.parse(u)?.fullName || 'Admin';
      } catch {}

      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      if (tgUser) {
        adminName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || adminName;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: rejectReason.trim(),
          processedBy: adminName
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Rad etishda xatolik yuz berdi");
      }

      setShowRejectForm(false);
      setActionSuccess("❌ To'lov rad etildi va foydalanuvchiga Telegram orqali xabar yuborildi.");
      await fetchReceipt();
    } catch (e: any) {
      alert(e.message || "Xatolik yuz berdi");
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleCloseWebApp = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.close();
    } else {
      window.close();
    }
  };

  const isPending = receipt?.status === 'Pending';
  const isApproved = receipt?.status === 'Approved';
  const isRejected = receipt?.status === 'Rejected';

  return (
    <div className="verify-receipt-container">
      {/* Top Header */}
      <div className="verify-header">
        <div className="header-left">
          <span className="badge-tag">ADMIN WEB APP</span>
          <h1 className="header-title">To'lov Chekini Tekshirish</h1>
          <span className="header-id">№ {id}</span>
        </div>
        <button className="btn-close-app" onClick={handleCloseWebApp} title="Yopish">
          ✕ Yopish
        </button>
      </div>

      {loading && (
        <div className="verify-loading">
          <div className="spinner"></div>
          <p>Chek ma'lumotlari yuklanmoqda...</p>
        </div>
      )}

      {error && (
        <div className="verify-alert error">
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {actionSuccess && (
        <div className="verify-alert success animate-fade-in">
          <span>✅</span>
          <div>{actionSuccess}</div>
        </div>
      )}

      {receipt && (
        <div className="verify-content animate-fade-in">

          {/* STATUS BANNER */}
          {isApproved && (
            <div className="status-banner approved">
              <div className="status-icon">✅</div>
              <div className="status-details">
                <div className="status-title">TO'LOV ALLAQACHON TASDIQLANGAN</div>
                <div className="status-sub">
                  Tasdiqlangan summa: <strong>{(receipt.approvedAmount ?? receipt.amount).toLocaleString('uz-UZ')} so'm</strong>
                </div>
                <div className="status-meta">
                  <span>👮‍♂️ Tasdiqladi: {receipt.processedBy || 'Admin'}</span>
                  {receipt.processedAt && (
                    <span>📅 Vaqt: {new Date(receipt.processedAt).toLocaleString('uz-UZ')}</span>
                  )}
                </div>
                <div className="status-warning">
                  ⚠️ Bu to'lov oldin tasdiqlangan va foydalanuvchi hisobiga tushgan. Qayta tasdiqlab bo'lmaydi!
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="status-banner rejected">
              <div className="status-icon">❌</div>
              <div className="status-details">
                <div className="status-title">TO'LOV RAD ETILGAN</div>
                <div className="status-sub">
                  Rad etish sababi: <strong>{receipt.adminNotes || "Ko'rsatilmagan"}</strong>
                </div>
                <div className="status-meta">
                  <span>👮‍♂️ Rad etdi: {receipt.processedBy || 'Admin'}</span>
                  {receipt.processedAt && (
                    <span>📅 Vaqt: {new Date(receipt.processedAt).toLocaleString('uz-UZ')}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isPending && (
            <div className="status-banner pending">
              <div className="status-icon">⏳</div>
              <div className="status-details">
                <div className="status-title">TO'LOV KUTILMOQDA (PENDING)</div>
                <div className="status-sub">
                  Chekdagi ma'lumotlarni tekshiring va summani kiritib tasdiqlang
                </div>
              </div>
            </div>
          )}

          {/* MAIN GRID: CHEK RASMI & MA'LUMOTLAR */}
          <div className="verify-grid">
            
            {/* CHEK RASMI */}
            <div className="receipt-image-card">
              <div className="card-top-title">
                <span>📸 To'lov Cheki (Kvitansiya)</span>
                <button
                  type="button"
                  className="btn-zoom-toggle"
                  onClick={() => setImageZoomed(!imageZoomed)}
                >
                  {imageZoomed ? "🔍 Kichraytirish" : "🔍 Kattalashtirish"}
                </button>
              </div>

              <div className={`receipt-image-wrapper ${imageZoomed ? 'zoomed' : ''}`}>
                <img
                  src={receipt.receiptImageUrl}
                  alt="To'lov cheki"
                  className="receipt-main-image"
                  onClick={() => setImageZoomed(!imageZoomed)}
                />
              </div>

              <a
                href={receipt.receiptImageUrl}
                target="_blank"
                rel="noreferrer"
                className="receipt-external-link"
              >
                ↗ Rasmni to'liq o'lchamda ochish
              </a>
            </div>

            {/* METADATA VA AMALLAR */}
            <div className="receipt-info-card">

              {/* Foydalanuvchi ma'lumotlari */}
              <div className="user-info-section">
                <div className="info-row">
                  <span className="info-label">👤 Foydalanuvchi:</span>
                  <span className="info-value highlight">{receipt.userFullName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">📱 Username:</span>
                  <span className="info-value">
                    {receipt.userUsername ? `@${receipt.userUsername}` : "Mavjud emas"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">🆔 Telegram ID:</span>
                  <span className="info-value font-mono">{receipt.userTelegramId}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">📦 Tanlangan tarif:</span>
                  <span className="info-value plan-name">
                    {receipt.planName} ({receipt.monthlyPrice.toLocaleString('uz-UZ')} so'm/oy)
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">📅 Yuborilgan vaqt:</span>
                  <span className="info-value">
                    {new Date(receipt.createdAt).toLocaleString('uz-UZ')}
                  </span>
                </div>
              </div>

              {/* HARAKATLAR QISMI (Faqat Pending bo'lsa) */}
              {isPending && (
                <div className="verify-actions-section">

                  {/* SUMMA KIRITISH MAYDONI */}
                  <div className="form-field">
                    <label className="field-label">
                      💰 To'lov summasi (so'm):
                      <span className="field-hint">* Chekdagi summani kiriting</span>
                    </label>
                    <input
                      type="number"
                      className="amount-input"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Chekdagi summani kiriting..."
                      min={1000}
                      step={1000}
                      autoFocus
                    />

                    {/* Tezkor Summa Tugmalari */}
                    <div className="quick-amount-pills">
                      <button type="button" onClick={() => setAmountInput(15000)}>15 000</button>
                      <button type="button" onClick={() => setAmountInput(50000)}>50 000 (Student)</button>
                      <button type="button" onClick={() => setAmountInput(99000)}>99 000 (Standart)</button>
                      <button type="button" onClick={() => setAmountInput(189000)}>189 000 (Pro)</button>
                      <button type="button" onClick={() => setAmountInput(249000)}>249 000 (Max)</button>
                    </div>

                    {/* Jonli Muddat Hisob-kitobi */}
                    {amountInput && Number(amountInput) > 0 && (
                      <div className="est-duration-box">
                        ⏳ Ushbu summa bilan tarif muddati: <strong>{getEstimatedDuration(amountInput)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Admin Izohi */}
                  <div className="form-field">
                    <label className="field-label">📝 Admin izohi (ixtiyoriy):</label>
                    <input
                      type="text"
                      className="notes-input"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Masalan: Humo orqali to'lov qabul qilindi"
                    />
                  </div>

                  {/* TASDIQLASH VA RAD ETISH TUGMALARI */}
                  {!showRejectForm ? (
                    <div className="buttons-row">
                      <button
                        type="button"
                        className="btn-approve"
                        onClick={handleApprove}
                        disabled={submittingApprove || !amountInput || Number(amountInput) <= 0}
                      >
                        {submittingApprove ? "Tasdiqlanmoqda..." : "✅ To'lovni tasdiqlash"}
                      </button>

                      <button
                        type="button"
                        className="btn-open-reject"
                        onClick={() => setShowRejectForm(true)}
                        disabled={submittingApprove}
                      >
                        ❌ Rad etish
                      </button>
                    </div>
                  ) : (
                    /* RAD ETISH FORMASI */
                    <div className="reject-form-box animate-fade-in">
                      <div className="reject-title">❌ To'lovni rad etish sababi:</div>
                      
                      {/* Tezkor sabablar */}
                      <div className="reject-quick-pills">
                        <button type="button" onClick={() => setRejectReason("Chek xira / ma'lumotlar o'qilmadi")}>
                          Chek xira
                        </button>
                        <button type="button" onClick={() => setRejectReason("Bunday to'lov hisobga tushmagan")}>
                          To'lov tushmagan
                        </button>
                        <button type="button" onClick={() => setRejectReason("Soxta yoki noto'g'ri kvitansiya")}>
                          Soxta kvitansiya
                        </button>
                        <button type="button" onClick={() => setRejectReason("Summa minimal miqdordan (15 000 so'm) kam")}>
                          Minimal miqdor kam
                        </button>
                      </div>

                      <textarea
                        className="reject-textarea"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Foydalanuvchiga yuboriladigan rad etish sababini batafsil yozing..."
                        rows={3}
                      />

                      <div className="reject-actions-row">
                        <button
                          type="button"
                          className="btn-cancel-reject"
                          onClick={() => setShowRejectForm(false)}
                          disabled={submittingReject}
                        >
                          Ortga
                        </button>
                        <button
                          type="button"
                          className="btn-confirm-reject"
                          onClick={handleReject}
                          disabled={submittingReject || !rejectReason.trim()}
                        >
                          {submittingReject ? "Yuborilmoqda..." : "❌ Rad etishni tasdiqlash"}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Agar allaqachon ko'rib chiqilgan bo'lsa */}
              {!isPending && (
                <div className="already-processed-notice">
                  ℹ️ Ushbu kvitansiya holati <strong>{receipt.status}</strong>. Barcha amallar bajarilgan va yozuvlar saqlangan.
                </div>
              )}

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default VerifyReceiptPage;
