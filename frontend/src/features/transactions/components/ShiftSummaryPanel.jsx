const TYPE_LABELS = {
  sale: '💰 Bán hàng',
  refund: '↩️ Hoàn tiền',
  stock_in: '📦 Nhập hàng',
  owner_withdraw: '🏦 Chủ rút tiền',
  adjust: '⚙️ Điều chỉnh'
};

const PAYMENT_LABELS = { cash: 'Tiền mặt', transfer: 'Chuyển khoản' };

function money(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

export default function ShiftSummaryPanel({ loading, summary, previousSummary, transactions, currentShift, shiftLabel, previousShift }) {
  if (loading) return <div className="transaction-summary"><div className="loading">Đang tải dữ liệu ca...</div></div>;
  if (!summary) return <div className="transaction-summary"><div className="no-data">Không có dữ liệu tổng hợp</div></div>;

  const netRevenue = summary.net_revenue || summary.total || 0;
  const previousNet = previousSummary?.net_revenue || previousSummary?.total || 0;
  const cards = [
    ['Thu tiền sân', summary.booking_income, 'Cọc + thanh toán booking', 'income'],
    ['Bán nước', summary.beverage_income, `${transactions.filter((item) => item.type === 'sale').length} giao dịch bán`, 'income'],
    ['Tổng thu', summary.income, 'Tiền sân + bán nước', 'income'],
    ['Tiền mặt', summary.cash, 'Đã thu bằng tiền mặt', 'neutral'],
    ['Chuyển khoản', summary.transfer, 'Đã thu qua chuyển khoản', 'neutral'],
    ['Hoàn tiền', -Math.abs(summary.refund || 0), `${transactions.filter((item) => item.type === 'refund').length} giao dịch hoàn`, 'expense'],
    ['Chi phí nhập nước', -Math.abs(summary.stock_in_cost || 0), 'Chi phí nhập hàng trong ca', 'expense'],
    ['Chủ đã rút', -Math.abs(summary.owner_withdraw || 0), 'Tiền mặt chủ đã rút', 'expense'],
    ['Tổng ròng', netRevenue, 'Sau hoàn tiền và chi phí', 'primary'],
    ['Số dư tiền mặt', summary.cash_balance || 0, 'Sau khi trừ tiền chủ rút', 'primary']
  ];

  return (
    <div className="transaction-summary">
      <div className="summary-cards">
        {cards.map(([label, value, detail, tone]) => (
          <article className={`summary-card summary-card-${tone}`} key={label}>
            <div className="card-label">{label}</div>
            <div className="card-value">{Number(value) < 0 ? '-' : ''}₫{money(Math.abs(value))}</div>
            {detail ? <div className="card-detail">{detail}</div> : null}
          </article>
        ))}
      </div>


      <section className="transaction-list">
        <div className="transaction-list-heading"><div><h3>Thu tiền sân</h3><p>{shiftLabel(currentShift)} · các khoản cọc và thanh toán booking</p></div><span className="transaction-count">{(summary.booking_payments || []).length}</span></div>
        {(summary.booking_payments || []).length === 0 ? <div className="no-data">Chưa có khoản thu tiền sân trong ca này</div> : (
          <div className="table-container">
            <table>
              <thead><tr><th>Thời gian</th><th>Booking</th><th>Nội dung</th><th>Số tiền</th><th>Phương thức</th></tr></thead>
              <tbody>
                {(summary.booking_payments || []).map((payment) => {
                  const negative = Number(payment.amount) < 0;
                  return (
                    <tr key={`booking-payment-${payment.id}`}>
                      <td className="txn-time">{new Date(payment.created_at).toLocaleTimeString('vi-VN')}</td>
                      <td className="txn-desc"><strong>{payment.booking?.booking_code || `#${payment.booking_id}`}</strong></td>
                      <td className="txn-type">{payment.payment_for === 'refund' ? 'Hoàn tiền sân' : payment.payment_for === 'deposit' ? 'Cọc sân' : 'Thanh toán sân'}</td>
                      <td className={`txn-amount ${negative ? 'negative' : 'positive'}`}>{negative ? '-' : '+'}₫{money(Math.abs(payment.amount))}</td>
                      <td className="txn-method">{PAYMENT_LABELS[payment.method] || payment.method || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="transaction-list">
        <div className="transaction-list-heading"><div><h3>Giao dịch trong ca</h3><p>{shiftLabel(currentShift)} · bán hàng, hoàn tiền và điều chỉnh</p></div><span className="transaction-count">{transactions.length}</span></div>
        {transactions.length === 0 ? <div className="no-data">Chưa có giao dịch trong ca này</div> : (
          <div className="table-container">
            <table>
              <thead><tr><th>Thời gian</th><th>Loại</th><th>Nội dung</th><th>Số tiền</th><th>Phương thức</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {transactions.map((txn) => {
                  const negative = Number(txn.amount) < 0;
                  return (
                    <tr key={txn.id} className={`txn-${txn.type}`}>
                      <td className="txn-time">{new Date(txn.created_at).toLocaleTimeString('vi-VN')}</td>
                      <td className="txn-type">{TYPE_LABELS[txn.type] || '⚙️ Điều chỉnh'}</td>
                      <td className="txn-desc">{txn.description}</td>
                      <td className={`txn-amount ${negative ? 'negative' : 'positive'}`}>{negative ? '-' : '+'}₫{money(Math.abs(txn.amount))}</td>
                      <td className="txn-method">{PAYMENT_LABELS[txn.payment_method] || txn.payment_method || '-'}</td>
                      <td className="txn-notes">{txn.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reconciliation-tips">
        <div className="reconciliation-heading"><span className="reconciliation-icon" aria-hidden="true">✓</span><div><h4>Checklist đối soát ca</h4><p>Kiểm tra nhanh trước khi bàn giao ca</p></div></div>
        <ul>
          <li>📊 Đối chiếu <strong>Tổng ròng</strong> (₫{money(netRevenue)}) với tiền thực nhận</li>
          <li>💵 Tổng hợp cả tiền sân và quầy nước; tách riêng tiền mặt (₫{money(summary.cash)}) và chuyển khoản (₫{money(summary.transfer)})</li>
          <li>📦 Trừ chi phí nhập hàng (₫{money(summary.stock_in_cost)}) khỏi doanh thu bán nước</li>
          <li>🏦 Trừ tiền chủ đã rút (₫{money(summary.owner_withdraw)}) để ra số dư tiền mặt thực tế</li>
          <li>🔁 Ca trước ({shiftLabel(previousShift)}) tổng ròng: <strong>₫{money(previousNet)}</strong></li>
          <li>🧮 Chênh lệch so với ca trước: <strong>₫{money(netRevenue - previousNet)}</strong></li>
          <li>❌ Nếu lệch, kiểm tra lại cột <strong>Ghi chú</strong> để tìm giao dịch điều chỉnh</li>
          <li>📝 Giữ lại chứng từ thu tiền để đối chiếu khi có sai lệch</li>
        </ul>
      </section>
    </div>
  );
}
