import { useEffect, useMemo, useRef } from 'react';
import AppSelect from '../ui/AppSelect';
import { formatTime } from '../../utils/dateTime';

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'walk_in', label: 'Khách vãng lai' },
  { value: 'monthly', label: 'Khách cố định theo tháng' }
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'cash', label: 'Tiền mặt' }
];

export default function BookingCreateModal({
  open,
  title,
  selectedSlot,
  day,
  endSlots,
  form,
  setForm,
  loading,
  onSubmit,
  onClose
}) {
  const firstInputRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const endTimeOptions = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }

    const startTime = new Date(selectedSlot.start_time).getTime();
    const singleEndTime = new Date(selectedSlot.end_time).getTime();
    const longerRanges = (endSlots || [])
      .filter((slot) => new Date(slot.start_time).getTime() > singleEndTime)
      .map((slot) => {
        const durationMinutes = Math.round((new Date(slot.start_time).getTime() - startTime) / 60000);
        return {
          value: String(slot.id),
          label: `${formatTime(slot.start_time)} (${durationMinutes} phút)`
        };
      });

    return [
      { value: 'single', label: `${formatTime(selectedSlot.end_time)} (30 phút)` },
      ...longerRanges
    ];
  }, [endSlots, selectedSlot]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 60);

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !selectedSlot) {
    return null;
  }

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div
      className="booking-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <header className="booking-modal-header">
          <div>
            <span className="booking-modal-eyebrow">Tạo booking</span>
            <h3 id="booking-modal-title">{title}</h3>
            <p>Nhập thông tin khách và xác nhận khung giờ đã chọn.</p>
          </div>
          <button
            type="button"
            className="booking-modal-close"
            aria-label="Đóng"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </header>

        <div className="booking-modal-slot-summary" aria-label="Khung giờ đã chọn">
          <article>
            <span>Sân</span>
            <strong>{selectedSlot.court_name || `Sân ${selectedSlot.court_id}`}</strong>
          </article>
          <article>
            <span>Ngày</span>
            <strong>{day}</strong>
          </article>
          <article>
            <span>Bắt đầu</span>
            <strong>{formatTime(selectedSlot.start_time)}</strong>
          </article>
          <article>
            <span>Giá khung đầu</span>
            <strong>{Number(selectedSlot.price || 0).toLocaleString('vi-VN')} VND</strong>
          </article>
        </div>

        <form className="booking-modal-form" onSubmit={onSubmit}>
          <div className="operation-field">
            <span>Giờ kết thúc</span>
            <AppSelect
              value={form.endTimeSlotId || 'single'}
              onChange={(value) => update('endTimeSlotId', value)}
              options={endTimeOptions}
              placeholder="Chọn giờ kết thúc"
              ariaLabel="Giờ kết thúc"
            />
          </div>

          <label className="operation-field">
            <span>Số điện thoại khách *</span>
            <input
              ref={firstInputRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Nhập số điện thoại"
              value={form.customerPhone}
              onChange={(event) => update('customerPhone', event.target.value)}
              required
            />
          </label>

          <label className="operation-field">
            <span>Tên khách *</span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Nhập tên khách"
              value={form.customerName}
              onChange={(event) => update('customerName', event.target.value)}
              required
            />
          </label>

          <div className="operation-field">
            <span>Loại khách</span>
            <AppSelect
              value={form.customerType}
              onChange={(value) => update('customerType', value)}
              options={CUSTOMER_TYPE_OPTIONS}
              ariaLabel="Loại khách"
            />
          </div>

          <label className="operation-field booking-modal-wide">
            <span>Ghi chú</span>
            <textarea
              placeholder="Ghi chú thêm cho booking"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows="3"
            />
          </label>

          <label className="booking-modal-wide operation-toggle booking-modal-deposit-toggle">
            <input
              type="checkbox"
              checked={Boolean(form.collectDeposit)}
              onChange={(event) => update('collectDeposit', event.target.checked)}
            />
            <span>Khách cọc trước</span>
          </label>

          {form.collectDeposit ? (
            <div className="booking-modal-wide booking-modal-deposit-grid">
              <label className="operation-field">
                <span>Số tiền cọc</span>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  placeholder="Nhập số tiền"
                  value={form.depositAmount}
                  onChange={(event) => update('depositAmount', event.target.value)}
                />
              </label>

              <div className="operation-field">
                <span>Phương thức cọc</span>
                <AppSelect
                  value={form.depositMethod}
                  onChange={(value) => update('depositMethod', value)}
                  options={PAYMENT_METHOD_OPTIONS}
                  ariaLabel="Phương thức cọc"
                />
              </div>

              <label className="operation-field">
                <span>Mã giao dịch / ghi chú</span>
                <input
                  type="text"
                  placeholder="Không bắt buộc"
                  value={form.depositReference}
                  onChange={(event) => update('depositReference', event.target.value)}
                />
              </label>
            </div>
          ) : null}

          <footer className="booking-modal-wide booking-modal-actions">
            <button
              type="button"
              className="operation-secondary-action"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button type="submit" className="operation-primary-action" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận đặt sân'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
