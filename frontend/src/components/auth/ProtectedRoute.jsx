import { Navigate } from 'react-router-dom';

export function getRole() { return localStorage.getItem('user_role') || ''; }
export function isAuthenticated() { return Boolean(localStorage.getItem('access_token')); }
export function roleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  if (role === 'customer') return '/customer';
  return '/login';
}

export default function ProtectedRoute({ roles, children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const role = getRole();
  return roles.includes(role) ? children : <Navigate to={roleHome(role)} replace />;
}
