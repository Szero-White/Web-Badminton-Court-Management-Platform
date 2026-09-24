function stockLabel(stock) {
  if (stock <= 0) return ['Hết hàng', 'is-empty'];
  if (stock <= 10) return ['Sắp hết', 'is-low'];
  return ['Còn hàng', 'is-ready'];
}

export default function BeverageInventoryTable({ beverages, loading, onEdit, onDelete, onHistory }) {
  return (
    <section className="beverage-card">
      <div className="beverage-section-heading">
        <div><p className="beverage-eyebrow">Kho hiện tại</p><h2>Danh sách mặt hàng ({beverages.length})</h2></div>
      </div>
      {beverages.length === 0 ? <div className="beverage-empty">{loading ? 'Đang tải dữ liệu...' : 'Chưa có mặt hàng nào.'}</div> : (
        <div className="beverage-table-wrap">
          <table className="beverage-table">
            <thead><tr><th>Mặt hàng</th><th>Giá</th><th>Tồn kho</th><th>Đơn vị</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
            <tbody>
              {beverages.map((item) => {
                const [label, statusClass] = stockLabel(Number(item.stock || 0));
                return (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong><small>{item.description || 'Không có mô tả'}</small></td>
                    <td>{Number(item.price || 0).toLocaleString('vi-VN')} VND</td>
                    <td>{item.stock}</td>
                    <td>{item.unit || '-'}</td>
                    <td><span className={`beverage-stock-status ${statusClass}`}>{label}</span></td>
                    <td><div className="beverage-row-actions"><button type="button" className="btn-secondary" onClick={() => onEdit(item)}>Sửa</button><button type="button" className="btn-secondary" onClick={() => onHistory(item)}>Lịch sử</button><button type="button" className="btn-danger" onClick={() => onDelete(item)}>Xóa</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
