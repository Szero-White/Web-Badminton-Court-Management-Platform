import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../services/api';

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    color: '#1d7471',
    marginBottom: '20px',
    fontSize: '28px',
    fontWeight: '600'
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  alertSuccess: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #a5d6a7'
  },
  alertError: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a'
  },
  button: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  btnPrimary: {
    backgroundColor: '#1d7471',
    color: 'white'
  },
  btnSecondary: {
    backgroundColor: '#e0e0e0',
    color: '#333',
    marginLeft: '10px'
  },
  btnEdit: {
    backgroundColor: '#ff8a3d',
    color: 'white',
    padding: '6px 12px',
    fontSize: '12px',
    marginRight: '5px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer'
  },
  btnDelete: {
    backgroundColor: '#c62828',
    color: 'white',
    padding: '6px 12px',
    fontSize: '12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer'
  },
  formSection: {
    backgroundColor: '#f5f5f5',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '30px'
  },
  formRow: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    marginBottom: '6px',
    color: '#555',
    fontWeight: '500',
    fontSize: '14px'
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  tableSection: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  tableHeader: {
    fontSize: '20px',
    marginBottom: '16px',
    color: '#333'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #ddd',
    color: '#666',
    fontWeight: '600',
    fontSize: '14px'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #eee',
    fontSize: '14px'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  badgeAdmin: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2'
  },
  badgeStaff: {
    backgroundColor: '#e8f5e9',
    color: '#388e3c'
  },
  searchContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  searchInput: {
    flex: 1,
    minWidth: '280px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid #e0e0e0',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.3s ease'
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px'
  },
  staffCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    transition: 'all 0.3s ease',
    border: '1px solid #f0f0f0',
    position: 'relative',
    overflow: 'hidden'
  },
  staffCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.15)'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px'
  },
  avatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: 'white',
    fontWeight: '600',
    flexShrink: 0
  },
  avatarAdmin: {
    background: 'linear-gradient(135deg, #ff8a3d 0%, #ff6b35 100%)'
  },
  staffInfo: {
    flex: 1,
    minWidth: 0
  },
  staffName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  staffId: {
    fontSize: '12px',
    color: '#888'
  },
  cardBody: {
    marginBottom: '20px'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f5f5f5'
  },
  infoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#f8f9fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  },
  infoText: {
    fontSize: '14px',
    color: '#555'
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid #f0f0f0'
  },
  roleBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  roleAdmin: {
    background: 'linear-gradient(135deg, #ff8a3d 0%, #ff6b35 100%)',
    color: 'white'
  },
  roleStaff: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px'
  },
  btnIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    transition: 'all 0.2s ease'
  },
  btnEditIcon: {
    background: '#fff3e0',
    color: '#ff8a3d'
  },
  btnDeleteIcon: {
    background: '#ffebee',
    color: '#c62828'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#888'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '18px',
    marginBottom: '8px',
    color: '#666'
  },
  statsBar: {
    display: 'flex',
    gap: '24px',
    marginBottom: '24px',
    padding: '16px 20px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333'
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }
};

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff'
  });

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await adminApi.listStaff();
      setStaffList(res.data?.data || []);
    } catch (e) {
      setMessage('Không tải được danh sách nhân viên.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    try {
      if (editingId) {
        const updateData = {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          role: form.role
        };
        if (form.password && form.password.length >= 6) {
          updateData.password = form.password;
        }
        await adminApi.updateStaff(editingId, updateData);
        setMessage('Đã cập nhật nhân viên!' + (form.password ? ' (Mật khẩu đã thay đổi)' : ''));
      } else {
        if (!form.password || form.password.length < 6) {
          setMessage('Mật khẩu phải có ít nhất 6 ký tự');
          return;
        }
        await adminApi.createStaff(form);
        setMessage('Đã tạo nhân viên mới!');
      }
      resetForm();
      loadStaff();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Có lỗi xảy ra';
      setMessage(msg);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Xóa nhân viên "${name}"?`)) return;
    try {
      await adminApi.deleteStaff(id);
      setMessage('Đã xóa nhân viên!');
      loadStaff();
    } catch (err) {
      setMessage('Không thể xóa nhân viên.');
    }
  }

  function startEdit(staff) {
    setEditingId(staff.id);
    setForm({
      full_name: staff.full_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      password: '',
      role: staff.role || 'staff'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const filteredStaff = useMemo(() => {
    let result = [...staffList].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        (s.full_name || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.phone || '').includes(term)
      );
    }
    return result;
  }, [staffList, searchTerm]);

  const stats = useMemo(() => {
    const total = staffList.length;
    const admins = staffList.filter(s => s.role === 'admin').length;
    const staff = total - admins;
    return { total, admins, staff };
  }, [staffList]);

  return (
    <div className="admin-container">
      <h1>Quản Lý Nhân Viên</h1>

      {message && (
        <div className={`alert ${message.includes('!') ? 'alert-success' : 'alert-error'}`}>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: 10 }}>×</button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Ẩn Form' : (editingId ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên Mới')}
        </button>
        <button
          className="btn-secondary"
          onClick={loadStaff}
          style={{ marginLeft: 10 }}
          disabled={loading}
        >
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '2px',
          marginBottom: '30px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '18px',
            padding: '32px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: editingId ? 'linear-gradient(135deg, #ff8a3d 0%, #ff6b35 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
                fontSize: '24px'
              }}>
                {editingId ? '✏️' : '👤'}
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '600',
                  color: '#333'
                }}>
                  {editingId ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên Mới'}
                </h2>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {editingId ? 'Cập nhật thông tin nhân viên' : 'Nhập thông tin để tạo tài khoản mới'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '24px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    <span style={{ marginRight: '6px' }}>👤</span> Họ và tên
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                    placeholder="Nhập họ tên đầy đủ"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    <span style={{ marginRight: '6px' }}>📧</span> Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    placeholder="email@example.com"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    <span style={{ marginRight: '6px' }}>📱</span> Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    placeholder="0xxxxxxxxxx"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    <span style={{ marginRight: '6px' }}>🛡️</span> Vai trò
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      fontSize: '15px',
                      outline: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="staff">👨‍💼 Nhân viên</option>
                    <option value="admin">👑 Quản trị viên</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    <span style={{ marginRight: '6px' }}>🔐</span> Mật khẩu {editingId && <span style={{color: '#888', fontWeight: '400'}}>(để trống nếu không đổi)</span>}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editingId}
                    minLength={editingId ? undefined : 6}
                    placeholder={editingId ? "Nhập mật khẩu mới (tùy chọn)" : "Tối thiểu 6 ký tự"}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                  <p style={{
                    margin: '6px 0 0 0',
                    fontSize: '12px',
                    color: '#888'
                  }}>
                    {editingId
                      ? '💡 Để trống nếu không muốn thay đổi mật khẩu'
                      : '⚠️ Mật khẩu phải có ít nhất 6 ký tự'}
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '20px',
                borderTop: '2px solid #f0f0f0'
              }}>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      padding: '14px 28px',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      background: 'white',
                      color: '#666',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f5f5f5';
                      e.target.style.borderColor = '#ccc';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'white';
                      e.target.style.borderColor = '#e0e0e0';
                    }}
                  >
                    ❌ Hủy bỏ
                  </button>
                )}
                <button
                  type="submit"
                  style={{
                    padding: '14px 32px',
                    borderRadius: '12px',
                    border: 'none',
                    background: editingId
                      ? 'linear-gradient(135deg, #ff8a3d 0%, #ff6b35 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  {editingId ? '💾 Lưu thay đổi' : '✨ Tạo nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <div style={{...styles.statIcon, background: '#e3f2fd'}}>👥</div>
          <div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Tổng nhân viên</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{...styles.statIcon, background: '#fff3e0'}}>👑</div>
          <div>
            <div style={styles.statValue}>{stats.admins}</div>
            <div style={styles.statLabel}>Quản trị viên</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{...styles.statIcon, background: '#e8f5e9'}}>👨‍💼</div>
          <div>
            <div style={styles.statValue}>{stats.staff}</div>
            <div style={styles.statLabel}>Nhân viên</div>
          </div>
        </div>
      </div>

      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="🔍 Tìm kiếm theo tên, email hoặc số điện thoại..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
          onFocus={(e) => e.target.style.borderColor = '#667eea'}
          onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
        />
        <button
          className="btn-secondary"
          onClick={() => setSearchTerm('')}
          disabled={!searchTerm}
        >
          ✕ Xóa
        </button>
      </div>

      <div className="table-section">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Danh sách Nhân viên
          <span style={{
            background: '#f0f0f0',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#666'
          }}>
            {filteredStaff.length}
          </span>
        </h2>

        {filteredStaff.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <div style={styles.emptyText}>
              {searchTerm ? 'Không tìm thấy nhân viên nào' : 'Chưa có nhân viên nào'}
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Nhấn "Thêm Nhân viên Mới" để bắt đầu'}
            </p>
          </div>
        ) : (
          <div style={styles.cardGrid}>
            {filteredStaff.map((staff) => (
              <div
                key={staff.id}
                style={styles.staffCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = styles.staffCardHover.transform;
                  e.currentTarget.style.boxShadow = styles.staffCardHover.boxShadow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = styles.staffCard.boxShadow;
                }}
              >
                <div style={styles.cardHeader}>
                  <div style={{
                    ...styles.avatar,
                    ...(staff.role === 'admin' ? styles.avatarAdmin : {})
                  }}>
                    {(staff.full_name || 'N').charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.staffInfo}>
                    <div style={styles.staffName} title={staff.full_name}>
                      {staff.full_name || 'Chưa cập nhật'}
                    </div>
                    <div style={styles.staffId}>ID: #{staff.id}</div>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.infoRow}>
                    <div style={styles.infoIcon}>📧</div>
                    <div style={styles.infoText}>{staff.email || 'Chưa cập nhật'}</div>
                  </div>
                  <div style={styles.infoRow}>
                    <div style={styles.infoIcon}>📱</div>
                    <div style={styles.infoText}>{staff.phone || 'Chưa cập nhật'}</div>
                  </div>
                  <div style={styles.infoRow}>
                    <div style={styles.infoIcon}>📅</div>
                    <div style={styles.infoText}>
                      Tham gia: {new Date(staff.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>

                <div style={styles.cardFooter}>
                  <span style={{
                    ...styles.roleBadge,
                    ...(staff.role === 'admin' ? styles.roleAdmin : styles.roleStaff)
                  }}>
                    {staff.role === 'admin' ? '👑 Admin' : '👨‍💼 Nhân viên'}
                  </span>
                  <div style={styles.actionButtons}>
                    <button
                      style={{...styles.btnIcon, ...styles.btnEditIcon}}
                      onClick={() => startEdit(staff)}
                      title="Chỉnh sửa"
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.1)';
                        e.target.style.background = '#ffe0b2';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.background = styles.btnEditIcon.background;
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      style={{...styles.btnIcon, ...styles.btnDeleteIcon}}
                      onClick={() => handleDelete(staff.id, staff.full_name)}
                      title="Xóa"
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.1)';
                        e.target.style.background = '#ffcdd2';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.background = styles.btnDeleteIcon.background;
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
