import { useEffect, useState } from 'react';
import AppToast from '../components/feedback/AppToast';
import PageBackButton from '../components/navigation/PageBackButton';
import TransactionForms from '../features/transactions/components/TransactionForms';
import ShiftSummaryPanel from '../features/transactions/components/ShiftSummaryPanel';
import { staffApi } from '../services/api';
import { getPreviousShift, getShiftName, shiftLabel } from '../utils/shift';
import './StaffTransactionPage.css';
import './StaffTransactionTable.css';


function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousShiftBusinessDay(currentShift) {
  const date = new Date();
  if (currentShift === 'morning') date.setDate(date.getDate() - 1);
  return localDateString(date);
}

function toPositiveAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export default function StaffTransactionPage() {
  const currentShift = getShiftName();
  const previousShift = getPreviousShift(currentShift);
  const businessDay = localDateString();
  const previousBusinessDay = previousShiftBusinessDay(currentShift);
  const staffName = localStorage.getItem('user_name') || 'Nhân viên';
  const [saleForm, setSaleForm] = useState({ description: '', amount: '', paymentMethod: 'cash', notes: '', shift: currentShift });
  const [refundForm, setRefundForm] = useState({ description: '', amount: '', notes: '', shift: currentShift });
  const [ownerWithdrawForm, setOwnerWithdrawForm] = useState({ amount: '', notes: '', shift: currentShift });
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [previousSummary, setPreviousSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadShiftData();
    const intervalId = window.setInterval(loadShiftData, 30_000);
    return () => window.clearInterval(intervalId);
  }, [currentShift, businessDay, previousBusinessDay]);

  async function loadShiftData() {
    try {
      setLoading(true);
      const [currentResponse, previousResponse] = await Promise.all([
        staffApi.getShiftSummary(currentShift, businessDay),
        staffApi.getShiftSummary(previousShift, previousBusinessDay)
      ]);
      const current = currentResponse?.data?.data || {};
      setSummary(current);
      setPreviousSummary(previousResponse?.data?.data || {});
      setTransactions(current.transactions || []);
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không tải được dữ liệu ca.');
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(message) {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 3000);
  }

  async function handleSaleSubmit(event) {
    event.preventDefault();
    const amount = toPositiveAmount(saleForm.amount);
    if (!saleForm.description.trim() || amount === 0) {
      setError('Vui lòng nhập nội dung bán và số tiền hợp lệ.');
      return;
    }
    try {
      await staffApi.createTransaction({
        type: 'sale',
        description: saleForm.description.trim(),
        amount,
        payment_method: saleForm.paymentMethod,
        notes: saleForm.notes.trim(),
        shift: currentShift
      });
      setSaleForm({ description: '', amount: '', paymentMethod: 'cash', notes: '', shift: currentShift });
      showSuccess('✓ Đã ghi nhận giao dịch bán.');
      await loadShiftData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không ghi nhận được giao dịch bán.');
    }
  }

  async function handleRefundSubmit(event) {
    event.preventDefault();
    const amount = toPositiveAmount(refundForm.amount);
    if (!refundForm.description || amount === 0) {
      setError('Vui lòng chọn lý do và nhập số tiền hoàn hợp lệ.');
      return;
    }
    try {
      await staffApi.createRefund({
        description: refundForm.description,
        amount,
        notes: refundForm.notes.trim(),
        shift: currentShift
      });
      setRefundForm({ description: '', amount: '', notes: '', shift: currentShift });
      showSuccess('✓ Đã ghi nhận hoàn tiền.');
      await loadShiftData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không ghi nhận được hoàn tiền.');
    }
  }

  async function handleOwnerWithdrawSubmit(event) {
    event.preventDefault();
    const amount = toPositiveAmount(ownerWithdrawForm.amount);
    if (amount === 0) {
      setError('Vui lòng nhập số tiền chủ rút hợp lệ.');
      return;
    }
    try {
      await staffApi.ownerWithdrawCash({
        description: 'Chủ rút bớt tiền mặt',
        amount,
        notes: ownerWithdrawForm.notes.trim(),
        shift: currentShift
      });
      setOwnerWithdrawForm({ amount: '', notes: '', shift: currentShift });
      showSuccess('✓ Đã ghi nhận tiền chủ rút.');
      await loadShiftData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không ghi nhận được tiền chủ rút.');
    }
  }

  const displayDate = new Date(`${businessDay}T00:00:00`).toLocaleDateString('vi-VN');

  return (
    <main className="staff-transaction-page">
      <header className="transaction-page-header">
        <div className="transaction-page-heading">
          <span className="transaction-page-eyebrow">Vận hành ca làm việc</span>
          <h1>Sổ thu chi</h1>
          <p>Theo dõi doanh thu, hoàn tiền và dòng tiền trong ca hiện tại.</p>
          <div className="transaction-context">
            <span className="transaction-context-chip"><span className="context-dot" aria-hidden="true" />{staffName}</span>
            <span className="transaction-context-chip">{shiftLabel(currentShift)}</span>
            <span className="transaction-context-chip">{displayDate}</span>
          </div>
        </div>
        <PageBackButton to="/staff" label="Quay lại Đặt sân" />
      </header>

      <AppToast message={error || successMessage} tone={error ? 'error' : 'success'} />

      <div className="transaction-workspace">
        <aside className="transaction-entry-column" aria-label="Ghi nhận giao dịch">
          <div className="transaction-section-heading">
            <span>Ghi nhận giao dịch</span>
            <small>Nhập nghiệp vụ phát sinh trong ca</small>
          </div>
          <TransactionForms
          saleForm={saleForm}
          setSaleForm={setSaleForm}
          refundForm={refundForm}
          setRefundForm={setRefundForm}
          ownerWithdrawForm={ownerWithdrawForm}
          setOwnerWithdrawForm={setOwnerWithdrawForm}
          onSaleSubmit={handleSaleSubmit}
          onRefundSubmit={handleRefundSubmit}
          onOwnerWithdrawSubmit={handleOwnerWithdrawSubmit}
          />
        </aside>

        <section className="transaction-overview-column" aria-label="Tổng hợp ca">
          <div className="transaction-section-heading">
            <span>Tổng quan ca</span>
            <small>Dữ liệu tự làm mới mỗi 30 giây</small>
          </div>
          <ShiftSummaryPanel
          loading={loading}
          summary={summary}
          previousSummary={previousSummary}
          transactions={transactions}
          currentShift={currentShift}
          previousShift={previousShift}
          shiftLabel={shiftLabel}
          />
        </section>
      </div>
    </main>
  );
}
