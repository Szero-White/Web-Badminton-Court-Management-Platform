import { formatDateTime, formatTime } from '../../../utils/dateTime';

function CheckinDetails({ booking }) {
  if (!booking) return null;
  return (
    <div className="staff-checkin-details">
      <strong>Thông tin check-in vừa xử lý</strong>
      <p><strong>Khách:</strong> {booking.user?.full_name || '-'}</p>
      <p><strong>SĐT:</strong> {booking.user?.phone || '-'}</p>
      <p><strong>Sân:</strong> {booking.court?.name || '-'}</p>
      <p><strong>Khung giờ:</strong> {formatDateTime(booking.time_slot?.start_time)} - {formatTime(booking.time_slot?.end_time)}</p>
      <p><strong>Loại khách:</strong> {booking.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai'}</p>
      <p><strong>Trạng thái:</strong> {booking.status}</p>
      <p><strong>Mã booking:</strong> {booking.booking_code}</p>
      <p><strong>Tổng tiền:</strong> {Number(booking.total_price || 0).toLocaleString('vi-VN')} VND</p>
      {booking.notes ? <p><strong>Ghi chú:</strong> {booking.notes}</p> : null}
    </div>
  );
}

export default function StaffCheckinPanel({ checkInCode, setCheckInCode, lastCheckin, checkinFeed, onSubmit }) {
  return (
    <article className="staff-action-card staff-action-card--wide">
      <h3>Check-in khách</h3>
      <p>Nhập mã booking hoặc số điện thoại để check-in nhanh.</p>
      <form className="staff-form" onSubmit={onSubmit}>
        <input placeholder="Mã booking hoặc SĐT" value={checkInCode} onChange={(event) => setCheckInCode(event.target.value)} />
        <button type="submit">Check-in</button>
      </form>
      <CheckinDetails booking={lastCheckin} />
      {checkinFeed.length > 0 ? (
        <div className="staff-checkin-feed">
          <strong>Danh sách check-in gần đây</strong>
          <div>
            {checkinFeed.map((item) => (
              <article key={item.id}>
                <strong>{item.user?.full_name || 'Khách'} - {item.user?.phone || '-'}</strong>
                <span>{item.court?.name || '-'} | {formatDateTime(item.time_slot?.start_time)} - {formatTime(item.time_slot?.end_time)}</span>
                <span>Mã: {item.booking_code} | Trạng thái: {item.status}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
