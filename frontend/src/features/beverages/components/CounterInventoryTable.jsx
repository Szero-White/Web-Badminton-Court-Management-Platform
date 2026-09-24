function QuickQuantity({ value, onChange }) {
  return (
    <div className="quick-qty-stack">
      <div className="quick-qty-row">
        {[1, 2, 3].map((quantity) => (
          <button
            key={quantity}
            type="button"
            className={`quick-qty-btn ${Number(value || 0) === quantity ? 'is-active' : ''}`}
            onClick={() => onChange(String(quantity))}
          >
            {quantity}
          </button>
        ))}
      </div>
      <input type="number" min="1" placeholder="Số lượng" value={value || ''} onChange={(event) => onChange(event.target.value)} className="qty-input" />
    </div>
  );
}

export default function CounterInventoryTable({
  activeTab,
  setActiveTab,
  items,
  loading,
  sellQty,
  setSellQty,
  restockQty,
  setRestockQty,
  restockCost,
  setRestockCost,
  onSell,
  onRestock
}) {
  const selling = activeTab === 'sell';
  const setItemValue = (setter, itemId, value) => setter((current) => ({ ...current, [itemId]: value }));

  return (
    <div className="form-card counter-table-shell">
      <div className="counter-table-header">
        <div>
          <h3>{selling ? 'Bán nước' : 'Nhập hàng'} ({items.length})</h3>
          <p>{selling ? 'Chọn nhanh số lượng 1/2/3 hoặc nhập trực tiếp; tổng tiền được tính ngay.' : 'Nhập số lượng và tổng chi phí của lô hàng vừa nhận.'}</p>
        </div>
      </div>

      <div className="counter-table-scroll">
        <table className="counter-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th className="align-right">Giá bán</th>
              <th className="align-right">Tồn kho</th>
              <th className="align-right">{selling ? 'Tổng tiền bán' : 'Chi phí nhập'}</th>
              <th>{selling ? 'Số lượng bán' : 'Số lượng nhập'}</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong><div className="item-desc">{item.description || '-'}</div></td>
                <td className="align-right">{Number(item.price || 0).toLocaleString('vi-VN')}</td>
                <td className={`align-right ${Number(item.stock || 0) <= 5 ? 'stock-low' : ''}`}>{item.stock} {item.unit}</td>
                {selling ? (
                  <>
                    <td className="align-right">{(Number(sellQty[item.id] || 0) * Number(item.price || 0)).toLocaleString('vi-VN')}</td>
                    <td><QuickQuantity value={sellQty[item.id]} onChange={(value) => setItemValue(setSellQty, item.id, value)} /></td>
                    <td>
                      <div className="row-action">
                        <button type="button" onClick={() => onSell(item)} disabled={Number(item.stock || 0) <= 0}>Bán</button>
                        <button type="button" className="tab-inline-btn" onClick={() => setActiveTab('restock')}>Sang nhập hàng</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="align-right">{Number(restockCost[item.id] || 0).toLocaleString('vi-VN')}</td>
                    <td>
                      <div className="row-action">
                        <QuickQuantity value={restockQty[item.id]} onChange={(value) => setItemValue(setRestockQty, item.id, value)} />
                        <input type="number" min="0" placeholder="Chi phí" value={restockCost[item.id] || ''} onChange={(event) => setItemValue(setRestockCost, item.id, event.target.value)} className="qty-input" />
                      </div>
                    </td>
                    <td>
                      <div className="row-action">
                        <button type="button" onClick={() => onRestock(item)}>Nhập</button>
                        <button type="button" className="tab-inline-btn" onClick={() => setActiveTab('sell')}>Sang bán hàng</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && items.length === 0 ? <p>Không có mặt hàng phù hợp bộ lọc hiện tại.</p> : null}
    </div>
  );
}
