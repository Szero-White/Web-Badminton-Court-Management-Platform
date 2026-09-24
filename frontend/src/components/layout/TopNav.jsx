import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession } from '../../services/api/httpClient';
import { getRole, isAuthenticated } from '../auth/ProtectedRoute';

const ROLE_LABEL = { admin: 'Quản trị viên', staff: 'Nhân viên', customer: 'Khách hàng' };
function NavLink({ to, active, children }) { return <Link className={active ? 'active' : ''} to={to}>{children}</Link>; }

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const role = getRole();
  const userName = localStorage.getItem('user_name') || 'Tài khoản';
  const isPath = (prefix) => location.pathname.startsWith(prefix);

  const logout = () => { clearAuthSession(); navigate('/login', { replace: true }); };
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-badge">BCM</span>
        <div><h1>Badminton Court Management Platform</h1><p>Quản lý sân, đặt lịch và vận hành tập trung.</p></div>
      </div>
      {location.pathname !== '/login' && (
        <nav>
          {!authed && <NavLink to="/login" active={isPath('/login')}>Đăng nhập</NavLink>}
          {role === 'customer' && <NavLink to="/customer" active={isPath('/customer')}>Đặt sân</NavLink>}
          {role === 'staff' && <><NavLink to="/staff" active={location.pathname === '/staff'}>Vận hành</NavLink><NavLink to="/staff/beverage-counter" active={isPath('/staff/beverage-counter')}>Quầy nước</NavLink><NavLink to="/staff/transactions" active={isPath('/staff/transactions')}>Thu chi</NavLink></>}
          {role === 'admin' && <><NavLink to="/admin" active={location.pathname === '/admin'}>Tổng quan</NavLink><NavLink to="/admin/booking-desk" active={isPath('/admin/booking')}>Đặt sân</NavLink><NavLink to="/admin/checkin" active={isPath('/admin/checkin')}>Check-in</NavLink></>}
          {authed && <><span className="account-chip">{userName} ({ROLE_LABEL[role] || role})</span><button type="button" className="nav-logout-btn" onClick={logout}>Đăng xuất</button></>}
        </nav>
      )}
    </header>
  );
}
