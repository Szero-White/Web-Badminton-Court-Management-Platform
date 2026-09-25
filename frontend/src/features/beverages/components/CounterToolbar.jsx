import AppSelect from '../../../components/ui/AppSelect';

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Ca sáng' },
  { value: 'afternoon', label: 'Ca chiều' },
  { value: 'evening', label: 'Ca tối' }
];

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' }
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
          <div className="counter-label">
            <span>Ca làm việc</span>
            <AppSelect value={shift} onChange={setShift} options={SHIFT_OPTIONS} ariaLabel="Ca làm việc" />
          </div>
          <div className="counter-label">
            <span>Thanh toán bán hàng</span>
            <AppSelect value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_OPTIONS} ariaLabel="Thanh toán bán hàng" />
          </div>
          <div className="counter-label">
            <span>Thanh toán nhập hàng</span>
            <AppSelect value={restockPaymentMethod} onChange={setRestockPaymentMethod} options={PAYMENT_OPTIONS} ariaLabel="Thanh toán nhập hàng" />
          </div>
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
          <div><span>Tổng kết ca</span><strong>{SHIFT_OPTIONS.find((option) => option.value === shift)?.label || shift}</strong></div>
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
