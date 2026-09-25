import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../services/api';
import AppSelect from '../components/ui/AppSelect';
import './StaffManagementPage.css';

const EMPTY_FORM = { full_name: '', email: '', phone: '', password: '', role: 'staff' };

function StaffForm({ editingId, form, onChange, onSubmit, onCancel }) {
  return (
    <section className="staff-form-card" aria-labelledby="staff-form-title">
      <div className="staff-section-heading">
        <div>
          <p className="staff-eyebrow">Tài khoản nội bộ</p>
          <h2 id="staff-form-title">{editingId ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}</h2>
        </div>
        <button type="button" className="btn-secondary" onClick={onCancel}>Đóng</button>
      </div>
      <form onSubmit={onSubmit} className="staff-form-grid">
        <label>Họ và tên<input value={form.full_name} onChange={(e) => onChange('full_name', e.target.value)} required /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => onChange('email', e.target.value)} required /></label>
        <label>Số điện thoại<input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} required /></label>
        <div className="staff-form-select-field"><span>Vai trò</span><AppSelect value={form.role} onChange={(value) => onChange('role', value)} options={[{ value: 'staff', label: 'Nhân viên' }, { value: 'admin', label: 'Quản trị viên' }]} ariaLabel="Vai trò" /></div>
        <label className="staff-form-password">Mật khẩu<input type="password" minLength={editingId ? undefined : 8} value={form.password} onChange={(e) => onChange('password', e.target.value)} required={!editingId} placeholder={editingId ? 'Để trống nếu không đổi' : 'Tối thiểu 8 ký tự'} /><small>{editingId ? 'Chỉ nhập khi cần thay đổi mật khẩu.' : 'Mật khẩu phải có ít nhất 8 ký tự.'}</small></label>
        <div className="staff-form-actions"><button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button><button type="submit" className="btn-primary">{editingId ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
      </form>
    </section>
  );
}

function StaffStats({ total, admins, staff }) {
  return <div className="staff-stats" aria-label="Thống kê nhân sự">
    <article><strong>{total}</strong><span>Tổng tài khoản</span></article>
    <article><strong>{staff}</strong><span>Nhân viên</span></article>
    <article><strong>{admins}</strong><span>Quản trị viên</span></article>
  </div>;
}

function StaffCard({ member, onEdit, onDelete }) {
  const roleLabel = member.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  return <article className="staff-card">
    <div className="staff-card-head"><div className={`staff-avatar ${member.role === 'admin' ? 'is-admin' : ''}`}>{(member.full_name || 'N').charAt(0).toUpperCase()}</div><div><h3>{member.full_name || 'Chưa cập nhật'}</h3><span>ID #{member.id}</span></div></div>
    <dl><div><dt>Email</dt><dd>{member.email || '-'}</dd></div><div><dt>Điện thoại</dt><dd>{member.phone || '-'}</dd></div><div><dt>Ngày tạo</dt><dd>{member.created_at ? new Date(member.created_at).toLocaleDateString('vi-VN') : '-'}</dd></div></dl>
    <div className="staff-card-footer"><span className={`role-pill ${member.role === 'admin' ? 'admin' : ''}`}>{roleLabel}</span><div><button type="button" className="btn-secondary" onClick={() => onEdit(member)}>Sửa</button><button type="button" className="btn-danger" onClick={() => onDelete(member)}>Xóa</button></div></div>
  </article>;
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadStaff() {
    setLoading(true);
    try { const res = await adminApi.listStaff(); setStaffList(res.data?.data || []); }
    catch { setMessage('Không tải được danh sách nhân viên.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadStaff(); }, []);

  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...staffList].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')).filter((item) => !term || [item.full_name, item.email, item.phone].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [staffList, searchTerm]);
  const stats = useMemo(() => ({ total: staffList.length, admins: staffList.filter((item) => item.role === 'admin').length, staff: staffList.filter((item) => item.role === 'staff').length }), [staffList]);

  function resetForm() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); }
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function startCreate() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }
  function startEdit(member) { setForm({ full_name: member.full_name || '', email: member.email || '', phone: member.phone || '', password: '', role: member.role || 'staff' }); setEditingId(member.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function handleSubmit(event) {
    event.preventDefault(); setMessage('');
    if (form.password && form.password.length < 8) { setMessage('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    try {
      if (editingId) {
        const payload = { full_name: form.full_name, email: form.email, phone: form.phone, role: form.role };
        if (form.password) payload.password = form.password;
        await adminApi.updateStaff(editingId, payload); setMessage('Cập nhật nhân viên thành công.');
      } else { await adminApi.createStaff(form); setMessage('Tạo nhân viên thành công.'); }
      resetForm(); await loadStaff();
    } catch (error) { setMessage(error?.response?.data?.error?.message || error?.message || 'Không thể lưu thông tin nhân viên.'); }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Xóa tài khoản "${member.full_name}"?`)) return;
    try { await adminApi.deleteStaff(member.id); setMessage('Đã xóa nhân viên.'); await loadStaff(); }
    catch { setMessage('Không thể xóa nhân viên.'); }
  }

  return <div className="admin-container staff-management-page">
    <div className="staff-page-heading"><div><p className="staff-eyebrow">Quản trị hệ thống</p><h1>Quản lý nhân viên</h1><p>Quản lý tài khoản nhân viên và quyền quản trị theo vai trò.</p></div><div><button type="button" className="btn-secondary" onClick={loadStaff} disabled={loading}>{loading ? 'Đang tải...' : 'Làm mới'}</button><button type="button" className="btn-primary" onClick={startCreate}>Thêm nhân viên</button></div></div>
    {message && <div className="alert" role="status">{message}<button type="button" onClick={() => setMessage('')} aria-label="Đóng thông báo">×</button></div>}
    {showForm && <StaffForm editingId={editingId} form={form} onChange={updateField} onSubmit={handleSubmit} onCancel={resetForm} />}
    <StaffStats {...stats} />
    <div className="staff-toolbar"><label htmlFor="staff-search">Tìm kiếm</label><input id="staff-search" type="search" placeholder="Tên, email hoặc số điện thoại" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><span>{filteredStaff.length} kết quả</span></div>
    {filteredStaff.length === 0 ? <div className="staff-empty">{loading ? 'Đang tải dữ liệu...' : 'Không có nhân viên phù hợp.'}</div> : <div className="staff-card-grid">{filteredStaff.map((member) => <StaffCard key={member.id} member={member} onEdit={startEdit} onDelete={handleDelete} />)}</div>}
  </div>;
}
