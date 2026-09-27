import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../ui/AppSelect';
import { adminApi } from '../../services/api';

const WEEKDAYS = [
  { bit: 1 << 0, short: 'T2', label: 'Thứ 2' },
  { bit: 1 << 1, short: 'T3', label: 'Thứ 3' },
  { bit: 1 << 2, short: 'T4', label: 'Thứ 4' },
  { bit: 1 << 3, short: 'T5', label: 'Thứ 5' },
  { bit: 1 << 4, short: 'T6', label: 'Thứ 6' },
  { bit: 1 << 5, short: 'T7', label: 'Thứ 7' },
  { bit: 1 << 6, short: 'CN', label: 'Chủ nhật' }
];

const DEFAULT_FORM = {
  name: '',
  days_mask: 31,
  start_time: '06:00',
  end_time: '17:00',
  price: 80000,
  priority: 100,
  effective_from: '',
  effective_to: '',
  is_active: true
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function dayMaskLabel(mask) {
  if (mask === 127) return 'Tất cả các ngày';
  if (mask === 31) return 'Thứ 2 - Thứ 6';
  if (mask === 96) return 'Thứ 7 - Chủ nhật';
  return WEEKDAYS.filter((day) => mask & day.bit).map((day) => day.short).join(', ');
}

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function CourtPricingRulesPanel({ courts, onMessage }) {
  const activeCourts = useMemo(() => courts.filter((court) => court.is_active), [courts]);
  const [courtId, setCourtId] = useState('');
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  const selectedCourt = activeCourts.find((court) => String(court.id) === String(courtId));

  useEffect(() => {
    if (!courtId && activeCourts.length) {
      setCourtId(String(activeCourts[0].id));
    }
  }, [activeCourts, courtId]);

  useEffect(() => {
    if (!courtId) {
      setRules([]);
      return;
    }
    loadRules(courtId);
  }, [courtId]);

  async function loadRules(id) {
    setLoading(true);
    try {
      const response = await adminApi.listCourtPriceRules(id);
      setRules(response.data?.data || []);
    } catch (error) {
      onMessage?.(error?.response?.data?.error?.message || 'Không thể tải bảng giá.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingRule(null);
    setForm({
      ...DEFAULT_FORM,
      price: Number(selectedCourt?.base_price || DEFAULT_FORM.price)
    });
  }

  function startEdit(rule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      days_mask: Number(rule.days_mask),
      start_time: rule.start_time,
      end_time: rule.end_time,
      price: Number(rule.price),
      priority: Number(rule.priority),
      effective_from: toDateInput(rule.effective_from),
      effective_to: toDateInput(rule.effective_to),
      is_active: Boolean(rule.is_active)
    });
  }

  function toggleDay(bit) {
    setForm((current) => ({
      ...current,
      days_mask: current.days_mask & bit ? current.days_mask & ~bit : current.days_mask | bit
    }));
  }

  function applyPreset(mask) {
    setForm((current) => ({ ...current, days_mask: mask }));
  }

  function payloadFromForm() {
    return {
      name: form.name.trim(),
      days_mask: Number(form.days_mask),
      start_time: form.start_time,
      end_time: form.end_time,
      price: Math.max(0, Number(form.price || 0)),
      priority: Math.max(0, Number(form.priority || 100)),
      effective_from: form.effective_from || '',
      effective_to: form.effective_to || '',
      is_active: Boolean(form.is_active)
    };
  }

  async function saveRule(event) {
    event.preventDefault();
    if (!courtId) return;
    if (!form.days_mask) {
      onMessage?.('Hãy chọn ít nhất một ngày áp dụng.');
      return;
    }
    try {
      if (editingRule) {
        await adminApi.updateCourtPriceRule(editingRule.id, payloadFromForm());
        onMessage?.('✓ Đã cập nhật khung giá. Slot trống tương lai được đồng bộ lại; booking cũ giữ nguyên giá.');
      } else {
        await adminApi.createCourtPriceRule(courtId, payloadFromForm());
        onMessage?.('✓ Đã thêm khung giá mới.');
      }
      resetForm();
      await loadRules(courtId);
    } catch (error) {
      onMessage?.(error?.response?.data?.error?.message || 'Không thể lưu khung giá.');
    }
  }

  async function removeRule(rule) {
    if (!window.confirm(`Xóa khung giá "${rule.name}"? Booking đã tạo sẽ không bị thay đổi.`)) return;
    try {
      await adminApi.deleteCourtPriceRule(rule.id);
      if (editingRule?.id === rule.id) resetForm();
      onMessage?.('✓ Đã xóa khung giá và đồng bộ lại các slot trống tương lai.');
      await loadRules(courtId);
    } catch (error) {
      onMessage?.(error?.response?.data?.error?.message || 'Không thể xóa khung giá.');
    }
  }

  const courtOptions = activeCourts.map((court) => ({
    value: court.id,
    label: court.name,
    description: `Giá cơ bản ${formatMoney(court.base_price)} VND`
  }));

  return (
    <section className="pricing-rules-card">
      <div className="pricing-rules-heading">
        <div>
          <span className="pricing-rules-eyebrow">PRICING ENGINE</span>
          <h3>Cấu hình bảng giá theo khung giờ</h3>
          <p>
            Giá cơ bản là mức dự phòng. Khung giá phù hợp có ưu tiên cao nhất sẽ được áp dụng cho slot trống;
            booking đã tạo luôn giữ nguyên giá lịch sử.
          </p>
        </div>
        <div className="pricing-rules-court-select">
          <span>Sân áp dụng</span>
          <AppSelect
            value={courtId}
            onChange={(value) => {
              setCourtId(value);
              setEditingRule(null);
              const court = activeCourts.find((item) => String(item.id) === String(value));
              setForm({ ...DEFAULT_FORM, price: Number(court?.base_price || DEFAULT_FORM.price) });
            }}
            options={courtOptions}
            placeholder="Chọn sân"
            ariaLabel="Chọn sân để cấu hình bảng giá"
          />
        </div>
      </div>

      {selectedCourt ? (
        <div className="pricing-base-note">
          <strong>{selectedCourt.name}</strong>
          <span>Giá cơ bản: {formatMoney(selectedCourt.base_price)} VND / 30 phút</span>
          <span>Giờ hoạt động: {selectedCourt.open_time} - {selectedCourt.close_time}</span>
        </div>
      ) : null}

      <div className="pricing-rules-layout">
        <form className="pricing-rule-form" onSubmit={saveRule}>
          <div className="pricing-form-title">
            <div>
              <strong>{editingRule ? 'Chỉnh sửa khung giá' : 'Thêm khung giá'}</strong>
              <small>Không cho phép hai rule cùng priority chồng lấn cùng ngày/giờ.</small>
            </div>
            {editingRule ? <button type="button" className="pricing-link-button" onClick={resetForm}>Tạo mới</button> : null}
          </div>

          <label className="court-field">
            Tên khung giá
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="VD: Cao điểm buổi tối" required />
          </label>

          <div className="pricing-day-presets">
            <button type="button" className={form.days_mask === 31 ? 'is-active' : ''} onClick={() => applyPreset(31)}>T2 - T6</button>
            <button type="button" className={form.days_mask === 96 ? 'is-active' : ''} onClick={() => applyPreset(96)}>T7 - CN</button>
            <button type="button" className={form.days_mask === 127 ? 'is-active' : ''} onClick={() => applyPreset(127)}>Cả tuần</button>
          </div>

          <div className="pricing-weekdays" aria-label="Ngày áp dụng">
            {WEEKDAYS.map((day) => (
              <button key={day.bit} type="button" className={form.days_mask & day.bit ? 'is-selected' : ''} aria-pressed={Boolean(form.days_mask & day.bit)} onClick={() => toggleDay(day.bit)} title={day.label}>
                {day.short}
              </button>
            ))}
          </div>

          <div className="pricing-form-grid">
            <label className="court-field">Từ giờ<input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} required /></label>
            <label className="court-field">Đến giờ<input type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} required /></label>
            <label className="court-field">Giá / 30 phút<input type="number" min="0" step="1000" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
            <label className="court-field">Priority<input type="number" min="0" max="10000" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></label>
            <label className="court-field">Hiệu lực từ<input type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></label>
            <label className="court-field">Hiệu lực đến<input type="date" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></label>
          </div>

          <label className="court-check pricing-active-check">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            Đang áp dụng
          </label>

          <div className="pricing-priority-help"><strong>Priority:</strong> 100 cho bảng giá thường, 200+ cho rule đặc biệt/ngày lễ. Khi nhiều rule cùng khớp, priority cao hơn thắng.</div>

          <div className="court-actions">
            <button type="submit" disabled={!courtId}>{editingRule ? 'Lưu khung giá' : 'Thêm khung giá'}</button>
            {editingRule ? <button type="button" className="court-cancel-btn" onClick={resetForm}>Hủy chỉnh sửa</button> : null}
          </div>
        </form>

        <div className="pricing-rule-list">
          <div className="pricing-list-title"><div><strong>Bảng giá hiện tại</strong><small>{loading ? 'Đang tải...' : `${rules.length} rule`}</small></div></div>
          {rules.length ? rules.map((rule) => (
            <article key={rule.id} className={`pricing-rule-item ${rule.is_active ? '' : 'is-inactive'}`.trim()}>
              <div className="pricing-rule-main">
                <div className="pricing-rule-name"><strong>{rule.name}</strong><span className={`pricing-rule-state ${rule.is_active ? 'active' : ''}`}>{rule.is_active ? 'Đang áp dụng' : 'Tạm tắt'}</span></div>
                <div className="pricing-rule-meta"><span>{dayMaskLabel(Number(rule.days_mask))}</span><span>{rule.start_time} - {rule.end_time}</span><span>Priority {rule.priority}</span></div>
                <div className="pricing-rule-price">{formatMoney(rule.price)} <small>VND / 30 phút</small></div>
                {(rule.effective_from || rule.effective_to) ? <small className="pricing-rule-effective">Hiệu lực: {toDateInput(rule.effective_from) || 'không giới hạn'} → {toDateInput(rule.effective_to) || 'không giới hạn'}</small> : null}
              </div>
              <div className="pricing-rule-actions"><button type="button" onClick={() => startEdit(rule)}>Sửa</button><button type="button" className="danger" onClick={() => removeRule(rule)}>Xóa</button></div>
            </article>
          )) : (
            <div className="pricing-empty-state"><strong>Chưa có khung giá riêng</strong><span>Hệ thống đang dùng giá cơ bản của sân cho mọi khung giờ.</span></div>
          )}
        </div>
      </div>
    </section>
  );
}
