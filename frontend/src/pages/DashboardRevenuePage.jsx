import { useEffect, useMemo, useState } from 'react';
import AppToast from '../components/feedback/AppToast';
import PageBackButton from '../components/navigation/PageBackButton';
import AppDatePicker from '../components/ui/AppDatePicker';
import { adminApi, dashboardApi } from '../services/api';
import useAppNotice from '../hooks/useAppNotice';
import './DashboardRevenuePage.css';

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const value = new Date(date);
  const weekday = value.getDay() || 7;
  value.setDate(value.getDate() - weekday + 1);
  return value;
}

function presetRange(preset) {
  const now = new Date();
  if (preset === 'week') return { from: localDateString(startOfWeek(now)), to: localDateString(now) };
  if (preset === 'month') return { from: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDateString(now) };
  if (preset === 'year') return { from: localDateString(new Date(now.getFullYear(), 0, 1)), to: localDateString(now) };
  return { from: localDateString(now), to: localDateString(now) };
}

function money(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

export default function DashboardRevenuePage() {
  const [preset, setPreset] = useState('day');
  const initialRange = presetRange('day');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState(null);
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(false);
  const { notice: message, setNotice: setMessage, clearNotice } = useAppNotice();
  const [tone, setTone] = useState('success');

  function applyPreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      const range = presetRange(nextPreset);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [summaryResponse, beverageResponse] = await Promise.all([
        dashboardApi.summary({ from, to }),
        adminApi.listBeverages()
      ]);
      setSummary(summaryResponse?.data?.data || null);
      setBeverages(beverageResponse?.data?.data || []);
      setMessage('');
    } catch (error) {
      setTone('error');
      setMessage(error?.response?.data?.error?.message || 'Không tải được báo cáo vận hành.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [from, to]);

  const inventory = useMemo(() => ({
    quantity: beverages.reduce((sum, item) => sum + Number(item.stock || 0), 0),
    value: beverages.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.price || 0), 0)
  }), [beverages]);

  const cards = summary ? [
    ['Tổng thu', summary.gross_income, 'Tiền sân + bán nước'],
    ['Thu tiền sân', summary.booking_income, `Giá trị booking: ${money(summary.booked_value)} đ`],
    ['Bán nước', summary.beverage_income, 'Doanh thu quầy nước'],
    ['Doanh thu ròng', summary.net_revenue, 'Sau hoàn tiền và nhập hàng'],
    ['Tiền mặt', summary.cash_income, `Số dư quỹ: ${money(summary.cash_balance)} đ`],
    ['Chuyển khoản', summary.transfer_income, 'Thu qua chuyển khoản'],
    ['Còn phải thu', summary.outstanding_due, 'Booking chưa thanh toán đủ'],
    ['Chi phí nhập hàng', -Number(summary.stock_in_cost || 0), `Chủ đã rút: ${money(summary.owner_withdraw)} đ`]
  ] : [];

  return (
    <section className="operations-report-page">
      <header className="operations-report-header">
        <div>
          <span className="operations-report-eyebrow">Báo cáo vận hành</span>
          <h1>Doanh thu & hiệu suất sân</h1>
          <p>Theo dõi tiền sân, bán nước, công nợ và hiệu suất sử dụng trong cùng một báo cáo.</p>
        </div>
        <PageBackButton to="/admin" label="Quay lại Tổng quan" />
      </header>

      <div className="operations-report-toolbar">
        <div className="operations-report-presets" role="group" aria-label="Khoảng báo cáo nhanh">
          {[
            ['day', 'Hôm nay'],
            ['week', 'Tuần này'],
            ['month', 'Tháng này'],
            ['year', 'Năm nay'],
            ['custom', 'Tùy chọn']
          ].map(([value, label]) => (
            <button key={value} type="button" className={preset === value ? 'is-active' : ''} onClick={() => applyPreset(value)}>{label}</button>
          ))}
        </div>
        <div className="operations-report-dates">
          <label>Từ ngày<AppDatePicker value={from} onChange={(value) => { setPreset('custom'); setFrom(value); }} ariaLabel="Ngày bắt đầu báo cáo" /></label>
          <label>Đến ngày<AppDatePicker value={to} onChange={(value) => { setPreset('custom'); setTo(value); }} ariaLabel="Ngày kết thúc báo cáo" /></label>
          <button type="button" onClick={loadData} disabled={loading}>{loading ? 'Đang tải…' : 'Làm mới'}</button>
        </div>
      </div>

      <AppToast message={message} tone={tone} onDismiss={clearNotice} />

      {summary ? (
        <>
          <div className="operations-report-metrics">
            {cards.map(([label, value, detail]) => (
              <article key={label} className="operations-report-card">
                <span>{label}</span>
                <strong className={Number(value) < 0 ? 'is-negative' : ''}>{Number(value) < 0 ? '-' : ''}{money(Math.abs(Number(value || 0)))} đ</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="operations-report-kpis">
            <article><span>Tỷ lệ lấp đầy</span><strong>{Number(summary.occupancy_rate || 0).toFixed(1)}%</strong><small>{summary.booked_slots || 0} / {summary.total_slots || 0} khung giờ</small></article>
            <article><span>Slot đã đặt</span><strong>{summary.booked_slots || 0}</strong><small>{summary.canceled_slots || 0} slot hủy/no-show</small></article>
            <article><span>Tồn kho nước</span><strong>{inventory.quantity}</strong><small>{money(inventory.value)} đ giá trị bán hiện tại</small></article>
            <article><span>Hoàn tiền</span><strong>{money(summary.refunds)} đ</strong><small>Booking + giao dịch quầy</small></article>
          </div>

          <div className="operations-report-grid">
            <section className="operations-report-section">
              <div className="operations-report-section-title">
                <div><span>Hiệu suất theo sân</span><h2>Doanh thu đặt sân</h2></div>
              </div>
              <div className="operations-report-table-wrap">
                <table>
                  <thead><tr><th>Sân</th><th>Slot đã đặt</th><th>Giá trị booking</th><th>Còn phải thu</th></tr></thead>
                  <tbody>
                    {(summary.court_breakdown || []).map((court) => (
                      <tr key={court.court_id}>
                        <td><strong>{court.court_name}</strong></td>
                        <td>{court.booked_slots}</td>
                        <td>{money(court.booked_value)} đ</td>
                        <td className={Number(court.outstanding_due) > 0 ? 'is-warning' : ''}>{money(court.outstanding_due)} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="operations-report-section">
              <div className="operations-report-section-title">
                <div><span>Đối soát</span><h2>Dòng tiền</h2></div>
              </div>
              <dl className="operations-report-ledger">
                <div><dt>Tổng thu</dt><dd>{money(summary.gross_income)} đ</dd></div>
                <div><dt>Hoàn tiền</dt><dd>-{money(summary.refunds)} đ</dd></div>
                <div><dt>Nhập hàng</dt><dd>-{money(summary.stock_in_cost)} đ</dd></div>
                <div><dt>Doanh thu ròng</dt><dd><strong>{money(summary.net_revenue)} đ</strong></dd></div>
                <div><dt>Chủ rút tiền</dt><dd>-{money(summary.owner_withdraw)} đ</dd></div>
                <div className="is-total"><dt>Số dư tiền mặt</dt><dd>{money(summary.cash_balance)} đ</dd></div>
              </dl>
            </section>
          </div>
        </>
      ) : loading ? <div className="operations-report-loading">Đang tổng hợp báo cáo…</div> : null}
    </section>
  );
}
