import { useEffect, useState } from 'react';
import AppToast from '../components/feedback/AppToast';
import PageBackButton from '../components/navigation/PageBackButton';
import TransactionForms from '../features/transactions/components/TransactionForms';
import ShiftSummaryPanel from '../features/transactions/components/ShiftSummaryPanel';
import { staffApi } from '../services/api';
import { getPreviousShift, getShiftName, shiftLabel } from '../utils/shift';
import './StaffTransactionPage.css';
import './StaffTransactionTable.css';
import useAppNotice from '../hooks/useAppNotice';


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
  const [saleForm, setSaleForm] = useState({ description: '', amount: '', paymentMethod: 'cash', notes: '', shift: currentShift });
  const [refundForm, setRefundForm] = useState({ description: '', amount: '', notes: '', shift: currentShift });
  const [ownerWithdrawForm, setOwnerWithdrawForm] = useState({ amount: '', notes: '', shift: currentShift });
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [previousSummary, setPreviousSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notice, setNotice, clearNotice } = useAppNotice();
  const error = notice?.tone === 'error' ? notice.text : '';
  const successMessage = notice?.tone === 'success' ? notice.text : '';
  const setError = (value) => {
    if (!value) { clearNotice(); return; }
    setNotice({ text: value, tone: 'error' });
  };
  const setSuccessMessage = (value) => {
    if (!value) { clearNotice(); return; }
    setNotice({ text: value, tone: 'success' });
  };

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
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không tải được dữ liệu ca.');
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(message) {
    setSuccessMessage(message);
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

  return (
    <div className="staff-transaction-page">
      <div className="transaction-header">
        <h1>💰 {localStorage.getItem('user_name') || 'Nhân viên'} - Sổ Thu Chi ({shiftLabel(currentShift)} · {new Date(`${businessDay}T00:00:00`).toLocaleDateString('vi-VN')})</h1>
        <PageBackButton to="/staff" label="Quay lại Đặt sân" />
      </div>
      <AppToast message={notice} onDismiss={clearNotice} />
      <div className="transaction-grid">
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
        <ShiftSummaryPanel
          loading={loading}
          summary={summary}
          previousSummary={previousSummary}
          transactions={transactions}
          currentShift={currentShift}
          previousShift={previousShift}
          shiftLabel={shiftLabel}
        />
      </div>
    </div>
  );
}
