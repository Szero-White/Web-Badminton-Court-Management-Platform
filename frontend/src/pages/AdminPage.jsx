import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, dashboardApi } from '../services/api';

const demoOperationalFlow = [
  { title: 'Check-in khách', value: 'Staff scan booking code hoặc số điện thoại' },
  { title: 'Đổi sân / dời giờ', value: 'Xử lý linh hoạt theo slot còn trống' },
  { title: 'Thu phần còn lại', value: 'Ghi nhận tiền mặt/chuyển khoản tại quầy' }
];

function getBeverageActionLabel(action) {
  switch (action) {
    case 'beverage_update':
      return 'Cập nhật giá/tồn kho';
    case 'beverage_delete':
      return 'Xóa mặt hàng';
    case 'beverage_adjust_stock_increase':
      return 'Tăng tồn kho';
    case 'beverage_adjust_stock_decrease':
      return 'Giảm tồn kho';
    default:
      return action || 'Không xác định';
  }
}

function formatBeverageHistoryPayload(payload) {
  if (!payload) {
    return '-';
  }

  const parsed = {};
  payload.split(';').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  });

  const labelMap = {
    before_name: 'Tên cũ',
    after_name: 'Tên mới',
    name: 'Tên nước',
    before_price: 'Giá cũ',
    after_price: 'Giá mới',
    before_stock: 'Tồn cũ',
    after_stock: 'Tồn mới',
    before_active: 'Trạng thái cũ',
    after_active: 'Trạng thái mới',
    delta: 'Chênh lệch',
    note: 'Ghi chú'
  };

  const order = ['before_name', 'after_name', 'name', 'before_price', 'after_price', 'before_stock', 'after_stock', 'before_active', 'after_active', 'delta', 'note'];
  const parts = order
    .filter((key) => parsed[key] !== undefined && parsed[key] !== '')
    .map((key) => `${labelMap[key]}: ${parsed[key]}`);

  return parts.length > 0 ? parts.join(' | ') : payload;
}

function formatCustomerType(value) {
  switch (value) {
    case 'monthly':
      return 'Khách tháng';
    default:
      return 'Khách lẻ';
  }
}

export default function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [staffForm, setStaffForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
  const [drinkForm, setDrinkForm] = useState({ name: '', price: '', stock: '', unit: 'chai', description: '' });
  const [actionMessage, setActionMessage] = useState('');
  const [beverages, setBeverages] = useState([]);
  const [editRows, setEditRows] = useState({});
  const [historyFor, setHistoryFor] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadBeverages() {
    try {
      const res = await adminApi.listBeverages();
      const data = res.data?.data || [];
      setBeverages(data);

      setEditRows((prev) => {
        const next = { ...prev };
        data.forEach((item) => {
          if (!next[item.id]) {
            next[item.id] = { name: item.name, price: item.price, stock: item.stock, note: '' };
            return;
          }
          next[item.id] = {
            ...next[item.id],
            name: item.name,
            price: item.price,
            stock: item.stock
          };
        });
        return next;
      });
    } catch (e) {
      setActionMessage(e?.response?.data?.error?.message || 'Khong tai duoc danh sach nuoc.');
    }
  }

  useEffect(() => {
    dashboardApi.summary()
      .then((res) => setSummary(res.data?.data))
      .catch((e) => setError(e?.response?.data?.error?.message || 'Đăng nhập admin để xem dashboard thực.'));

    loadBeverages();
  }, []);

  async function createStaff(e) {
    e.preventDefault();
    setActionMessage('Đang tạo nhân viên...');
    try {
      const res = await adminApi.createStaff({ ...staffForm, role: 'staff' });
      setActionMessage(`Đã tạo nhân viên: ${res.data?.data?.email}`);
      setStaffForm({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
    } catch (e2) {
      setActionMessage(e2?.response?.data?.error?.message || 'Không tạo được nhân viên.');
    }
  }

  async function createDrink(e) {
    e.preventDefault();
    setActionMessage('Đang thêm nước uống...');
    try {
      const res = await adminApi.createBeverage({
        name: drinkForm.name,
        price: Number(drinkForm.price),
        stock: Number(drinkForm.stock),
        unit: drinkForm.unit,
        description: drinkForm.description
      });
      setActionMessage(`Đã thêm nước uống: ${res.data?.data?.name}`);
      setDrinkForm({ name: '', price: '', stock: '', unit: 'chai', description: '' });
      await loadBeverages();
    } catch (e2) {
      setActionMessage(e2?.response?.data?.error?.message || 'Không thêm được nước uống.');
    }
  }

  async function saveBeverage(item) {
    const row = editRows[item.id] || {};
    setActionMessage('Đang cập nhật giá/tồn kho...');
    try {
      await adminApi.updateBeverage(item.id, {
        name: String(row.name || item.name).trim(),
        price: Number(row.price),
        stock: Number(row.stock),
        note: row.note || 'Admin cap nhat gia/ton kho'
      });
      setActionMessage(`Đã cập nhật ${item.name}.`);
      await loadBeverages();
      if (historyFor === item.id) {
        await loadHistory(item.id);
      }
    } catch (e) {
      setActionMessage(e?.response?.data?.error?.message || 'Không cập nhật được mặt hàng.');
    }
  }

  async function deleteBeverage(item) {
    if (!window.confirm(`Xóa mặt hàng ${item.name}? Mặt hàng sẽ bị ẩn khỏi danh sách bán.`)) {
      return;
    }

    const row = editRows[item.id] || {};
    setActionMessage('Đang xóa mặt hàng...');
    try {
      await adminApi.deleteBeverage(item.id, row.note || 'Admin xoa mat hang');
      setActionMessage(`Đã xóa ${item.name}.`);
      if (historyFor === item.id) {
        setHistoryFor(null);
        setHistoryRows([]);
      }
      await loadBeverages();
    } catch (e) {
      setActionMessage(e?.response?.data?.error?.message || 'Không xóa được mặt hàng.');
    }
  }

  async function loadHistory(beverageId) {
    setHistoryLoading(true);
    setHistoryFor(beverageId);
    try {
      const res = await adminApi.beverageHistory(beverageId, 30);
      setHistoryRows(res.data?.data || []);
    } catch (e) {
      setHistoryRows([]);
      setActionMessage(e?.response?.data?.error?.message || 'Không tải được lịch sử chỉnh sửa.');
    } finally {
      setHistoryLoading(false);
    }
  }


  return (
    <section className="panel admin">
      <div className="panel-header">
        <div>
          <h2>Trung tâm vận hành sân</h2>
          <p>Theo dõi doanh thu, tỉ lệ lấp đầy, peak hours và tỉ lệ hủy/no-show.</p>
        </div>
      </div>

      {error && <p className="message">{error}</p>}
      {actionMessage && <p className="message">{actionMessage}</p>}

      {/* Admin Menu Navigation */}
      <div style={{ display: 'flex', gap: '10px', margin: '16px 0', flexWrap: 'wrap' }}>
        <Link to="/admin" style={{ padding: '10px 16px', background: '#1d7471', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          📊 Dashboard
        </Link>
        <Link to="/admin/booking-desk" style={{ padding: '10px 16px', background: '#00695c', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          📅 Booking
        </Link>
        <Link to="/admin/checkin" style={{ padding: '10px 16px', background: '#00897b', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          ✅ Check-in khách
        </Link>
        <Link to="/admin/courts" style={{ padding: '10px 16px', background: '#ff8a3d', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          🎾 Quản Lý Sân
        </Link>
        <Link to="/admin/revenue" style={{ padding: '10px 16px', background: '#2e7d32', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          💰 Thống Kê Doanh Thu
        </Link>
        <Link to="/staff/beverage-counter" style={{ padding: '10px 16px', background: '#5e35b1', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          🥤 Quản Lý Nước
        </Link>
        <Link to="/admin/staff" style={{ padding: '10px 16px', background: '#c62828', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
          👤 Quản Lý Nhân Viên
        </Link>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <label>Doanh Thu Ngày</label>
          <h3>{summary?.daily_revenue?.toLocaleString() || '0'} VND</h3>
        </div>
        <div className="metric-card">
          <label>Doanh Thu Tuần</label>
          <h3>{summary?.weekly_revenue?.toLocaleString() || '0'} VND</h3>
        </div>
        <div className="metric-card">
          <label>Doanh Thu Tháng</label>
          <h3>{summary?.monthly_revenue?.toLocaleString() || '0'} VND</h3>
        </div>
        <div className="metric-card">
          <label>Tỉ Lệ Hủy/No-show</label>
          <h3>{Number(summary?.cancel_rate || 0).toFixed(2)}%</h3>
        </div>
      </div>

      <div className="ops-board">
        {demoOperationalFlow.map((item) => (
          <article key={item.title}>
            <h4>{item.title}</h4>
            <p>{item.value}</p>
          </article>
        ))}
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <h3>Booking khách</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Màn hình đặt, sửa và hủy booking hiện chỉ dùng trang Booking mới để thao tác gọn hơn.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link to="/admin/booking-desk" style={{ display: 'inline-flex', padding: '10px 14px', background: '#455a64', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
            Đi tới trang booking
          </Link>
        </div>
      </div>

      <div className="admin-forms">
        <form className="form-card" onSubmit={createStaff}>
          <h3>Tạo nhân viên</h3>
          <input placeholder="Họ và tên" value={staffForm.full_name} onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })} />
          <input placeholder="Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
          <input placeholder="Số điện thoại" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
          <input placeholder="Mật khẩu" type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
          <button type="submit">Tạo staff</button>
        </form>

        <form className="form-card" onSubmit={createDrink}>
          <h3>Thêm nước uống</h3>
          <input placeholder="Tên nước uống" value={drinkForm.name} onChange={(e) => setDrinkForm({ ...drinkForm, name: e.target.value })} />
          <input placeholder="Giá" type="number" value={drinkForm.price} onChange={(e) => setDrinkForm({ ...drinkForm, price: e.target.value })} />
          <input placeholder="Tồn kho" type="number" value={drinkForm.stock} onChange={(e) => setDrinkForm({ ...drinkForm, stock: e.target.value })} />
          <input placeholder="Đơn vị" value={drinkForm.unit} onChange={(e) => setDrinkForm({ ...drinkForm, unit: e.target.value })} />
          <input placeholder="Mô tả" value={drinkForm.description} onChange={(e) => setDrinkForm({ ...drinkForm, description: e.target.value })} />
          <button type="submit">Thêm nước</button>
        </form>

      </div>

      <div className="form-card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <h3>Sửa giá và sửa tồn kho theo sản phẩm</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Tên nước</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Giá hiện tại</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Tồn hiện tại</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Tên mới</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Giá mới</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Tồn mới</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Ghi chú sửa</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {beverages.map((item) => {
              const row = editRows[item.id] || {};
              return (
                <tr key={item.id}>
                  <td style={{ padding: 8 }}>{item.name}</td>
                  <td style={{ textAlign: 'right', padding: 8 }}>{Number(item.price || 0).toLocaleString('vi-VN')}</td>
                  <td style={{ textAlign: 'right', padding: 8 }}>{item.stock}</td>
                  <td style={{ padding: 8 }}>
                    <input
                      value={row.name ?? ''}
                      onChange={(e) => setEditRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))}
                      placeholder="Tên nước mới"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', padding: 8 }}>
                    <input
                      type="number"
                      value={row.price ?? ''}
                      onChange={(e) => setEditRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], price: e.target.value } }))}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', padding: 8 }}>
                    <input
                      type="number"
                      value={row.stock ?? ''}
                      onChange={(e) => setEditRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], stock: e.target.value } }))}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      value={row.note || ''}
                      onChange={(e) => setEditRows((prev) => ({ ...prev, [item.id]: { ...prev[item.id], note: e.target.value } }))}
                      placeholder="Ví dụ: cập nhật giá mới"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => saveBeverage(item)} style={{ marginRight: 8 }}>Sửa giá/tồn</button>
                    <button type="button" onClick={() => deleteBeverage(item)} style={{ background: '#b74f3f' }}>Xóa nước</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <h3>Lịch sử chỉnh sửa giá/tồn kho</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
          {beverages.map((item) => (
            <button
              key={`history-${item.id}`}
              type="button"
              onClick={() => loadHistory(item.id)}
              style={{
                padding: '8px 12px',
                borderRadius: '999px',
                border: historyFor === item.id ? '2px solid #1d7471' : '1px solid #ccc',
                background: historyFor === item.id ? '#e6f6f5' : '#fff',
                color: '#122322',
                fontWeight: 600
              }}
            >
              {item.name || `Nước #${item.id}`}
            </button>
          ))}
        </div>
        {historyFor ? <p style={{ opacity: 0.8 }}>Mặt hàng đang xem: {beverages.find((item) => item.id === historyFor)?.name || `#${historyFor}`}</p> : <p style={{ opacity: 0.8 }}>Chọn mặt hàng bên trên để xem lịch sử.</p>}
        {historyLoading ? (
          <p>Đang tải lịch sử...</p>
        ) : historyRows.length === 0 ? (
          <p>Chưa có bản ghi lịch sử.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Thời gian</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Người sửa</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Hành động</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: 8 }}>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: 8 }}>{log.actor_name || `User #${log.actor_id}`}</td>
                  <td style={{ padding: 8 }}>{getBeverageActionLabel(log.action)}</td>
                  <td style={{ padding: 8 }}>{formatBeverageHistoryPayload(log.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
