import { formatBeverageHistoryPayload, getBeverageActionLabel } from '../../../utils/beverageHistory';

export default function BeverageHistoryPanel({ item, rows, loading, onClose }) {
  if (!item) return null;
  return (
    <section className="beverage-card">
      <div className="beverage-section-heading">
        <div><p className="beverage-eyebrow">Audit log</p><h2>Lịch sử: {item.name}</h2></div>
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
      </div>
      {loading ? <div className="beverage-empty">Đang tải lịch sử...</div> : rows.length === 0 ? <div className="beverage-empty">Chưa có bản ghi chỉnh sửa.</div> : (
        <div className="beverage-table-wrap">
          <table className="beverage-table beverage-history-table">
            <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString('vi-VN')}</td><td>{row.actor_name || `User #${row.actor_id}`}</td><td>{getBeverageActionLabel(row.action)}</td><td>{formatBeverageHistoryPayload(row.payload)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
