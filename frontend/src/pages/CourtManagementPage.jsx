import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/api';
import './CourtManagementPage.css';

function normalizePriceInput(value, fallback = 0) {
  const cleaned = String(value ?? '').replace(/[.,\s]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export default function CourtManagementPage() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCourt, setEditingCourt] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    court_type: '',
    open_time: '06:00',
    close_time: '22:00',
    base_price: 0,
    is_active: true,
    is_maintenance: false
  });

  async function loadCourts() {
    setLoading(true);
    try {
      const res = await adminApi.listCourts();
      setCourts(res.data?.data || []);
      setMessage('Đã tải danh sách sân.');
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tải sân.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourt(e) {
    e.preventDefault();
    try {
      const basePrice = normalizePriceInput(formData.base_price, 0);
      const res = await adminApi.createCourt({
        name: formData.name,
        court_type: formData.court_type,
        open_time: formData.open_time,
        close_time: formData.close_time,
        base_price: basePrice
      });
      setMessage(`✓ Tạo sân thành công: ${res.data?.data?.name}`);

      setFormData({
        name: '',
        court_type: '',
        open_time: '06:00',
        close_time: '22:00',
        base_price: 0,
        is_active: true,
        is_maintenance: false
      });
      loadCourts();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tạo sân.');
    }
  }

  async function handleUpdateCourt(e) {
    e.preventDefault();
    if (!editingCourt) return;
    try {
      const basePrice = normalizePriceInput(formData.base_price, Number(editingCourt.base_price || 0));
      const priceChanged = basePrice !== Number(editingCourt.base_price || 0);
      const res = await adminApi.updateCourt(editingCourt.id, {
        name: formData.name || editingCourt.name,
        court_type: formData.court_type || editingCourt.court_type,
        open_time: formData.open_time || editingCourt.open_time,
        close_time: formData.close_time || editingCourt.close_time,
        base_price: basePrice,
        is_active: formData.is_active,
        is_maintenance: formData.is_maintenance
      });
      setMessage(
        priceChanged
          ? `✓ Cập nhật sân thành công: ${res.data?.data?.name}. Giá mới áp dụng cho các slot trống từ hiện tại trở đi; booking đã tạo và dữ liệu quá khứ giữ nguyên giá.`
          : `✓ Cập nhật sân thành công: ${res.data?.data?.name}`
      );
      setEditingCourt(null);
      setFormData({
        name: '',
        court_type: '',
        open_time: '06:00',
        close_time: '22:00',
        base_price: 0,
        is_active: true,
        is_maintenance: false
      });
      loadCourts();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể cập nhật sân.');
    }
  }

  function startEdit(court) {
    setEditingCourt(court);
    setFormData({
      name: court.name,
      court_type: court.court_type,
      open_time: court.open_time,
      close_time: court.close_time,
      base_price: court.base_price,
      is_active: court.is_active,
      is_maintenance: court.is_maintenance || false
    });
  }

  useEffect(() => {
    loadCourts();
  }, []);

  return (
    <section className="panel customer court-management-page">
      <div className="panel-header court-management-header">
        <div>
          <h2>Quản Lý Sân Cầu Lông</h2>
          <p>Tạo sân mới, chỉnh sửa thông tin, đánh dấu bảo trì.</p>
        </div>
        <Link to="/admin" className="court-back-link">Quay lại Dashboard</Link>
      </div>

      <p className="message">{message}</p>

      <div className="admin-forms">
        {/* Form tạo sân */}
        <div className="form-card">
          <h3>{editingCourt ? '✎ Chỉnh Sửa Sân' : '+ Tạo Sân Mới'}</h3>
          <form className="court-form" onSubmit={editingCourt ? handleUpdateCourt : handleCreateCourt}>
            <label className="court-field">
              Tên Sân
              <input
                type="text"
                placeholder="VD: Sân 1 - Côn Long"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required={!editingCourt}
              />
            </label>

            <label className="court-field">
              Loại Sân
              <input
                type="text"
                placeholder="VD: Sân trong nhà"
                value={formData.court_type}
                onChange={(e) => setFormData({ ...formData, court_type: e.target.value })}
                required={!editingCourt}
              />
            </label>

            <label className="court-field">
              Giờ Mở
              <input
                type="time"
                value={formData.open_time}
                onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
              />
            </label>

            <label className="court-field">
              Giờ Đóng
              <input
                type="time"
                value={formData.close_time}
                onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
              />
            </label>

            <label className="court-field">
              Giá Cơ Bản (VND)
              <input
                type="number"
                placeholder="100000"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                required={!editingCourt}
              />
              <small className="court-price-policy">
                Giá mới chỉ áp dụng cho slot trống từ thời điểm hiện tại trở đi. Booking đã tạo và dữ liệu lịch sử giữ nguyên giá đã ghi nhận.
              </small>
            </label>

            {editingCourt && (
              <>
                <label className="court-check">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Hoạt động
                </label>

                <label className="court-check">
                  <input
                    type="checkbox"
                    checked={formData.is_maintenance}
                    onChange={(e) => setFormData({ ...formData, is_maintenance: e.target.checked })}
                  />
                  🔧 Bảo trì / Sửa chữa
                </label>
              </>
            )}

            <div className="court-actions">
              <button type="submit">{editingCourt ? '💾 Lưu' : '➕ Tạo'}</button>
              {editingCourt && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCourt(null);
                    setFormData({
                      name: '',
                      court_type: '',
                      open_time: '06:00',
                      close_time: '22:00',
                      base_price: 0,
                      is_active: true,
                      is_maintenance: false
                    });
                  }}
                  className="court-cancel-btn"
                >
                  ✕ Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Danh sách sân */}
        <div className="form-card court-table-card">
          <h3>Danh Sách Sân ({courts.length})</h3>
          <div className="court-table-wrap">
          <table className="court-table">
            <thead>
              <tr>
                <th>Tên Sân</th>
                <th>Loại</th>
                <th>Giờ</th>
                <th>Giá (VND)</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id}>
                  <td><strong>{court.name}</strong></td>
                  <td>{court.court_type}</td>
                  <td>{court.open_time} - {court.close_time}</td>
                  <td>{court.base_price?.toLocaleString('vi-VN')}</td>
                  <td>
                    {court.is_maintenance ? (
                      <span className="court-state maintenance">🔧 Bảo trì</span>
                    ) : court.is_active ? (
                      <span className="court-state active">✓ Hoạt động</span>
                    ) : (
                      <span className="court-state stopped">✕ Dừng</span>
                    )}
                  </td>
                  <td>
                    <button className="court-edit-btn" onClick={() => startEdit(court)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}
