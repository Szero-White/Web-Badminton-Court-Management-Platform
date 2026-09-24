import { useMemo, useState } from 'react';
import { formatMoney } from '../../utils/formatters';
import './CustomerBookingsPanel.css';

const FINAL_STATUSES = new Set(['canceled', 'completed', 'no_show']);

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function statusLabel(status) {
  return ({
    pending: 'Chờ cọc',
    confirmed: 'Đã xác nhận',
    checked_in: 'Đã check-in',
    completed: 'Hoàn tất',
    canceled: 'Đã hủy',
    no_show: 'Không đến'
  })[status] || status;
}

export default function CustomerBookingsPanel({ bookings, loading, onCancel, onRefresh }) {
  const [busyId, setBusyId] = useState(null);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [bookings]
  );

  async function cancelBooking(booking) {
    const reason = window.prompt('Nhập lý do hủy booking:', 'Khách hàng yêu cầu hủy');
    if (!reason?.trim()) return;
    setBusyId(booking.id);
    try {
      await onCancel(booking.id, reason.trim());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="customer-bookings">
      <div className="customer-bookings__header">
        <div>
          <p className="customer-bookings__eyebrow">Tài khoản khách hàng</p>
          <h3>Booking của tôi</h3>
          <p>Theo dõi trạng thái cọc và hủy booking theo chính sách.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {sortedBookings.length === 0 ? (
        <div className="customer-bookings__empty">Chưa có booking nào trong tài khoản này.</div>
      ) : (
        <div className="customer-bookings__grid">
          {sortedBookings.map((booking) => {
            const canCancel = !FINAL_STATUSES.has(booking.status) && booking.status !== 'checked_in';
            const slot = booking.time_slot || {};
            const court = booking.court || {};
            return (
              <article className="customer-booking-card" key={booking.id}>
                <div className="customer-booking-card__top">
                  <div>
                    <strong>{booking.booking_code}</strong>
                    <span>{court.name || `Sân #${booking.court_id}`}</span>
                  </div>
                  <span className={`booking-status booking-status--${booking.status}`}>{statusLabel(booking.status)}</span>
                </div>

                <dl>
                  <div><dt>Thời gian</dt><dd>{formatDateTime(slot.start_time)}</dd></div>
                  <div><dt>Tổng tiền</dt><dd>{formatMoney(booking.total_price)}</dd></div>
                  <div><dt>Đã cọc</dt><dd>{formatMoney(booking.deposit_paid)}</dd></div>
                  <div><dt>Còn lại</dt><dd>{formatMoney(booking.remaining_due)}</dd></div>
                </dl>

                {booking.status === 'pending' && booking.expires_at ? (
                  <p className="customer-booking-card__expiry">Giữ chỗ đến {formatDateTime(booking.expires_at)}</p>
                ) : null}
                {booking.cancel_reason ? <p className="customer-booking-card__reason">Lý do hủy: {booking.cancel_reason}</p> : null}

                <div className="customer-booking-card__actions">
                  {Number(booking.remaining_due) > 0 && !FINAL_STATUSES.has(booking.status) ? (
                    <p className="customer-booking-card__payment-note">Khoản cọc chỉ được xác nhận bởi nhân viên tại quầy hoặc qua cổng thanh toán khi hệ thống tích hợp; khách hàng không thể tự đánh dấu giao dịch là đã thanh toán.</p>
                  ) : null}
                  {canCancel ? (
                    <button className="customer-booking-card__cancel" type="button" onClick={() => cancelBooking(booking)} disabled={busyId === booking.id}>
                      Hủy booking
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
