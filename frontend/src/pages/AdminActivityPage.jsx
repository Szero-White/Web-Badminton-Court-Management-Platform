import { useEffect, useMemo, useState } from 'react';
import AppToast from '../components/feedback/AppToast';
import PageBackButton from '../components/navigation/PageBackButton';
import AppDatePicker from '../components/ui/AppDatePicker';
import AppSelect from '../components/ui/AppSelect';
import useAppNotice from '../hooks/useAppNotice';
import { adminApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrorMessage';
import './AdminActivityPage.css';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả nghiệp vụ' },
  { value: 'booking', label: 'Booking' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'beverage', label: 'Quầy / kho nước' },
  { value: 'finance', label: 'Thu chi' },
  { value: 'staff', label: 'Nhân sự' },
  { value: 'court', label: 'Sân / bảng giá' },
  { value: 'system', label: 'Hệ thống' }
];

const ACTION_LABELS = {
  booking_confirmed_at_counter: 'Tạo / xác nhận booking',
  booking_updated: 'Cập nhật booking',
  booking_group_rescheduled: 'Đổi lịch booking',
  booking_payment_adjusted: 'Điều chỉnh thanh toán',
  booking_payment_received: 'Thu tiền booking',
  booking_payment_deposit: 'Thu tiền / cọc',
  booking_payment_refund: 'Hoàn tiền booking',
  booking_canceled: 'Hủy booking',
  booking_checked_in: 'Check-in khách',
  beverage_update: 'Cập nhật mặt hàng',
  beverage_delete: 'Ngừng kinh doanh mặt hàng',
  beverage_adjust_stock_increase: 'Tăng tồn kho',
  beverage_adjust_stock_decrease: 'Giảm tồn kho',
  transaction_sale: 'Bán hàng / ghi nhận doanh thu',
  transaction_stock_in: 'Nhập hàng',
  transaction_refund: 'Hoàn tiền / chi hoàn',
  transaction_adjust: 'Điều chỉnh thu chi',
  transaction_owner_withdraw: 'Chủ rút tiền'
};

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value ?? '-');
  return `${amount.toLocaleString('vi-VN')} VND`;
}

function prettifyDetailKey(key) {
  const labels = {
    amount: 'Số tiền', method: 'Phương thức', payment_method: 'Phương thức', reference: 'Mã giao dịch',
    shift: 'Ca', reason: 'Lý do', refund_amount: 'Hoàn tiền', booking_code: 'Mã booking',
    old_payment_total: 'Đã thu trước', new_payment_total: 'Đã thu sau', payment_delta: 'Chênh lệch',
    delta: 'Chênh lệch', notes: 'Ghi chú', actor_role: 'Vai trò', business_date: 'Ngày nghiệp vụ'
  };
  return labels[key] || key.replaceAll('_', ' ');
}

function formatDetailValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (['amount', 'refund_amount', 'old_payment_total', 'new_payment_total', 'payment_delta', 'delta'].includes(key)) {
    return formatMoney(value);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ActivityDetails({ details }) {
  const entries = Object.entries(details || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  if (entries.length === 0) return <p className="activity-no-details">Không có dữ liệu chi tiết bổ sung.</p>;
  return <dl className="activity-details-grid">
    {entries.map(([key, value]) => <div key={key}><dt>{prettifyDetailKey(key)}</dt><dd>{formatDetailValue(key, value)}</dd></div>)}
  </dl>;
}

function ActivityRow({ entry }) {
  const [open, setOpen] = useState(false);
  const roleLabel = entry.actor_role === 'admin' ? 'Quản trị viên' : entry.actor_role === 'staff' ? 'Nhân viên' : entry.actor_role || 'Nội bộ';
  return <article className={`activity-card category-${entry.category || 'system'}`}>
    <button type="button" className="activity-card-main" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span className="activity-time">{formatDateTime(entry.created_at)}</span>
      <span className="activity-actor"><strong>{entry.actor_name || `Tài khoản #${entry.actor_id}`}</strong><small>{roleLabel} · ID #{entry.actor_id}</small></span>
      <span className="activity-action"><strong>{ACTION_LABELS[entry.action] || entry.summary || entry.action}</strong><small>{entry.summary || entry.target_type}</small></span>
      <span className="activity-target"><small>{entry.target_type || 'đối tượng'}</small><strong>{entry.target_id ? `#${entry.target_id}` : '-'}</strong></span>
      <span className="activity-expand" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open ? <div className="activity-card-details"><ActivityDetails details={entry.details} /></div> : null}
  </article>;
}

export default function AdminActivityPage() {
  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => { const value = new Date(); value.setDate(value.getDate() - 6); return value; }, []);
  const [staff, setStaff] = useState([]);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(toDateValue(weekAgo));
  const [to, setTo] = useState(toDateValue(today));
  const [actorId, setActorId] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { notice, error, clearNotice } = useAppNotice();

  const staffOptions = useMemo(() => [
    { value: '', label: 'Tất cả nhân viên / quản trị viên' },
    ...staff.map((member) => ({ value: String(member.id), label: `${member.full_name} · ${member.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}${member.deleted ? ' · Đã ngừng hoạt động' : ''}` }))
  ], [staff]);

  async function loadStaff() {
    try {
      const response = await adminApi.listActivityActors();
      setStaff(response.data?.data || []);
    } catch {
      // The activity feed still works; actor names are returned by the API.
    }
  }

  async function loadActivity() {
    setLoading(true);
    try {
      const response = await adminApi.listActivity({
        from, to,
        actor_id: actorId || undefined,
        category: category === 'all' ? undefined : category,
        q: appliedSearch || undefined,
        limit: 200,
        offset: 0
      });
      const data = response.data?.data || {};
      setEntries(data.entries || []);
      setTotal(Number(data.total || 0));
    } catch (requestError) {
      error(getApiErrorMessage(requestError, 'Không tải được nhật ký hoạt động.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { loadActivity(); }, [from, to, actorId, category, appliedSearch]);

  function submitSearch(event) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  function resetFilters() {
    setFrom(toDateValue(weekAgo));
    setTo(toDateValue(today));
    setActorId('');
    setCategory('all');
    setSearch('');
    setAppliedSearch('');
  }

  return <div className="admin-container admin-activity-page">
    <div className="activity-page-heading">
      <div><p className="activity-eyebrow">Kiểm soát nội bộ</p><h1>Nhật ký hoạt động</h1><p>Tra cứu ai đã thực hiện thao tác nào, lúc nào và trên dữ liệu nào. Nhật ký chỉ dành cho quản trị viên.</p></div>
      <div className="page-header-actions"><button type="button" className="btn-secondary" onClick={loadActivity} disabled={loading}>{loading ? 'Đang tải...' : 'Làm mới'}</button><PageBackButton to="/admin" label="Quay lại Tổng quan" /></div>
    </div>

    <AppToast message={notice} onDismiss={clearNotice} />

    <section className="activity-filter-card" aria-label="Bộ lọc nhật ký">
      <div className="activity-filter-grid">
        <label><span>Từ ngày</span><AppDatePicker value={from} onChange={setFrom} ariaLabel="Từ ngày" /></label>
        <label><span>Đến ngày</span><AppDatePicker value={to} onChange={setTo} ariaLabel="Đến ngày" /></label>
        <label><span>Người thực hiện</span><AppSelect value={actorId} onChange={setActorId} options={staffOptions} ariaLabel="Người thực hiện" /></label>
        <label><span>Nghiệp vụ</span><AppSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} ariaLabel="Nghiệp vụ" /></label>
      </div>
      <form className="activity-search-row" onSubmit={submitSearch}>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên nhân viên, hành động, ID booking/giao dịch..." />
        <button type="submit" className="btn-primary">Tìm kiếm</button>
        <button type="button" className="btn-secondary" onClick={resetFilters}>Đặt lại</button>
      </form>
    </section>

    <div className="activity-result-summary"><strong>{total.toLocaleString('vi-VN')}</strong><span>hoạt động phù hợp</span><small>Hiển thị tối đa 200 hoạt động gần nhất theo bộ lọc.</small></div>

    <section className="activity-list" aria-busy={loading}>
      {entries.length === 0 ? <div className="activity-empty">{loading ? 'Đang tải nhật ký...' : 'Không có hoạt động phù hợp với bộ lọc.'}</div> : entries.map((entry) => <ActivityRow key={entry.key} entry={entry} />)}
    </section>
  </div>;
}
