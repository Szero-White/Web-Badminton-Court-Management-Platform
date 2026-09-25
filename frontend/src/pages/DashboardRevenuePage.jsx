import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi, adminApi } from '../services/api';
import AppDatePicker from '../components/ui/AppDatePicker';

function todayString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function DashboardRevenuePage() {
  const [day, setDay] = useState(() => localStorage.getItem('last_booking_day') || todayString());
  const [slots, setSlots] = useState([]);
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Chọn ngày để xem doanh thu.');

  async function loadData() {
    setLoading(true);
    try {
      const [slotsRes, beveragesRes] = await Promise.all([
        bookingApi.getDaySlots(day),
        adminApi.listBeverages()
      ]);
      setSlots(slotsRes.data?.data || []);
      setBeverages(beveragesRes.data?.data || []);
      setMessage(`Dữ liệu ngày ${new Date(`${day}T00:00:00`).toLocaleDateString('vi-VN')} được tải thành công.`);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }

  // Tính toán doanh thu
  const statistics = useMemo(() => {
    // Doanh thu từ sân cầu lông
    const bookedSlots = slots.filter((s) => s.booked);
    const courtRevenue = bookedSlots.reduce((sum, s) => sum + s.price, 0);
    const courtCount = bookedSlots.length;

    // Tính toán tồn kho và giá trị
    const beverageValue = beverages.reduce((sum, b) => sum + b.price * b.stock, 0);

    // Tổng doanh thu tiềm năng (nếu bán hết nước)
    const totalRevenuePotential = courtRevenue + beverageValue;

    return {
      courtRevenue,
      courtCount,
      beverageValue,
      totalRevenue: courtRevenue,
      totalSlots: slots.length,
      occupancyRate: slots.length > 0 ? ((courtCount / slots.length) * 100).toFixed(1) : 0,
      beverageCount: beverages.length,
      totalBeverageStock: beverages.reduce((sum, b) => sum + b.stock, 0)
    };
  }, [slots, beverages]);

  useEffect(() => {
    loadData();

    const timer = setInterval(() => {
      loadData();
    }, 15000);

    return () => clearInterval(timer);
  }, [day]);

  return (
    <section className="panel customer">
      <div className="panel-header" style={{ alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2>📊 Thống Kê Doanh Thu</h2>
          <p>Xem doanh thu từ sân cầu lông & nước uống theo ngày.</p>
        </div>
        <div className="filters" style={{ margin: 0 }}>
          <AppDatePicker value={day} onChange={setDay} ariaLabel="Chọn ngày thống kê" />
          <button onClick={loadData} disabled={loading}>
            {loading ? 'Đang tải...' : 'Xem'}
          </button>
        </div>
        <Link to="/admin" className="staff-link-pill">Quay lại dashboard</Link>
      </div>

      <p className="message">{message}</p>

      {/* Thống kê tổng quan */}
      <div className="metrics-grid">
        <div className="metric-card">
          <label>🎾 Sân Đã Đặt</label>
          <h3>{statistics.courtCount} / {statistics.totalSlots}</h3>
          <small>{statistics.occupancyRate}% lấp đầy</small>
        </div>

        <div className="metric-card">
          <label>💰 Doanh Thu Sân</label>
          <h3>{statistics.courtRevenue.toLocaleString('vi-VN')}</h3>
          <small>VND</small>
        </div>

        <div className="metric-card">
          <label>🥤 Tồn Kho Nước</label>
          <h3>{statistics.totalBeverageStock} sản phẩm</h3>
          <small>{statistics.beverageCount} loại</small>
        </div>

        <div className="metric-card">
          <label>📦 Giá Trị Tồn Kho</label>
          <h3>{statistics.beverageValue.toLocaleString('vi-VN')}</h3>
          <small>VND (nếu bán hết)</small>
        </div>
      </div>

      {/* Chi tiết đặt sân */}
      <div style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '12px' }}>
        <h3>🎾 Chi Tiết Đặt Sân ({statistics.courtCount} booking)</h3>
        {slots.filter((s) => s.booked).length > 0 ? (
          <table style={{ width: '100%', textAlign: 'left', marginTop: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th>Sân</th>
                <th>Giờ</th>
                <th>Khách đặt</th>
                <th>Số điện thoại</th>
                <th>Ghi chú</th>
                <th>Mã Booking</th>
                <th>Giá (VND)</th>
              </tr>
            </thead>
            <tbody>
              {slots
                .filter((s) => s.booked)
                .map((slot) => (
                  <tr key={slot.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{slot.court_name}</td>
                    <td style={{ padding: '8px' }}>
                        {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <strong>{slot.customer_name || 'Chưa có tên'}</strong>
                    </td>
                    <td style={{ padding: '8px' }}>{slot.customer_phone || 'Chưa có SĐT'}</td>
                    <td style={{ padding: '8px' }}>{slot.booking_note || '-'}</td>
                    <td style={{ padding: '8px' }}>
                      <strong>{slot.booking_code}</strong>
                    </td>
                    <td style={{ padding: '8px' }}>{slot.price?.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p style={{ padding: '12px', color: '#999' }}>Không có booking nào ngày này.</p>
        )}
      </div>

      {/* Chiết kế tồn kho nước */}
      <div style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '12px' }}>
        <h3>🥤 Tồn Kho Nước ({statistics.beverageCount} loại)</h3>
        {beverages.length > 0 ? (
          <table style={{ width: '100%', textAlign: 'left', marginTop: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th>Tên Nước</th>
                <th>Giá (VND)</th>
                <th>Tồn Kho</th>
                <th>Đơn Vị</th>
                <th>Giá Trị (VND)</th>
              </tr>
            </thead>
            <tbody>
              {beverages.map((drink) => (
                <tr key={drink.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{drink.name}</td>
                  <td style={{ padding: '8px' }}>{drink.price?.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '8px' }}>{drink.stock}</td>
                  <td style={{ padding: '8px' }}>{drink.unit || 'chai'}</td>
                  <td style={{ padding: '8px' }}>
                    <strong>{(drink.price * drink.stock).toLocaleString('vi-VN')}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ padding: '12px', color: '#999' }}>Chưa có nước uống nào.</p>
        )}
      </div>

      {/* Tổng hợp */}
      <div style={{ marginTop: '20px', padding: '16px', background: '#e8f5e9', borderRadius: '12px' }}>
        <h3>📈 Tóm Tắt Ngày {day}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <strong>💰 Doanh Thu Thực Tế</strong>
            <p style={{ fontSize: '18px', color: '#2e7d32' }}>
              {statistics.courtRevenue.toLocaleString('vi-VN')} VND
            </p>
          </div>
          <div>
            <strong>💎 Giá Trị Tồn Kho</strong>
            <p style={{ fontSize: '18px', color: '#1976d2' }}>
              {statistics.beverageValue.toLocaleString('vi-VN')} VND
            </p>
          </div>
          <div>
            <strong>📊 Tỉ Lệ Lấp Đầy Sân</strong>
            <p style={{ fontSize: '18px', color: '#f57c00' }}>{statistics.occupancyRate}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}
