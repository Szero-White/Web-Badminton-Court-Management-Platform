import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const PORTALS = {
  admin: { title: 'Quản trị viên', description: 'Quản lý sân, nhân sự, doanh thu và cấu hình hệ thống.', route: '/admin' },
  staff: { title: 'Nhân viên', description: 'Vận hành quầy, booking, check-in, đồ uống và thu chi.', route: '/staff' },
  customer: { title: 'Khách hàng', description: 'Đăng nhập để giữ chỗ, đặt sân và quản lý booking.', route: '/customer' }
};

const DEMO_ACCOUNTS = {
  admin: { email: 'admin@badminton.demo', password: 'Admin@12345' },
  staff: { email: 'staff@badminton.demo', password: 'Staff@12345' },
  customer: { email: 'customer@badminton.demo', password: 'Customer@12345' }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState('');
  const [customerMode, setCustomerMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function selectPortal(role) {
    setPortal(role);
    setCustomerMode('login');
    setForm({ fullName: '', phone: '', email: '', password: '' });
    setMessage('');
  }

  function saveSession(data) {
    localStorage.setItem('access_token', data.tokens.access_token);
    localStorage.setItem('refresh_token', data.tokens.refresh_token || '');
    localStorage.setItem('user_role', data.user.role);
    localStorage.setItem('user_name', data.user.full_name || '');
  }

  async function loginWithCredentials(role, email, password) {
    const response = await authApi.login({ email: email.trim(), password });
    const data = response.data?.data;
    if (!data?.tokens?.access_token || !data?.user?.role) throw new Error('Phản hồi đăng nhập không hợp lệ.');
    if (data.user.role !== role) throw new Error(`Tài khoản này không thuộc vai trò ${PORTALS[role].title.toLowerCase()}.`);
    saveSession(data);
    navigate(PORTALS[role].route, { replace: true });
  }

  async function login() {
    await loginWithCredentials(portal, form.email, form.password);
  }

  function fillDemoAccount() {
    const account = DEMO_ACCOUNTS[portal];
    setForm({ ...form, email: account.email, password: account.password });
    setMessage('');
  }

  async function quickDemoLogin() {
    const account = DEMO_ACCOUNTS[portal];
    setLoading(true);
    setMessage('');
    setForm({ ...form, email: account.email, password: account.password });
    try {
      await loginWithCredentials(portal, account.email, account.password);
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || error?.message || 'Không thể đăng nhập tài khoản demo.');
    } finally {
      setLoading(false);
    }
  }

  async function registerCustomer() {
    if (!form.fullName.trim() || !form.phone.trim()) throw new Error('Vui lòng nhập họ tên và số điện thoại.');
    await authApi.register({ full_name: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(), password: form.password, role: 'customer' });
    await login();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password.length < 8) { setMessage('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setLoading(true); setMessage('');
    try {
      if (portal === 'customer' && customerMode === 'register') await registerCustomer(); else await login();
    } catch (error) {
      setMessage(error?.response?.data?.error?.message || error?.message || 'Không thể xác thực tài khoản.');
    } finally { setLoading(false); }
  }

  if (!portal) {
    return <section className="login-container">
      <div className="login-hero"><h1>Badminton Court Management</h1><p>Nền tảng quản lý sân cầu lông và đặt lịch tập trung</p></div>
      <div className="portal-grid">
        {Object.entries(PORTALS).map(([role, item]) => <article key={role} className={`portal-card ${role}-card`}>
          <h3>{item.title}</h3><p>{item.description}</p><button type="button" className="portal-btn" onClick={() => selectPortal(role)}>Đăng nhập {item.title.toLowerCase()}</button>
          {role === 'customer' && <button type="button" className="portal-secondary-btn" onClick={() => navigate('/customer')}>Xem lịch sân không cần đăng nhập</button>}
        </article>)}
      </div>
      <footer className="login-footer"><p>© 2026 Badminton Court Management Platform</p></footer>
    </section>;
  }

  const current = PORTALS[portal];
  const registering = portal === 'customer' && customerMode === 'register';
  return <section className="login-container">
    <div className="login-form-wrapper">
      <button type="button" className="back-btn" onClick={() => setPortal('')}>← Quay lại</button>
      <div className="login-form-header"><h2>{registering ? 'Tạo tài khoản khách hàng' : `Đăng nhập ${current.title.toLowerCase()}`}</h2><p>{current.description}</p></div>
      {message && <div className="login-message" role="alert">{message}</div>}
      <form onSubmit={handleSubmit} className="login-form">
        {registering && <><label>Họ và tên<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label><label>Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label></>}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required /></label>
        <label>Mật khẩu<input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={registering ? 'new-password' : 'current-password'} required /></label>
        <button type="submit" disabled={loading} className="submit-btn">{loading ? 'Đang xử lý...' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
      </form>
      {portal === 'customer' && <button type="button" className="login-mode-switch" onClick={() => { setCustomerMode(registering ? 'login' : 'register'); setMessage(''); }}>{registering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}</button>}
      {!registering && <div className="demo-tip">
        <div className="demo-tip-copy">
          <strong>Tài khoản demo</strong>
          <span>{DEMO_ACCOUNTS[portal].email} / {DEMO_ACCOUNTS[portal].password}</span>
        </div>
        <div className="demo-tip-actions">
          <button type="button" className="demo-fill-btn" onClick={fillDemoAccount} disabled={loading}>Điền tài khoản</button>
          <button type="button" className="demo-login-btn" onClick={quickDemoLogin} disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập demo'}</button>
        </div>
      </div>}
    </div>
  </section>;
}
