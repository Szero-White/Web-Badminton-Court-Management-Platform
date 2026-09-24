import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import './AdminPage.css';

const NAV_ITEMS = [
  { to: '/admin/booking-desk', icon: '📅', title: 'Booking', description: 'Tạo, sửa, hủy và theo dõi lịch đặt sân.' },
  { to: '/admin/checkin', icon: '✅', title: 'Check-in', description: 'Xác nhận khách đến sân theo booking.' },
  { to: '/admin/courts', icon: '🎾', title: 'Quản lý sân', description: 'Giờ hoạt động, giá sân và trạng thái bảo trì.' },
  { to: '/admin/revenue', icon: '💰', title: 'Doanh thu', description: 'Theo dõi doanh thu, lấp đầy và giờ cao điểm.' },
  { to: '/admin/beverages', icon: '🥤', title: 'Kho nước', description: 'Danh mục, giá bán, tồn kho và lịch sử chỉnh sửa.' },
  { to: '/admin/staff', icon: '👤', title: 'Nhân sự', description: 'Quản lý tài khoản nhân viên và quyền truy cập.' }
];

const OPERATIONS = [
  ['Check-in khách', 'Xác nhận booking bằng mã đặt sân hoặc số điện thoại.'],
  ['Điều phối sân', 'Theo dõi lịch theo ngày và xử lý thay đổi slot tại quầy.'],
  ['Đối soát ca', 'Tách tiền mặt/chuyển khoản và theo dõi thu chi vận hành.']
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

export default function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    try {
      setLoading(true);
      const response = await dashboardApi.summary();
      setSummary(response.data?.data || {});
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || 'Không tải được dữ liệu tổng quan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSummary(); }, []);

  return (
    <section className="panel admin admin-overview-page">
      <div className="admin-overview-header">
        <div>
          <p className="admin-overview-eyebrow">Trung tâm điều hành</p>
          <h2>Quản trị sân cầu lông</h2>
          <p>Theo dõi tình hình kinh doanh và truy cập nhanh các nghiệp vụ quản trị.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadSummary} disabled={loading}>
          {loading ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {error ? <p className="message admin-overview-message" role="alert">{error}</p> : null}

      <div className="metrics-grid admin-overview-metrics" aria-busy={loading}>
        <article className="metric-card"><label>Doanh thu ngày</label><h3>{formatMoney(summary?.daily_revenue)} VND</h3></article>
        <article className="metric-card"><label>Doanh thu tuần</label><h3>{formatMoney(summary?.weekly_revenue)} VND</h3></article>
        <article className="metric-card"><label>Doanh thu tháng</label><h3>{formatMoney(summary?.monthly_revenue)} VND</h3></article>
        <article className="metric-card"><label>Tỉ lệ hủy / no-show</label><h3>{Number(summary?.cancel_rate || 0).toFixed(2)}%</h3></article>
      </div>

      <section className="admin-navigation-section" aria-labelledby="admin-navigation-title">
        <div className="admin-section-heading">
          <div><h3 id="admin-navigation-title">Nghiệp vụ quản trị</h3><p>Mỗi chức năng được tách thành màn hình riêng để dễ bảo trì và mở rộng.</p></div>
        </div>
        <div className="admin-navigation-grid">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="admin-navigation-card">
              <span className="admin-navigation-icon" aria-hidden="true">{item.icon}</span>
              <div><strong>{item.title}</strong><p>{item.description}</p></div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-navigation-section" aria-labelledby="admin-operation-title">
        <div className="admin-section-heading"><div><h3 id="admin-operation-title">Quy trình vận hành</h3><p>Các bước chính nhân viên thực hiện trong một ca làm việc.</p></div></div>
        <div className="ops-board">
          {OPERATIONS.map(([title, description]) => <article key={title}><h4>{title}</h4><p>{description}</p></article>)}
        </div>
      </section>
    </section>
  );
}
