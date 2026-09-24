import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import CustomerPage from '../pages/CustomerPage';
import AdminPage from '../pages/AdminPage';
import AdminCheckinPage from '../pages/AdminCheckinPage';
import AdminBookingDeskPage from '../pages/AdminBookingDeskPage';
import StaffPage from '../pages/StaffPage';
import LoginPage from '../pages/LoginPage';
import CourtManagementPage from '../pages/CourtManagementPage';
import BeverageManagementPage from '../pages/BeverageManagementPage';
import DashboardRevenuePage from '../pages/DashboardRevenuePage';
import StaffTransactionPage from '../pages/StaffTransactionPage';
import BeverageCounterPage from '../pages/BeverageCounterPage';
import StaffManagementPage from '../pages/StaffManagementPage';

const protectedPage = (roles, page) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;
export default function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/customer" element={<CustomerPage />} />
    <Route path="/staff" element={protectedPage(['staff'], <StaffPage />)} />
    <Route path="/staff/beverage-counter" element={protectedPage(['staff'], <BeverageCounterPage />)} />
    <Route path="/staff/transactions" element={protectedPage(['staff'], <StaffTransactionPage />)} />
    <Route path="/admin" element={protectedPage(['admin'], <AdminPage />)} />
    <Route path="/admin/bookings" element={<Navigate to="/admin/booking-desk" replace />} />
    <Route path="/admin/checkin" element={protectedPage(['admin'], <AdminCheckinPage />)} />
    <Route path="/admin/booking-desk" element={protectedPage(['admin'], <AdminBookingDeskPage />)} />
    <Route path="/admin/courts" element={protectedPage(['admin'], <CourtManagementPage />)} />
    <Route path="/admin/revenue" element={protectedPage(['admin'], <DashboardRevenuePage />)} />
    <Route path="/admin/staff" element={protectedPage(['admin'], <StaffManagementPage />)} />
    <Route path="/admin/beverages" element={protectedPage(['admin'], <BeverageManagementPage />)} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
