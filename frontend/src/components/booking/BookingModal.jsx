import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppSelect from '../ui/AppSelect';
import BookingColorPicker from './BookingColorPicker';
import BookingScheduleEditor from './BookingScheduleEditor';
import AppConfirmDialog from '../feedback/AppConfirmDialog';
import { formatMoney } from '../../utils/formatters';
import { formatTime } from '../../utils/dateTime';
import { PAYMENT_STATUS_OPTIONS, resolvePaymentTotal } from '../../utils/bookingForm';

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'walk_in', label: 'Khách vãng lai' },
  { value: 'monthly', label: 'Khách cố định theo tháng' }
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' }
];

function formatBookingDay(day) {
  const [year, month, date] = String(day || '').split('-');
  if (!year || !month || !date) return day || '-';
  return `${date}/${month}/${year}`;
}

function estimateCreateTotal(selectedSlot, endSlots, endTimeSlotId) {
  if (!selectedSlot) return 0;
  if (!endTimeSlotId || endTimeSlotId === 'single') return Number(selectedSlot.price || 0);

  const end = (endSlots || []).find((slot) => String(slot.id) === String(endTimeSlotId));
  if (!end) return Number(selectedSlot.price || 0);

  const endStart = new Date(end.start_time).getTime();
  return [selectedSlot, ...(endSlots || [])]
    .filter((slot) => new Date(slot.start_time).getTime() < endStart)
    .reduce((sum, slot) => sum + Number(slot.price || 0), 0);
}

export default function BookingModal({
  open,
  mode = 'create',
  selectedSlot,
  bookingGroup = null,
  day,
  endSlots = [],
  form,
  setForm,
  loading,
  onSubmit,
  onDelete,
  onClose,
  loadDaySlots,
  feedback = null,
  onValidationError
}) {
  const firstInputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const totalPrice = useMemo(() => {
    if (mode === 'edit') return Number(form?.schedulePreviewTotal || bookingGroup?.total_price || 0);
    return estimateCreateTotal(selectedSlot, endSlots, form?.endTimeSlotId);
  }, [mode, bookingGroup, selectedSlot, endSlots, form?.endTimeSlotId, form?.schedulePreviewTotal]);


  const feedbackText = typeof feedback === 'object' ? feedback?.text : feedback;
  const feedbackTone = typeof feedback === 'object' ? (feedback?.tone || 'error') : 'error';

  const currentPaid = mode === 'edit' ? Number(bookingGroup?.deposit_paid || 0) : 0;
  const targetPaid = resolvePaymentTotal(form || {}, totalPrice);
  const remainingDue = Math.max(0, totalPrice - targetPaid);
  const paymentReduced = mode === 'edit' && targetPaid < currentPaid;

  const endTimeOptions = useMemo(() => {
    if (!selectedSlot || mode !== 'create') return [];
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
  }, [endSlots, selectedSlot, mode]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 60);

    function handleEscape(event) {
      if (event.key === 'Escape' && !loading) onCloseRef.current?.();
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, loading]);

  if (!open || !selectedSlot) return null;

  const closeModal = () => {
    if (loading) return;
    setCancelDialogOpen(false);
    onClose?.();
  };

  const openCancelDialog = () => {
    if (loading || mode !== 'edit' || typeof onDelete !== 'function') return;
    setCancelDialogOpen(true);
  };

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'paymentStatus') {
        if (value === 'unpaid') next.paymentAmount = '';
        if (value === 'paid') next.paymentAmount = String(totalPrice);
        if (value === 'partial' && !next.paymentAmount) {
          next.paymentAmount = currentPaid > 0 ? String(currentPaid) : '';
        }
      }
      return next;
    });
  };

  const title = mode === 'edit' ? 'Chỉnh sửa thông tin đặt sân' : 'Đặt sân cho khách';
  const eyebrow = mode === 'edit' ? 'Cập nhật booking' : 'Tạo booking';
  const helper = mode === 'edit'
    ? 'Cập nhật sân, ngày, khung giờ, thông tin khách, thanh toán và màu hiển thị của booking.'
    : 'Nhập thông tin khách, trạng thái thanh toán và màu nhận diện booking.';

  const modal = (
    <div
      className="booking-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
        <header className="booking-modal-header">
          <div>
            <span className="booking-modal-eyebrow">{eyebrow}</span>
            <h3 id="booking-modal-title">{title}</h3>
            <p>{helper}</p>
          </div>
          <button type="button" className="booking-modal-close" aria-label="Đóng" onClick={closeModal} disabled={loading}>
            ×
          </button>
        </header>

        <div className="booking-modal-body">
          {feedbackText ? (
            <div className={`booking-modal-feedback booking-modal-feedback--${feedbackTone}`} role={feedbackTone === 'error' ? 'alert' : 'status'}>
              <strong>{feedbackTone === 'error' ? 'Chưa thể thực hiện' : 'Thông báo'}</strong>
              {feedbackText}
            </div>
          ) : null}
          {mode === 'create' ? (
            <div className="booking-modal-slot-summary" aria-label="Thông tin booking">
              <article>
                <span>Sân</span>
                <strong>{selectedSlot.court_name || `Sân ${selectedSlot.court_id}`}</strong>
              </article>
              <article>
                <span>Ngày</span>
                <strong>{formatBookingDay(day)}</strong>
              </article>
              <article>
                <span>Bắt đầu</span>
                <strong>{formatTime(selectedSlot.start_time)}</strong>
              </article>
              <article>
                <span>Tổng tiền</span>
                <strong>{formatMoney(totalPrice)} VND</strong>
              </article>
            </div>
          ) : null}

          <form
            className="booking-modal-form"
            onSubmit={onSubmit}
            onInvalid={(event) => {
              const field = event.target;
              const label = field?.closest?.('.operation-field')?.querySelector?.('span')?.textContent?.replace('*', '')?.trim();
              onValidationError?.(label ? `Vui lòng kiểm tra trường “${label}”.` : 'Vui lòng kiểm tra các trường bắt buộc trước khi lưu.');
            }}
          >
            {mode === 'edit' ? (
              <>
                <BookingScheduleEditor
                  bookingGroup={bookingGroup}
                  form={form}
                  setForm={setForm}
                  loadDaySlots={loadDaySlots}
                  disabled={loading}
                />
                <div className="booking-modal-booking-code">
                  <span>Mã booking</span>
                  <strong>{bookingGroup?.booking_code || '-'}</strong>
                </div>
              </>
            ) : (
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
            )}

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

            <section className="booking-modal-wide booking-payment-panel" aria-label="Thanh toán">
              <div className="booking-modal-section-heading">
                <div>
                  <h4>Thanh toán</h4>
                  <p>Có thể điều chỉnh lại nếu nhân viên hoặc quản trị viên nhập nhầm.</p>
                </div>
                <div className="booking-payment-balance">
                  <span>Đã thu <strong>{formatMoney(targetPaid)} VND</strong></span>
                  <span>Còn lại <strong>{formatMoney(remainingDue)} VND</strong></span>
                </div>
              </div>

              <div className="booking-payment-status" role="radiogroup" aria-label="Trạng thái thanh toán">
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <label key={option.value} className={form.paymentStatus === option.value ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="booking-payment-status"
                      value={option.value}
                      checked={form.paymentStatus === option.value}
                      onChange={() => update('paymentStatus', option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>

              {form.paymentStatus !== 'unpaid' ? (
                <div className="booking-payment-grid">
                  <label className="operation-field">
                    <span>{form.paymentStatus === 'paid' ? 'Số tiền thanh toán' : 'Số tiền cọc'}</span>
                    <input
                      type="number"
                      min="0"
                      max={totalPrice}
                      step="1000"
                      value={form.paymentStatus === 'paid' ? totalPrice : form.paymentAmount}
                      onChange={(event) => update('paymentAmount', event.target.value)}
                      disabled={form.paymentStatus === 'paid'}
                    />
                  </label>

                  <div className="operation-field">
                    <span>Phương thức</span>
                    <AppSelect
                      value={form.paymentMethod}
                      onChange={(value) => update('paymentMethod', value)}
                      options={PAYMENT_METHOD_OPTIONS}
                      ariaLabel="Phương thức thanh toán"
                    />
                  </div>

                  <label className="operation-field">
                    <span>Mã giao dịch / ghi chú</span>
                    <input
                      type="text"
                      placeholder="Không bắt buộc"
                      value={form.paymentReference}
                      onChange={(event) => update('paymentReference', event.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {paymentReduced ? (
                <label className="operation-field booking-payment-reason">
                  <span>Lý do điều chỉnh giảm *</span>
                  <input
                    type="text"
                    placeholder="Ví dụ: nhập nhầm số tiền"
                    value={form.paymentAdjustmentReason}
                    onChange={(event) => update('paymentAdjustmentReason', event.target.value)}
                    required
                  />
                </label>
              ) : null}
            </section>

            <section className="booking-modal-wide booking-color-section">
              <div className="booking-modal-section-heading">
                <div>
                  <h4>Màu nhận diện booking</h4>
                  <p>Chọn màu riêng để phân biệt các booking liền kề trên lịch.</p>
                </div>
              </div>
              <BookingColorPicker
                value={form.displayColor}
                onChange={(value) => update('displayColor', value)}
                disabled={loading}
              />
            </section>

            <footer className="booking-modal-wide booking-modal-actions">
              {mode === 'edit' && onDelete ? (
                <button
                  type="button"
                  className="booking-modal-danger"
                  onClick={openCancelDialog}
                  disabled={loading}
                >
                  Hủy booking
                </button>
              ) : null}
              <span className="booking-modal-actions-spacer" />
              <button type="button" className="operation-secondary-action" onClick={closeModal} disabled={loading}>
                Đóng
              </button>
              <button type="submit" className="operation-primary-action" disabled={loading}>
                {loading ? 'Đang xử lý...' : mode === 'edit' ? 'Lưu thay đổi' : 'Xác nhận đặt sân'}
              </button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      <AppConfirmDialog
        open={cancelDialogOpen}
        eyebrow="Hủy booking"
        title={`Xác nhận hủy ${bookingGroup?.booking_code || 'booking'}`}
        description="Booking sẽ được chuyển sang trạng thái đã hủy và lịch sân sẽ được giải phóng."
        details={[
          { label: 'Khách hàng', value: bookingGroup?.customer_name || 'Khách' },
          { label: 'Số khung giờ', value: `${bookingGroup?.slots?.length || 1} khung` },
          { label: 'Tổng tiền', value: `${formatMoney(Number(bookingGroup?.total_price || totalPrice || 0))} VND` },
          { label: 'Đã thu', value: `${formatMoney(Number(bookingGroup?.deposit_paid || 0))} VND` }
        ]}
        reasonLabel="Lý do hủy"
        reasonPlaceholder="Ví dụ: Khách đổi lịch, nhân viên đặt nhầm sân..."
        reasonRequired
        confirmLabel="Xác nhận hủy booking"
        loading={loading}
        onClose={() => {
          if (!loading) setCancelDialogOpen(false);
        }}
        onConfirm={async (reason) => {
          if (typeof onDelete !== 'function') return;
          try {
            await onDelete(reason);
            setCancelDialogOpen(false);
          } catch {
            // Parent already exposes the API error through the shared notice system.
            // Keep the dialog open so the operator can review/retry safely.
          }
        }}
      />
    </>
  );
}
