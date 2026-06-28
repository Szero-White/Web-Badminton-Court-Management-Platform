import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../services/api';
import './BeverageCounterPage.css';

function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

export default function BeverageCounterPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [shift, setShift] = useState(getCurrentShift());
  const [activeTab, setActiveTab] = useState('sell');
  const [shiftSummary, setShiftSummary] = useState(null);
  const [sellQty, setSellQty] = useState({});
  const [restockQty, setRestockQty] = useState({});
  const [restockCost, setRestockCost] = useState({});
  const [restockPaymentMethod, setRestockPaymentMethod] = useState('cash');
  const [keyword, setKeyword] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  async function loadStock() {
    setLoading(true);
    try {
      const res = await staffApi.listBeverageStock();
      setItems(res.data?.data || []);
      setMessage('Da tai bang nuoc uong.');
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Khong the tai danh sach nuoc.');
    } finally {
      setLoading(false);
    }
  }

  async function loadShiftSummary(nextShift = shift) {
    setSummaryLoading(true);
    try {
      const res = await staffApi.getShiftSummary(nextShift);
      setShiftSummary(res.data?.data || res.data || null);
    } catch {
      setShiftSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    loadShiftSummary(shift);
  }, [shift]);

  const totalStockValue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.stock || 0), 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const passKeyword = !kw || item.name?.toLowerCase().includes(kw) || item.description?.toLowerCase().includes(kw);
      const passLowStock = !lowStockOnly || Number(item.stock || 0) <= 5;
      return passKeyword && passLowStock;
    });
  }, [items, keyword, lowStockOnly]);

  const lowStockCount = useMemo(() => items.filter((item) => Number(item.stock || 0) <= 5).length, [items]);

  const selectedSellTotal = useMemo(
    () =>
      filteredItems.reduce((sum, item) => sum + Number(sellQty[item.id] || 0) * Number(item.price || 0), 0),
    [filteredItems, sellQty]
  );

  const selectedRestockQtyTotal = useMemo(
    () => filteredItems.reduce((sum, item) => sum + Number(restockQty[item.id] || 0), 0),
    [filteredItems, restockQty]
  );

  const selectedRestockCostTotal = useMemo(
    () => filteredItems.reduce((sum, item) => sum + Number(restockCost[item.id] || 0), 0),
    [filteredItems, restockCost]
  );

  const sellSummary = useMemo(() => ({
    income: Number(shiftSummary?.income || 0),
    cash: Number(shiftSummary?.cash || 0),
    transfer: Number(shiftSummary?.transfer || 0),
    refund: Number(shiftSummary?.refund || 0),
    stockInCost: Number(shiftSummary?.stock_in_cost || 0),
    ownerWithdraw: Number(shiftSummary?.owner_withdraw || 0),
    netRevenue: Number(shiftSummary?.net_revenue || shiftSummary?.total || 0),
    cashBalance: Number(shiftSummary?.cash_balance || 0)
  }), [shiftSummary]);

  function setQuickQty(setter, itemId, value) {
    setter((prev) => ({ ...prev, [itemId]: String(value) }));
  }

  function renderQuickButtons(item, setter, currentValue) {
    return (
      <div className="quick-qty-row">
        {[1, 2, 3].map((value) => (
          <button
            key={value}
            type="button"
            className={`quick-qty-btn ${Number(currentValue || 0) === value ? 'is-active' : ''}`}
            onClick={() => setQuickQty(setter, item.id, value)}
          >
            {value}
          </button>
        ))}
      </div>
    );
  }

  async function handleSell(item) {
    const qty = Number(sellQty[item.id] || 0);
    if (!qty || qty <= 0) {
      setMessage('So luong ban phai lon hon 0.');
      return;
    }

    try {
      await staffApi.sellBeverage({
        beverage_id: item.id,
        quantity: qty,
        payment_method: paymentMethod,
        shift
      });
      setMessage(`Da ban ${qty} ${item.unit} ${item.name} bang ${paymentMethod}.`);
      setSellQty((prev) => ({ ...prev, [item.id]: '' }));
      await loadStock();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Ban nuoc that bai.');
    }
  }

  async function handleRestock(item) {
    const qty = Number(restockQty[item.id] || 0);
    if (!qty || qty <= 0) {
      setMessage('So luong nhap phai lon hon 0.');
      return;
    }

    try {
      await staffApi.restockBeverage({
        beverage_id: item.id,
        quantity: qty,
        cost_amount: Number(restockCost[item.id] || 0),
        payment_method: restockPaymentMethod,
        shift
      });
      setMessage(`Da nhap them ${qty} ${item.unit} ${item.name}, chi phi ${Number(restockCost[item.id] || 0).toLocaleString('vi-VN')} VND.`);
      setRestockQty((prev) => ({ ...prev, [item.id]: '' }));
      setRestockCost((prev) => ({ ...prev, [item.id]: '' }));
      await loadStock();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Nhap kho that bai.');
    }
  }

  return (
    <section className="panel beverage-counter-page">
      <div className="panel-header beverage-counter-header">
        <div className="counter-title-block">
          <div>
            <h2>Bang Ban Nuoc Tai Quay</h2>
            <p>Ban tung loai nuoc, nhap kho nhanh, va tu dong luu giao dich theo cash/transfer.</p>
          </div>
          <div className="counter-tabs">
            <button type="button" className={activeTab === 'sell' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('sell')}>
              Ban nuoc
            </button>
            <button type="button" className={activeTab === 'restock' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('restock')}>
              Nhap hang
            </button>
          </div>
        </div>
        <Link to="/staff" className="counter-back-link">Quay lai trang nhan vien</Link>
      </div>

      <p className="message">{message}</p>

      <div className="counter-toolbar split-layout">
        <div className="counter-toolbar-main">
          <div className="counter-toolbar-row">
            <label className="counter-label">
              Ca
              <select value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="morning">morning</option>
                <option value="afternoon">afternoon</option>
                <option value="evening">evening</option>
              </select>
            </label>

            <label className="counter-label">
              Thanh toan mac dinh
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">cash</option>
                <option value="transfer">transfer</option>
              </select>
            </label>

            <label className="counter-label">
              Thanh toan nhap hang
              <select value={restockPaymentMethod} onChange={(e) => setRestockPaymentMethod(e.target.value)}>
                <option value="cash">cash</option>
                <option value="transfer">transfer</option>
              </select>
            </label>

            <label className="counter-label counter-grow">
              Tim nhanh
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ten nuoc hoac mo ta"
              />
            </label>

            <label className="counter-check">
              <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
              Chi hien thi sap het hang
            </label>
          </div>

          <div className="counter-stats">
            <article>
              <span>Tong mat hang</span>
              <strong>{items.length}</strong>
            </article>
            <article>
              <span>Sap het hang</span>
              <strong>{lowStockCount}</strong>
            </article>
            <article>
              <span>Gia tri ton kho</span>
              <strong>{totalStockValue.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Dang hien thi</span>
              <strong>{filteredItems.length}</strong>
            </article>
            <article className="highlight-money">
              <span>Tong tien ban da chon</span>
              <strong>{selectedSellTotal.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Tong SL nhap da chon</span>
              <strong>{selectedRestockQtyTotal}</strong>
            </article>
            <article>
              <span>Tong chi phi nhap</span>
              <strong>{selectedRestockCostTotal.toLocaleString('vi-VN')} VND</strong>
            </article>
          </div>
        </div>

        <aside className="shift-summary-panel">
          <div className="shift-summary-head">
            <div>
              <span>Bang tong ket ca</span>
              <strong>{shift}</strong>
            </div>
            {summaryLoading ? <small>Dang cap nhat...</small> : null}
          </div>

          <div className="shift-summary-grid">
            <article>
              <span>Doanh thu trong ca</span>
              <strong>{sellSummary.income.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Tien mat</span>
              <strong>{sellSummary.cash.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Chuyen khoan</span>
              <strong>{sellSummary.transfer.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Hoan tien</span>
              <strong>-{sellSummary.refund.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article>
              <span>Nhap hang</span>
              <strong>-{sellSummary.stockInCost.toLocaleString('vi-VN')} VND</strong>
            </article>
            <article className="summary-emphasis">
              <span>So du tien mat</span>
              <strong>{sellSummary.cashBalance.toLocaleString('vi-VN')} VND</strong>
            </article>
          </div>
        </aside>
      </div>

      <div className="form-card counter-table-shell">
        <div className="counter-table-header">
          <div>
            <h3>{activeTab === 'sell' ? 'Ban nuoc' : 'Nhap hang'} ({filteredItems.length})</h3>
            <p>
              {activeTab === 'sell'
                ? 'Chon so luong nhanh bang nut 1/2/3, cot Tong tien ban se tu tinh ngay.'
                : 'Nhap so luong va chi phi de ghi nhan hang moi nhap ve.'}
            </p>
          </div>
        </div>
        <table className="counter-table">
          <thead>
            <tr>
              <th>Ten</th>
              <th className="align-right">Gia ban</th>
              <th className="align-right">Ton</th>
              {activeTab === 'sell' ? <th className="align-right">Tong tien ban</th> : <th className="align-right">Tong chi phi nhap</th>}
              {activeTab === 'sell' ? <th>So luong ban</th> : <th>So luong nhap</th>}
              <th>{activeTab === 'sell' ? 'Ban' : 'Nhap hang'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <div className="item-desc">{item.description || '-'}</div>
                </td>
                <td className="align-right">{Number(item.price || 0).toLocaleString('vi-VN')}</td>
                <td className={`align-right ${item.stock <= 5 ? 'stock-low' : ''}`}>
                  {item.stock} {item.unit}
                </td>
                {activeTab === 'sell' ? (
                  <>
                    <td className="align-right">
                      {((Number(sellQty[item.id] || 0) || 0) * Number(item.price || 0)).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <div className="row-action">
                        <div className="quick-qty-stack">
                          {renderQuickButtons(item, setSellQty, sellQty[item.id])}
                          <input
                            type="number"
                            min="1"
                            placeholder="So luong"
                            value={sellQty[item.id] || ''}
                            onChange={(e) => setSellQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="qty-input"
                          />
                        </div>
                        <button type="button" onClick={() => handleSell(item)} disabled={Number(item.stock || 0) <= 0}>
                          Ban
                        </button>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="tab-inline-btn" onClick={() => setActiveTab('restock')}>
                        Chuyen sang nhap
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="align-right">
                      {Number(restockCost[item.id] || 0).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <div className="row-action">
                        <div className="quick-qty-stack">
                          {renderQuickButtons(item, setRestockQty, restockQty[item.id])}
                          <input
                            type="number"
                            min="1"
                            placeholder="So luong"
                            value={restockQty[item.id] || ''}
                            onChange={(e) => setRestockQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="qty-input"
                          />
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="Chi phi"
                          value={restockCost[item.id] || ''}
                          onChange={(e) => setRestockCost((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="qty-input"
                        />
                        <button type="button" onClick={() => handleRestock(item)}>
                          Nhap
                        </button>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="tab-inline-btn" onClick={() => setActiveTab('sell')}>
                        Chuyen sang ban
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filteredItems.length === 0 ? <p>Khong co mat hang phu hop bo loc hien tai.</p> : null}
      </div>
    </section>
  );
}
