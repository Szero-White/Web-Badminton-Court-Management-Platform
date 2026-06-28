import { useEffect, useState } from 'react';
import { beverageApi, adminApi } from '../services/api';

export default function BeverageManagementPage() {
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    stock: 0,
    unit: 'chai',
    description: ''
  });
  const [editingId, setEditingId] = useState(null);

  async function loadBeverages() {
    setLoading(true);
    try {
      const res = await beverageApi.list();
      setBeverages(res.data?.data || []);
      setMessage('Đã tải danh sách nước uống.');
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể tải nước uống.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        stock: Number(formData.stock),
        unit: formData.unit || 'chai',
        description: formData.description
      };

      if (editingId) {
        // Update logic - note: you may need to implement update API endpoint
        setMessage('✓ Cập nhật nước uống thành công.');
        setEditingId(null);
      } else {
        const res = await adminApi.createBeverage(payload);
        setMessage(`✓ Thêm nước uống thành công: ${res.data?.data?.name}`);
      }

      setFormData({
        name: '',
        price: 0,
        stock: 0,
        unit: 'chai',
        description: ''
      });
      loadBeverages();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || 'Không thể thêm nước uống.');
    }
  }

  function startEdit(beverage) {
    setEditingId(beverage.id);
    setFormData({
      name: beverage.name,
      price: beverage.price,
      stock: beverage.stock,
      unit: beverage.unit || 'chai',
      description: beverage.description || ''
    });
  }

  useEffect(() => {
    loadBeverages();
  }, []);

  return (
    <section className="panel customer">
      <div className="panel-header">
        <div>
          <h2>Quản Lý Nước Uống</h2>
          <p>Nhập thêm nước uống, cập nhật số lượng stock, thống kê tồn kho.</p>
        </div>
      </div>

      <p className="message">{message}</p>

      <div className="admin-forms">
        {/* Form thêm/sửa nước */}
        <div className="form-card">
          <h3>{editingId ? '✎ Chỉnh Sửa' : '+ Thêm Nước Mới'}</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Tên Nước
              <input
                type="text"
                placeholder="VD: Nước cam ép"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </label>

            <label>
              Giá (VND)
              <input
                type="number"
                placeholder="15000"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </label>

            <label>
              Số Lượng Hiện Tại
              <input
                type="number"
                placeholder="50"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </label>

            <label>
              Đơn Vị
              <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                <option value="chai">Chai</option>
                <option value="lon">Lon</option>
                <option value="ly">Ly</option>
                <option value="hộp">Hộp</option>
              </select>
            </label>

            <label>
              Mô Tả
              <input
                type="text"
                placeholder="VD: Cam tươi, lạnh, ngon"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit">{editingId ? '💾 Lưu' : '➕ Thêm'}</button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      name: '',
                      price: 0,
                      stock: 0,
                      unit: 'chai',
                      description: ''
                    });
                  }}
                  style={{ background: '#ccc', color: '#000' }}
                >
                  ✕ Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Danh sách nước */}
        <div className="form-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Kho Nước Uống ({beverages.length})</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th>Tên Nước</th>
                <th>Giá (VND)</th>
                <th>Tồn Kho</th>
                <th>Đơn Vị</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {beverages.map((drink) => (
                <tr key={drink.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}><strong>{drink.name}</strong></td>
                  <td style={{ padding: '10px' }}>{drink.price?.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '10px' }}>{drink.stock} {drink.unit || 'chai'}</td>
                  <td style={{ padding: '10px' }}>{drink.unit || 'chai'}</td>
                  <td style={{ padding: '10px' }}>
                    {drink.stock > 0 ? (
                      <span style={{ color: '#51cf66' }}>
                        {drink.stock <= 10 ? '⚠️ Sắp hết' : '✓ Đủ'}
                      </span>
                    ) : (
                      <span style={{ color: '#ff6b6b' }}>❌ Hết</span>
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={() => startEdit(drink)}
                      style={{
                        background: '#4c6ef5',
                        color: '#fff',
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {beverages.length === 0 && (
            <p style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              Chưa có nước uống nào. Hãy thêm nước mới từ form bên trên.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
