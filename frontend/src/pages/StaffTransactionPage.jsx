import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../services/api';
import './StaffTransactionPage.css';

export default function StaffTransactionPage() {
  const currentShift = getShiftName();

  // Form states
  const [saleForm, setSaleForm] = useState({
    description: '',
    amount: '',
    paymentMethod: 'cash',
    notes: '',
    shift: currentShift
  });

  const [refundForm, setRefundForm] = useState({
    description: '',
    amount: '',
    notes: '',
    shift: currentShift
  });

  const [ownerWithdrawForm, setOwnerWithdrawForm] = useState({
    amount: '',
    notes: '',
    shift: currentShift
  });

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [previousSummary, setPreviousSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadShiftData();
    const interval = setInterval(loadShiftData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [currentShift]);

  async function loadShiftData() {
    try {
      setLoading(true);
      const resultRes = await staffApi.getShiftSummary(currentShift);
      const prevShift = getPreviousShift(currentShift);
      const prevRes = await staffApi.getShiftSummary(prevShift);

      const result = resultRes?.data?.data || {};
      const prevResult = prevRes?.data?.data || {};

      setSummary(result);
      setPreviousSummary(prevResult);
      setTransactions(result.transactions || []);
      setError('');
    } catch (err) {
      setError('Không tải được dữ liệu ca: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaleSubmit(e) {
    e.preventDefault();
    if (!saleForm.description || !saleForm.amount) {
      setError('Vui lòng nhập nội dung bán và số tiền');
      return;
    }

    try {
      await staffApi.createTransaction({
        type: 'sale',
        description: saleForm.description,
        amount: Math.round(parseFloat(saleForm.amount)),
        payment_method: saleForm.paymentMethod,
        notes: saleForm.notes,
        shift: currentShift
      });
      
      setSuccessMsg('✓ Đã ghi nhận giao dịch bán');
      setSaleForm({ description: '', amount: '', paymentMethod: 'cash', notes: '', shift: currentShift });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadShiftData();
    } catch (err) {
      setError('Không ghi nhận được giao dịch bán: ' + err.message);
    }
  }

  async function handleRefundSubmit(e) {
    e.preventDefault();
    if (!refundForm.description || !refundForm.amount) {
      setError('Vui lòng chọn lý do và nhập số tiền hoàn');
      return;
    }

    try {
      await staffApi.createRefund({
        description: refundForm.description,
        amount: Math.round(parseFloat(refundForm.amount)),
        notes: refundForm.notes,
        shift: currentShift
      });

      setSuccessMsg('✓ Đã ghi nhận hoàn tiền');
      setRefundForm({ description: '', amount: '', notes: '', shift: currentShift });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadShiftData();
    } catch (err) {
      setError('Không ghi nhận được hoàn tiền: ' + err.message);
    }
  }

  async function handleOwnerWithdrawSubmit(e) {
    e.preventDefault();
    if (!ownerWithdrawForm.amount) {
      setError('Vui lòng nhập số tiền chủ rút');
      return;
    }

    try {
      await staffApi.ownerWithdrawCash({
        description: 'Chu rut bot tien mat',
        amount: Math.round(parseFloat(ownerWithdrawForm.amount)),
        notes: ownerWithdrawForm.notes,
        shift: currentShift
      });

      setSuccessMsg('✓ Đã ghi nhận tiền chủ rút');
      setOwnerWithdrawForm({ amount: '', notes: '', shift: currentShift });
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadShiftData();
    } catch (err) {
      setError('Không ghi nhận được tiền chủ rút: ' + err.message);
    }
  }

  return (
    <div className="staff-transaction-page">
      <div className="transaction-header">
        <h1>💰 {localStorage.getItem('user_name') || 'Nhân viên'} - Sổ Thu Chi ({shiftLabel(currentShift)})</h1>
        <Link to="/staff" className="transaction-back-link">Quay lại trang nhân viên</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="transaction-grid">
        {/* LEFT: Forms */}
        <div className="transaction-forms">
          {/* Sale Form */}
          <div className="form-card">
            <h2>📦 Ghi nhận bán hàng</h2>
            <form onSubmit={handleSaleSubmit}>
              <div className="form-group">
                <label>Nội dung bán *</label>
                <input
                  type="text"
                  placeholder="VD: 5 chai nước suối, 2 lon trà ô long"
                  value={saleForm.description}
                  onChange={(e) => setSaleForm({...saleForm, description: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Số tiền (₫) *</label>
                <input
                  type="number"
                  placeholder="VD: 50000"
                  value={saleForm.amount}
                  onChange={(e) => setSaleForm({...saleForm, amount: e.target.value})}
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div className="form-group">
                <label>Phương thức thanh toán *</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="cash"
                      checked={saleForm.paymentMethod === 'cash'}
                      onChange={(e) => setSaleForm({...saleForm, paymentMethod: e.target.value})}
                    />
                    💵 Tiền mặt
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="transfer"
                      checked={saleForm.paymentMethod === 'transfer'}
                      onChange={(e) => setSaleForm({...saleForm, paymentMethod: e.target.value})}
                    />
                    💳 Chuyển khoản
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  placeholder="Ghi chú thêm..."
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({...saleForm, notes: e.target.value})}
                  rows="2"
                />
              </div>

              <button type="submit" className="btn btn-primary">Lưu giao dịch bán</button>
            </form>
          </div>

          {/* Refund Form */}
          <div className="form-card">
            <h2>↩️ Ghi nhận hoàn tiền</h2>
            <form onSubmit={handleRefundSubmit}>
              <div className="form-group">
                <label>Lý do *</label>
                <select
                  value={refundForm.description}
                  onChange={(e) => setRefundForm({...refundForm, description: e.target.value})}
                  required
                >
                  <option value="">-- Chọn lý do --</option>
                  <option value="wrong_entry">❌ Nhập nhầm</option>
                  <option value="customer_return">🔄 Khách trả lại nước</option>
                  <option value="booking_cancel">📅 Hủy lịch đặt sân</option>
                  <option value="damaged">💔 Hàng hỏng/lỗi</option>
                  <option value="adjustment">⚙️ Điều chỉnh</option>
                  <option value="other">📝 Khác</option>
                </select>
              </div>

              <div className="form-group">
                <label>Số tiền hoàn (₫) *</label>
                <input
                  type="number"
                  placeholder="VD: 25000"
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({...refundForm, amount: e.target.value})}
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div className="form-group">
                <label>Ghi chú nhân viên</label>
                <textarea
                  placeholder="Lý do chi tiết của hoàn tiền..."
                  value={refundForm.notes}
                  onChange={(e) => setRefundForm({...refundForm, notes: e.target.value})}
                  rows="2"
                />
              </div>

              <button type="submit" className="btn btn-warning">Lưu hoàn tiền</button>
            </form>
          </div>

          <div className="form-card">
            <h2>🏦 Chủ rút tiền mặt</h2>
            <form onSubmit={handleOwnerWithdrawSubmit}>
              <div className="form-group">
                <label>Số tiền chủ rút (₫) *</label>
                <input
                  type="number"
                  placeholder="VD: 200000"
                  value={ownerWithdrawForm.amount}
                  onChange={(e) => setOwnerWithdrawForm({ ...ownerWithdrawForm, amount: e.target.value })}
                  required
                  min="0"
                  step="1000"
                />
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  placeholder="VD: Chủ rút tiền cuối ca"
                  value={ownerWithdrawForm.notes}
                  onChange={(e) => setOwnerWithdrawForm({ ...ownerWithdrawForm, notes: e.target.value })}
                  rows="2"
                />
              </div>

              <button type="submit" className="btn btn-primary">Lưu tiền chủ rút</button>
            </form>
          </div>
        </div>

        {/* RIGHT: Summary & Transactions */}
        <div className="transaction-summary">
          {loading ? (
            <div className="loading">Đang tải dữ liệu ca...</div>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="card-label">💰 Tổng thu</div>
                  <div className="card-value">₫{(summary.income || 0).toLocaleString()}</div>
                  <div className="card-detail">{summary.transactions?.filter(t => t.type === 'sale').length || 0} giao dịch bán</div>
                </div>

                <div className="summary-card">
                  <div className="card-label">💵 Tiền mặt</div>
                  <div className="card-value">₫{(summary.cash || 0).toLocaleString()}</div>
                </div>

                <div className="summary-card">
                  <div className="card-label">💳 Chuyển khoản</div>
                  <div className="card-value">₫{(summary.transfer || 0).toLocaleString()}</div>
                </div>

                <div className="summary-card highlight-refund">
                  <div className="card-label">↩️ Hoàn tiền</div>
                  <div className="card-value">-₫{Math.abs(summary.refund || 0).toLocaleString()}</div>
                  <div className="card-detail">{summary.transactions?.filter(t => t.type === 'refund').length || 0} giao dịch hoàn</div>
                </div>

                <div className="summary-card highlight-refund">
                  <div className="card-label">📦 Chi phí nhập nước</div>
                  <div className="card-value">-₫{Math.abs(summary.stock_in_cost || 0).toLocaleString()}</div>
                </div>

                <div className="summary-card highlight-refund">
                  <div className="card-label">🏦 Chủ đã rút</div>
                  <div className="card-value">-₫{Math.abs(summary.owner_withdraw || 0).toLocaleString()}</div>
                </div>

                <div className="summary-card highlight-total">
                  <div className="card-label">📊 Tổng ròng</div>
                  <div className="card-value">₫{(summary.net_revenue || summary.total || 0).toLocaleString()}</div>
                  <div className="card-detail">Doanh thu sau khi trừ hoàn/nhập hàng</div>
                </div>

                <div className="summary-card highlight-total">
                  <div className="card-label">💵 Số dư tiền mặt</div>
                  <div className="card-value">₫{(summary.cash_balance || 0).toLocaleString()}</div>
                  <div className="card-detail">Đã trừ tiền chủ rút</div>
                </div>
              </div>

              {/* Transaction List */}
              <div className="transaction-list">
                <h3>📝 Giao dịch trong ca ({shiftLabel(currentShift)})</h3>
                {transactions.length === 0 ? (
                  <div className="no-data">Chưa có giao dịch trong ca này</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Loại</th>
                          <th>Nội dung</th>
                          <th>Số tiền</th>
                          <th>Phương thức</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((txn) => (
                          <tr key={txn.id} className={`txn-${txn.type}`}>
                            <td className="txn-time">
                              {new Date(txn.created_at).toLocaleTimeString()}
                            </td>
                            <td className="txn-type">
                              {txn.type === 'sale' ? '💰 Bán hàng' : txn.type === 'refund' ? '↩️ Hoàn tiền' : '⚙️ Điều chỉnh'}
                            </td>
                            <td className="txn-desc">{txn.description}</td>
                            <td className={`txn-amount ${txn.type === 'refund' ? 'negative' : 'positive'}`}>
                              {txn.type === 'refund' ? '-' : '+'}₫{Math.abs(txn.amount).toLocaleString()}
                            </td>
                            <td className="txn-method">{txn.payment_method || '-'}</td>
                            <td className="txn-notes">{txn.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Reconciliation Tips */}
              <div className="reconciliation-tips">
                <h4>✓ Checklist đối soát ca</h4>
                <ul>
                  <li>📊 So sánh <strong>Tổng ròng</strong> (₫{(summary.net_revenue || summary.total || 0).toLocaleString()}) với tiền thực nhận</li>
                  <li>💵 Tách riêng tiền mặt (₫{(summary.cash || 0).toLocaleString()}) và chuyển khoản (₫{(summary.transfer || 0).toLocaleString()})</li>
                  <li>📦 Trừ chi phí nhập hàng (₫{(summary.stock_in_cost || 0).toLocaleString()}) khỏi doanh thu bán nước</li>
                  <li>🏦 Trừ tiền chủ đã rút (₫{(summary.owner_withdraw || 0).toLocaleString()}) để ra số dư tiền mặt thực tế</li>
                  <li>🔁 Ca trước ({shiftLabel(getPreviousShift(currentShift))}) tổng ròng: <strong>₫{(previousSummary?.net_revenue || previousSummary?.total || 0).toLocaleString()}</strong></li>
                  <li>🧮 Chênh lệch so với ca trước: <strong>₫{(((summary.net_revenue || summary.total || 0)) - ((previousSummary?.net_revenue || previousSummary?.total || 0))).toLocaleString()}</strong></li>
                  <li>❌ Nếu lệch, kiểm tra lại cột <strong>Ghi chú</strong> để tìm giao dịch điều chỉnh</li>
                  <li>📝 Giữ lại chứng từ thu tiền để đối chiếu khi có sai lệch</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="no-data">Không có dữ liệu tổng hợp</div>
          )}
        </div>
      </div>
    </div>
  );
}

function shiftLabel(shift) {
  if (shift === 'morning') return 'sáng';
  if (shift === 'afternoon') return 'chiều';
  return 'tối';
}

function getShiftName() {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function getPreviousShift(shift) {
  if (shift === 'morning') return 'evening';
  if (shift === 'afternoon') return 'morning';
  return 'afternoon';
}
