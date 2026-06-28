import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import CustomerPage from './pages/CustomerPage';
import AdminPage from './pages/AdminPage';
import AdminCheckinPage from './pages/AdminCheckinPage';
import AdminBookingDeskPage from './pages/AdminBookingDeskPage';
import StaffPage from './pages/StaffPage';
import LoginPage from './pages/LoginPage';
import CourtManagementPage from './pages/CourtManagementPage';
import BeverageManagementPage from './pages/BeverageManagementPage';
import DashboardRevenuePage from './pages/DashboardRevenuePage';
import StaffTransactionPage from './pages/StaffTransactionPage';
import BeverageCounterPage from './pages/BeverageCounterPage';
import StaffManagementPage from './pages/StaffManagementPage';

function getRole() {
  return localStorage.getItem('user_role') || '';
}

function isAuthed() {
  return Boolean(localStorage.getItem('access_token'));
}

function roleHome(role) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'staff':
      return '/staff';
    case 'customer':
      return '/customer';
    default:
      return '/login';
  }
}

function roleLabel(role) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    case 'customer':
      return 'Customer';
    default:
      return 'Guest';
  }
}

function ProtectedRoute({ roles, children }) {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }
  const role = getRole();
  if (!roles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />;
  }
  return children;
}

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthed();
  const role = getRole();
  const userName = localStorage.getItem('user_name') || '';

  function doLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('last_booking_day');
    navigate('/login', { replace: true });
  }
  
  // Ẩn nav khi ở trang login
  if (location.pathname === '/login') {
    return (
      <header className="top-nav">
        <div className="brand">
          <span className="brand-badge">BCM</span>
          <div>
            <h1>Badminton Court Management Platform</h1>
            <p>Operate smarter, book faster, earn better.</p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-badge">BCM</span>
        <div>
          <h1>Badminton Court Management Platform</h1>
          <p>Operate smarter, book faster, earn better.</p>
        </div>
      </div>
      <nav>
        {!authed ? (
          <>
            <Link className={location.pathname === '/login' ? 'active' : ''} to="/login">Portal Login</Link>
            <Link className={location.pathname === '/customer' ? 'active' : ''} to="/customer">Customer</Link>
            <Link className={location.pathname === '/staff' ? 'active' : ''} to="/staff">Staff</Link>
            <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">Admin</Link>
          </>
        ) : (
          <>
            {role === 'customer' ? <Link className={location.pathname === '/customer' ? 'active' : ''} to="/customer">Customer</Link> : null}
            {role === 'staff' ? <Link className={location.pathname === '/staff' ? 'active' : ''} to="/staff">Staff</Link> : null}
            {role === 'staff' ? <Link className={location.pathname.startsWith('/staff/beverage-counter') ? 'active' : ''} to="/staff/beverage-counter">Nước uống</Link> : null}
            {role === 'staff' ? <Link className={location.pathname.startsWith('/staff/transactions') ? 'active' : ''} to="/staff/transactions">Thu chi</Link> : null}
            {role === 'admin' ? <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">Admin</Link> : null}
            {role === 'admin' ? <Link className={location.pathname.startsWith('/admin/booking-desk') || location.pathname.startsWith('/admin/bookings') ? 'active' : ''} to="/admin/booking-desk">Booking</Link> : null}
            {role === 'admin' ? <Link className={location.pathname.startsWith('/admin/checkin') ? 'active' : ''} to="/admin/checkin">Check-in</Link> : null}
            <span className="account-chip">{userName || 'Tài khoản'} ({roleLabel(role)})</span>
            <button type="button" className="nav-logout-btn" onClick={doLogout}>Đăng xuất</button>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <TopNav />
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route
            path="/staff"
            element={(
              <ProtectedRoute roles={['staff']}>
                <StaffPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/staff/beverage-counter"
            element={(
              <ProtectedRoute roles={['staff']}>
                <BeverageCounterPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/staff/transactions"
            element={(
              <ProtectedRoute roles={['staff']}>
                <StaffTransactionPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin"
            element={(
              <ProtectedRoute roles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/bookings"
            element={<Navigate to="/admin/booking-desk" replace />}
          />
          <Route
            path="/admin/checkin"
            element={(
              <ProtectedRoute roles={['admin']}>
                <AdminCheckinPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/booking-desk"
            element={(
              <ProtectedRoute roles={['admin']}>
                <AdminBookingDeskPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/courts"
            element={(
              <ProtectedRoute roles={['admin']}>
                <CourtManagementPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/revenue"
            element={(
              <ProtectedRoute roles={['admin']}>
                <DashboardRevenuePage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/staff"
            element={(
              <ProtectedRoute roles={['admin']}>
                <StaffManagementPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/beverages"
            element={(
              <ProtectedRoute roles={['admin']}>
                <BeverageManagementPage />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}
