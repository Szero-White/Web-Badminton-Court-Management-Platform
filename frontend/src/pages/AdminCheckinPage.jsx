import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../services/api';
import './AdminCheckinPage.css';

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusLabel(value) {
  switch (value) {
    case 'pending':
      return 'Chờ cọc';
    case 'confirmed':
      return 'Đã cọc';
    case 'checked_in':
      return 'Đã check-in';
    case 'completed':
      return 'Hoàn thành';
    case 'canceled':
      return 'Đã hủy';
    case 'no_show':
      return 'Không đến';
    default:
      return value || 'Không xác định';
  }
}

export default function AdminCheckinPage() {
  const [message, setMessage] = useState('Admin check-in dùng chung dữ liệu booking với nhân viên.');
  const [checkInCode, setCheckInCode] = useState('');
  const [lastCheckin, setLastCheckin] = useState(null);
  const [checkinFeed, setCheckinFeed] = useState([]);
  const [loading, setLoading] = useState(false);

  const quickSummary = useMemo(() => {
    const total = checkinFeed.length;
    const checkedIn = checkinFeed.filter((item) => item.status === 'checked_in').length;
    const pending = checkinFeed.filter((item) => item.status === 'pending').length;
    return { total, checkedIn, pending };
  }, [checkinFeed]);

  async function doCheckin(e) {
    e.preventDefault();
    if (!checkInCode.trim()) {
      setMessage('Vui lòng nhập mã booking hoặc số điện thoại.');
      return;
    }

    try {
      setLoading(true);
      const res = await staffApi.checkin(checkInCode.trim());
      const booking = res.data?.data;
      setLastCheckin(booking || null);
      if (booking) {
        setCheckinFeed((prev) => [booking, ...prev.filter((item) => item.id !== booking.id)].slice(0, 8));
      }
      setCheckInCode('');
      setMessage(`Đã tìm thấy booking ${booking?.booking_code || ''} (${statusLabel(booking?.status)}).`);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Check-in thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel admin-checkin-page">
      <div className="admin-checkin-hero">
        <div>
          <h2>Check-in khách cho Admin</h2>
          <p>Trang này dùng cùng API và cùng nguồn dữ liệu check-in như nhân viên.</p>
        </div>
        <div className="admin-checkin-links">
          <Link to="/admin" className="staff-link-pill">Dashboard</Link>
          <Link to="/admin/booking-desk" className="staff-link-pill">Booking</Link>
          <Link to="/admin/revenue" className="staff-link-pill">Doanh thu</Link>
        </div>
      </div>

      <p className="message">{message}</p>

      <div className="admin-checkin-grid">
        <article className="admin-checkin-card admin-checkin-card--wide">
          <h3>Quầy check-in</h3>
          <p>Nhập mã booking hoặc số điện thoại để xử lý check-in ngay tại quầy.</p>
          <form className="admin-checkin-form" onSubmit={doCheckin}>
            <input
              placeholder="Mã booking hoặc SĐT"
              value={checkInCode}
              onChange={(e) => setCheckInCode(e.target.value)}
            />
            <button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : 'Check-in khách'}</button>
          </form>

          {lastCheckin ? (
            <div className="admin-checkin-highlight">
              <strong>Thông tin check-in vừa xử lý</strong>
              <p><strong>Khách:</strong> {lastCheckin.user?.full_name || '-'}</p>
              <p><strong>SĐT:</strong> {lastCheckin.user?.phone || '-'}</p>
              <p><strong>Sân:</strong> {lastCheckin.court?.name || '-'}</p>
              <p><strong>Khung giờ:</strong> {formatDateTime(lastCheckin.time_slot?.start_time)} - {formatTime(lastCheckin.time_slot?.end_time)}</p>
              <p><strong>Loại khách:</strong> {lastCheckin.customer_type === 'monthly' ? 'Khách tháng' : 'Khách vãng lai'}</p>
              <p><strong>Trạng thái:</strong> {statusLabel(lastCheckin.status)}</p>
              <p><strong>Mã booking:</strong> {lastCheckin.booking_code || '-'}</p>
              <p><strong>Tổng tiền:</strong> {Number(lastCheckin.total_price || 0).toLocaleString('vi-VN')} VND</p>
              {lastCheckin.notes ? <p><strong>Ghi chú:</strong> {lastCheckin.notes}</p> : null}
            </div>
          ) : null}
        </article>

        <article className="admin-checkin-card">
          <h3>Tóm tắt nhanh</h3>
          <div className="admin-checkin-metrics">
            <div>
              <span>Tổng lượt gần đây</span>
              <strong>{quickSummary.total}</strong>
            </div>
            <div>
              <span>Đã check-in</span>
              <strong>{quickSummary.checkedIn}</strong>
            </div>
            <div>
              <span>Chờ cọc</span>
              <strong>{quickSummary.pending}</strong>
            </div>
          </div>
        </article>
      </div>

      {checkinFeed.length > 0 ? (
        <article className="admin-checkin-card admin-checkin-card--feed">
          <h3>Danh sách check-in gần đây</h3>
          <div className="admin-checkin-feed">
            {checkinFeed.map((item) => (
              <div key={item.id} className="admin-checkin-feed-item">
                <div className="admin-checkin-feed-title">{item.user?.full_name || 'Khách'} - {item.user?.phone || '-'}</div>
                <div className="admin-checkin-feed-sub">{item.court?.name || '-'} | {formatDateTime(item.time_slot?.start_time)} - {formatTime(item.time_slot?.end_time)}</div>
                <div className="admin-checkin-feed-sub">Mã: {item.booking_code || '-'} | Trạng thái: {statusLabel(item.status)}</div>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
