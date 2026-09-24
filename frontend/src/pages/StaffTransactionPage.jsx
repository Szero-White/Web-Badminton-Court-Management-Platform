import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TransactionForms from '../features/transactions/components/TransactionForms';
import ShiftSummaryPanel from '../features/transactions/components/ShiftSummaryPanel';
import { staffApi } from '../services/api';
import { getPreviousShift, getShiftName, shiftLabel } from '../utils/shift';
import './StaffTransactionPage.css';
import './StaffTransactionTable.css';

function toPositiveAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export default function StaffTransactionPage() {
  const currentShift = getShiftName();
  const previousShift = getPreviousShift(currentShift);
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
  }, [currentShift]);

  async function loadShiftData() {
    try {
      setLoading(true);
      const [currentResponse, previousResponse] = await Promise.all([
        staffApi.getShiftSummary(currentShift),
        staffApi.getShiftSummary(previousShift)
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

  return (
    <div className="staff-transaction-page">
      <div className="transaction-header">
        <h1>💰 {localStorage.getItem('user_name') || 'Nhân viên'} - Sổ Thu Chi ({shiftLabel(currentShift)})</h1>
        <Link to="/staff" className="transaction-back-link">Quay lại trang nhân viên</Link>
      </div>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      {successMessage ? <div className="alert alert-success" role="status">{successMessage}</div> : null}
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
