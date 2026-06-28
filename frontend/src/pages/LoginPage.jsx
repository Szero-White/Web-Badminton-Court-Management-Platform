import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('portal-selector'); // 'portal-selector' | 'admin-login' | 'staff-login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(portal) {
    setLoading(true);
    setMessage('');
    try {
      const res = await authApi.login({ email, password });
      const data = res.data?.data;
      const token = data?.tokens?.access_token;
      const role = data?.user?.role;

      if (!token || !role) {
        setMessage('Thiếu dữ liệu token hoặc role.');
        setLoading(false);
        return;
      }

      // Validation: role must match selected portal
      if (portal === 'admin' && role !== 'admin') {
        setMessage('❌ Tài khoản này không phải Admin/Owner.');
        setLoading(false);
        return;
      }
      if (portal === 'staff' && role !== 'staff') {
        setMessage('❌ Tài khoản này không phải Staff.');
        setLoading(false);
        return;
      }

      // Lưu token và role vào localStorage
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', data?.tokens?.refresh_token || '');
      localStorage.setItem('user_role', role);
      localStorage.setItem('user_name', data?.user?.full_name || '');

      // Chuyển hướng đúng trang
      if (portal === 'admin') navigate('/admin');
      else if (portal === 'staff') navigate('/staff');
    } catch (error) {
      setMessage('❌ ' + (error?.response?.data?.error?.message || 'Đăng nhập thất bại.'));
    } finally {
      setLoading(false);
    }
  }

  // Portal Selector View - trang chính
  if (view === 'portal-selector') {
    return (
      <section className="login-container">
        <div className="login-hero">
          <h1>🏸 Badminton Court Management</h1>
          <p>Quản lý sân cầu lông thông minh</p>
        </div>

        <div className="portal-grid">
          <div className="portal-card admin-card" onClick={() => setView('admin-login')}>
            <div className="portal-icon">👨‍💼</div>
            <h3>Admin / Owner</h3>
            <p>Tạo staff, quản lý sân, sinh slot, cấu hình đồ uống</p>
            <button className="portal-btn">Đăng nhập Admin</button>
          </div>

          <div className="portal-card staff-card" onClick={() => setView('staff-login')}>
            <div className="portal-icon">👤</div>
            <h3>Staff</h3>
            <p>Vận hành tại quầy, check-in khách, hoàn thành lịch, tính tiền</p>
            <button className="portal-btn">Đăng nhập Staff</button>
          </div>

          <div className="portal-card customer-card" onClick={() => navigate('/customer')}>
            <div className="portal-icon">🎯</div>
            <h3>Khách Hàng</h3>
            <p>Xem sân khách hàng, đặt sân cầu lông trực tiếp</p>
            <button className="portal-btn">Xem Sân (Không cần đăng nhập)</button>
          </div>
        </div>

        <footer className="login-footer">
          <p>© 2024 - Badminton Court Management System</p>
        </footer>
      </section>
    );
  }

  // Admin Login View
  if (view === 'admin-login') {
    return (
      <section className="login-container">
        <div className="login-form-wrapper">
          <button className="back-btn" onClick={() => { setView('portal-selector'); setEmail(''); setPassword(''); setMessage(''); }}>
            ← Quay lại
          </button>

          <div className="login-form-header">
            <h2>👨‍💼 Đăng nhập Admin</h2>
            <p>Chỉ dành cho Owner/Admin quản lý hệ thống</p>
          </div>

          {message && <div className="login-message">{message}</div>}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin('admin'); }} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bcm.local"
                disabled={loading}
                required
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </label>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Đang đăng nhập...' : '✓ Đăng nhập'}
            </button>
          </form>

          <div className="demo-tip">
            <strong>Demo:</strong> admin@bcm.local / Admin@123
          </div>
        </div>
      </section>
    );
  }

  // Staff Login View
  if (view === 'staff-login') {
    return (
      <section className="login-container">
        <div className="login-form-wrapper">
          <button className="back-btn" onClick={() => { setView('portal-selector'); setEmail(''); setPassword(''); setMessage(''); }}>
            ← Quay lại
          </button>

          <div className="login-form-header">
            <h2>👤 Đăng nhập Staff</h2>
            <p>Nhân viên vận hành tại quầy</p>
          </div>

          {message && <div className="login-message">{message}</div>}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin('staff'); }} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@bcm.local"
                disabled={loading}
                required
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </label>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? '⏳ Đang đăng nhập...' : '✓ Đăng nhập'}
            </button>
          </form>

          <div className="demo-tip">
            <strong>Demo:</strong> staff@bcm.local / Staff@123
          </div>
        </div>
      </section>
    );
  }
}
