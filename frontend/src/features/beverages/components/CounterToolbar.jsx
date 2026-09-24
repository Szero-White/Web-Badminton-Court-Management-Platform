const SHIFT_OPTIONS = [
  ['morning', 'Ca sáng'],
  ['afternoon', 'Ca chiều'],
  ['evening', 'Ca tối']
];

const PAYMENT_OPTIONS = [
  ['cash', 'Tiền mặt'],
  ['transfer', 'Chuyển khoản']
];

function MoneyStat({ label, value, highlight = false }) {
  return (
    <article className={highlight ? 'highlight-money' : undefined}>
      <span>{label}</span>
      <strong>{Number(value || 0).toLocaleString('vi-VN')} VND</strong>
    </article>
  );
}

export default function CounterToolbar({
  shift,
  setShift,
  paymentMethod,
  setPaymentMethod,
  restockPaymentMethod,
  setRestockPaymentMethod,
  keyword,
  setKeyword,
  lowStockOnly,
  setLowStockOnly,
  stats,
  summary,
  summaryLoading
}) {
  return (
    <div className="counter-toolbar split-layout">
      <div className="counter-toolbar-main">
        <div className="counter-toolbar-row">
          <label className="counter-label">
            Ca làm việc
            <select value={shift} onChange={(event) => setShift(event.target.value)}>
              {SHIFT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="counter-label">
            Thanh toán bán hàng
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {PAYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="counter-label">
            Thanh toán nhập hàng
            <select value={restockPaymentMethod} onChange={(event) => setRestockPaymentMethod(event.target.value)}>
              {PAYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="counter-label counter-grow">
            Tìm nhanh
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên nước hoặc mô tả" />
          </label>
          <label className="counter-check">
            <input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} />
            Chỉ hiển thị mặt hàng sắp hết
          </label>
        </div>

        <div className="counter-stats">
          <article><span>Tổng mặt hàng</span><strong>{stats.itemCount}</strong></article>
          <article><span>Sắp hết hàng</span><strong>{stats.lowStockCount}</strong></article>
          <MoneyStat label="Giá trị tồn kho" value={stats.totalStockValue} />
          <article><span>Đang hiển thị</span><strong>{stats.visibleCount}</strong></article>
          <MoneyStat label="Tiền bán đã chọn" value={stats.selectedSellTotal} highlight />
          <article><span>SL nhập đã chọn</span><strong>{stats.selectedRestockQtyTotal}</strong></article>
          <MoneyStat label="Chi phí nhập đã chọn" value={stats.selectedRestockCostTotal} />
        </div>
      </div>

      <aside className="shift-summary-panel">
        <div className="shift-summary-head">
          <div><span>Tổng kết ca</span><strong>{SHIFT_OPTIONS.find(([value]) => value === shift)?.[1] || shift}</strong></div>
          {summaryLoading ? <small>Đang cập nhật...</small> : null}
        </div>
        <div className="shift-summary-grid">
          <MoneyStat label="Doanh thu trong ca" value={summary.income} />
          <MoneyStat label="Tiền mặt" value={summary.cash} />
          <MoneyStat label="Chuyển khoản" value={summary.transfer} />
          <article><span>Hoàn tiền</span><strong>-{summary.refund.toLocaleString('vi-VN')} VND</strong></article>
          <article><span>Nhập hàng</span><strong>-{summary.stockInCost.toLocaleString('vi-VN')} VND</strong></article>
          <article className="summary-emphasis"><span>Số dư tiền mặt</span><strong>{summary.cashBalance.toLocaleString('vi-VN')} VND</strong></article>
        </div>
      </aside>
    </div>
  );
}
