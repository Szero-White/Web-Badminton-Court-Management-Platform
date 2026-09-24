import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CounterInventoryTable from '../features/beverages/components/CounterInventoryTable';
import CounterToolbar from '../features/beverages/components/CounterToolbar';
import { staffApi } from '../services/api';
import { getShiftName } from '../utils/shift';
import './BeverageCounterPage.css';
import './BeverageCounterSummary.css';

function apiError(error, fallback) {
  return error?.response?.data?.error?.message || fallback;
}

export default function BeverageCounterPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [restockPaymentMethod, setRestockPaymentMethod] = useState('cash');
  const [shift, setShift] = useState(getShiftName());
  const [activeTab, setActiveTab] = useState('sell');
  const [shiftSummary, setShiftSummary] = useState(null);
  const [sellQty, setSellQty] = useState({});
  const [restockQty, setRestockQty] = useState({});
  const [restockCost, setRestockCost] = useState({});
  const [keyword, setKeyword] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  async function loadStock({ announce = false } = {}) {
    setLoading(true);
    try {
      const response = await staffApi.listBeverageStock();
      setItems(response.data?.data || []);
      if (announce) setMessage('Đã cập nhật bảng nước uống.');
    } catch (error) {
      setMessage(apiError(error, 'Không thể tải danh sách nước uống.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadShiftSummary(nextShift) {
    setSummaryLoading(true);
    try {
      const response = await staffApi.getShiftSummary(nextShift);
      setShiftSummary(response.data?.data || response.data || null);
    } catch {
      setShiftSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => { loadStock(); }, []);
  useEffect(() => { loadShiftSummary(shift); }, [shift]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const textMatches = !normalizedKeyword || item.name?.toLowerCase().includes(normalizedKeyword) || item.description?.toLowerCase().includes(normalizedKeyword);
      const stockMatches = !lowStockOnly || Number(item.stock || 0) <= 5;
      return textMatches && stockMatches;
    });
  }, [items, keyword, lowStockOnly]);

  const stats = useMemo(() => ({
    itemCount: items.length,
    lowStockCount: items.filter((item) => Number(item.stock || 0) <= 5).length,
    totalStockValue: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.stock || 0), 0),
    visibleCount: filteredItems.length,
    selectedSellTotal: filteredItems.reduce((sum, item) => sum + Number(sellQty[item.id] || 0) * Number(item.price || 0), 0),
    selectedRestockQtyTotal: filteredItems.reduce((sum, item) => sum + Number(restockQty[item.id] || 0), 0),
    selectedRestockCostTotal: filteredItems.reduce((sum, item) => sum + Number(restockCost[item.id] || 0), 0)
  }), [items, filteredItems, sellQty, restockQty, restockCost]);

  const summary = useMemo(() => ({
    income: Number(shiftSummary?.income || 0),
    cash: Number(shiftSummary?.cash || 0),
    transfer: Number(shiftSummary?.transfer || 0),
    refund: Number(shiftSummary?.refund || 0),
    stockInCost: Number(shiftSummary?.stock_in_cost || 0),
    cashBalance: Number(shiftSummary?.cash_balance || 0)
  }), [shiftSummary]);

  async function handleSell(item) {
    const quantity = Number(sellQty[item.id] || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage('Số lượng bán phải là số nguyên lớn hơn 0.');
      return;
    }
    if (quantity > Number(item.stock || 0)) {
      setMessage(`Tồn kho ${item.name} không đủ để bán ${quantity} ${item.unit}.`);
      return;
    }

    try {
      await staffApi.sellBeverage({ beverage_id: item.id, quantity, payment_method: paymentMethod, shift });
      setMessage(`Đã bán ${quantity} ${item.unit} ${item.name}.`);
      setSellQty((current) => ({ ...current, [item.id]: '' }));
      await Promise.all([loadStock(), loadShiftSummary(shift)]);
    } catch (error) {
      setMessage(apiError(error, 'Bán nước thất bại.'));
    }
  }

  async function handleRestock(item) {
    const quantity = Number(restockQty[item.id] || 0);
    const costAmount = Number(restockCost[item.id] || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage('Số lượng nhập phải là số nguyên lớn hơn 0.');
      return;
    }
    if (!Number.isFinite(costAmount) || costAmount < 0) {
      setMessage('Chi phí nhập hàng không hợp lệ.');
      return;
    }

    try {
      await staffApi.restockBeverage({ beverage_id: item.id, quantity, cost_amount: Math.round(costAmount), payment_method: restockPaymentMethod, shift });
      setMessage(`Đã nhập ${quantity} ${item.unit} ${item.name}.`);
      setRestockQty((current) => ({ ...current, [item.id]: '' }));
      setRestockCost((current) => ({ ...current, [item.id]: '' }));
      await Promise.all([loadStock(), loadShiftSummary(shift)]);
    } catch (error) {
      setMessage(apiError(error, 'Nhập kho thất bại.'));
    }
  }

  return (
    <section className="panel beverage-counter-page">
      <div className="panel-header beverage-counter-header">
        <div className="counter-title-block">
          <div><h2>Quầy bán nước</h2><p>Bán hàng, nhập kho và đối soát giao dịch theo từng ca làm việc.</p></div>
          <div className="counter-tabs">
            <button type="button" className={activeTab === 'sell' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('sell')}>Bán nước</button>
            <button type="button" className={activeTab === 'restock' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('restock')}>Nhập hàng</button>
          </div>
        </div>
        <div className="counter-header-actions">
          <button type="button" className="btn-secondary" onClick={() => loadStock({ announce: true })} disabled={loading}>{loading ? 'Đang tải...' : 'Làm mới'}</button>
          <Link to="/staff" className="counter-back-link">Quay lại trang nhân viên</Link>
        </div>
      </div>

      {message ? <p className="message" role="status">{message}</p> : null}

      <CounterToolbar
        shift={shift}
        setShift={setShift}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        restockPaymentMethod={restockPaymentMethod}
        setRestockPaymentMethod={setRestockPaymentMethod}
        keyword={keyword}
        setKeyword={setKeyword}
        lowStockOnly={lowStockOnly}
        setLowStockOnly={setLowStockOnly}
        stats={stats}
        summary={summary}
        summaryLoading={summaryLoading}
      />

      <CounterInventoryTable
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        items={filteredItems}
        loading={loading}
        sellQty={sellQty}
        setSellQty={setSellQty}
        restockQty={restockQty}
        setRestockQty={setRestockQty}
        restockCost={restockCost}
        setRestockCost={setRestockCost}
        onSell={handleSell}
        onRestock={handleRestock}
      />
    </section>
  );
}
