import AppSelect from '../../../components/ui/AppSelect';
import { formatTime } from '../../../utils/dateTime';
import { formatMoney } from '../../../utils/formatters';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'cash', label: 'Tiền mặt' }
];

export default function StaffDepositEditor({
  bookingGroups,
  selectedBooking,
  setSelectedBookingKey,
  depositEdit,
  setDepositEdit,
  loading,
  onConfirm
}) {
  const update = (field, value) => setDepositEdit((current) => ({ ...current, [field]: value }));
  const bookingOptions = bookingGroups.map((group) => ({
    value: group.groupKey,
    label: `${group.booking_code || 'Booking'} | ${group.court_names?.join(', ') || group.court_name} | ${formatTime(group.start_time)} - ${formatTime(group.end_time)}`,
    description: `${group.slot_count} slot`
  }));

  return (
    <article className="staff-action-card staff-action-card--wide">
      <h3>Sửa cọc booking đang chọn</h3>
      <p>Nhập tổng cọc mới; hệ thống phân bổ lại số tiền theo các slot của booking.</p>

      <div className="staff-booking-select">
        <span>Chọn booking</span>
        <AppSelect
          value={selectedBooking?.groupKey || ''}
          onChange={setSelectedBookingKey}
          disabled={bookingGroups.length === 0}
          placeholder={bookingGroups.length === 0 ? 'Không có booking' : 'Chọn booking'}
          options={bookingOptions}
          ariaLabel="Chọn booking"
        />
      </div>

      {selectedBooking ? (
        <div className="staff-deposit-editor">
          <div className="staff-booking-summary">
            <strong>Thông tin booking</strong>
            <p>Mã: {selectedBooking.booking_code}</p>
            <p>Sân: {selectedBooking.court_names?.join(', ') || selectedBooking.court_name}</p>
            <p>Khách: {selectedBooking.customer_name} ({selectedBooking.customer_phone})</p>
            <p>Thời gian: {formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}</p>
            {selectedBooking.booking_note ? <p className="staff-booking-note">Ghi chú: {selectedBooking.booking_note}</p> : null}
          </div>

          <p className="staff-deposit-current">Đã cọc hiện tại: {formatMoney(selectedBooking.deposit_paid || 0)} VND</p>

          <div className="staff-deposit-grid">
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="Nhập tổng cọc mới"
              value={depositEdit.amount}
              onChange={(event) => update('amount', event.target.value)}
            />
            <AppSelect
              value={depositEdit.method}
              onChange={(value) => update('method', value)}
              options={PAYMENT_METHOD_OPTIONS}
              ariaLabel="Phương thức cọc"
            />
            <input
              placeholder="Mã giao dịch / ghi chú"
              value={depositEdit.reference}
              onChange={(event) => update('reference', event.target.value)}
            />
          </div>

          <p className="staff-deposit-current">
            Tổng cọc sau cập nhật: {formatMoney(Math.max(0, Math.round(Number(depositEdit.amount || 0))))} VND
          </p>
          <button type="button" onClick={() => onConfirm(selectedBooking)} disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Cập nhật cọc'}
          </button>
        </div>
      ) : <p className="staff-empty-note">Ngày này chưa có booking để chỉnh cọc.</p>}
    </article>
  );
}
