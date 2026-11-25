import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../components/layout/AppLayout';
import { ROLE_HOME, useAuth } from '../context/AuthContext';

import LoginPage from '../pages/auth/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';

import SuperAdminDashboardPage from '../pages/super-admin/SuperAdminDashboardPage';
import OrganisationsPage from '../pages/super-admin/OrganisationsPage';

import AdminDashboardPage from '../pages/admin/DashboardPage';
import HostelsPage from '../pages/admin/HostelsPage';
import RoomsPage from '../pages/admin/RoomsPage';
import StudentsPage from '../pages/admin/StudentsPage';
import AllocationsPage from '../pages/admin/AllocationsPage';
import WardensPage from '../pages/admin/WardensPage';
import HostelManagersPage from '../pages/admin/HostelManagersPage';
import ComplaintsPage from '../pages/admin/ComplaintsPage';
import LeavesPage from '../pages/admin/LeavesPage';
import AttendancePage from '../pages/admin/AttendancePage';
import NoticesPage from '../pages/admin/NoticesPage';
import MessPage from '../pages/admin/MessPage';
import ApplicationsPage from '../pages/admin/ApplicationsPage';
import OutingsPage from '../pages/admin/OutingsPage';

import WardenDashboardPage from '../pages/warden/WardenDashboardPage';
import WardenStudentsPage from '../pages/warden/WardenStudentsPage';
import WardenAttendancePage from '../pages/warden/WardenAttendancePage';
import WardenLeavesPage from '../pages/warden/WardenLeavesPage';
import WardenComplaintsPage from '../pages/warden/WardenComplaintsPage';
import WardenNoticesPage from '../pages/warden/WardenNoticesPage';
import WardenMessPage from '../pages/warden/WardenMessPage';
import WardenOutingsPage from '../pages/warden/WardenOutingsPage';

import StudentHomePage from '../pages/student/StudentHomePage';
import MyComplaintsPage from '../pages/student/MyComplaintsPage';
import MyLeavesPage from '../pages/student/MyLeavesPage';
import MyAttendancePage from '../pages/student/MyAttendancePage';
import StudentNoticesPage from '../pages/student/StudentNoticesPage';
import ProfilePage from '../pages/student/ProfilePage';
import StudentMessPage from '../pages/student/StudentMessPage';
import HostelBookingPage from '../pages/student/HostelBookingPage';
import MyOutingsPage from '../pages/student/MyOutingsPage';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={ROLE_HOME[user?.role] || '/login'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          <Route element={<RoleRoute roles={['super_admin']} />}>
            <Route path="/super/dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="/super/organisations" element={<OrganisationsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['org_admin']} platformView />}>
            <Route path="/admin/hostel-managers" element={<HostelManagersPage />} />
          </Route>

          <Route element={<RoleRoute roles={['org_admin', 'boys_hostel_manager', 'girls_hostel_manager']} platformView />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/hostels" element={<HostelsPage />} />
            <Route path="/admin/rooms" element={<RoomsPage />} />
            <Route path="/admin/students" element={<StudentsPage />} />
            <Route path="/admin/allocations" element={<AllocationsPage />} />
            <Route path="/admin/wardens" element={<WardensPage />} />
            <Route path="/admin/complaints" element={<ComplaintsPage />} />
            <Route path="/admin/leaves" element={<LeavesPage />} />
            <Route path="/admin/attendance" element={<AttendancePage />} />
            <Route path="/admin/notices" element={<NoticesPage />} />
            <Route path="/admin/mess" element={<MessPage />} />
            <Route path="/admin/applications" element={<ApplicationsPage />} />
            <Route path="/admin/outings" element={<OutingsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['warden']} />}>
            <Route path="/warden/dashboard" element={<WardenDashboardPage />} />
            <Route path="/warden/students" element={<WardenStudentsPage />} />
            <Route path="/warden/attendance" element={<WardenAttendancePage />} />
            <Route path="/warden/leaves" element={<WardenLeavesPage />} />
            <Route path="/warden/complaints" element={<WardenComplaintsPage />} />
            <Route path="/warden/notices" element={<WardenNoticesPage />} />
            <Route path="/warden/mess" element={<WardenMessPage />} />
            <Route path="/warden/outings" element={<WardenOutingsPage />} />
          </Route>

          <Route element={<RoleRoute roles={['student']} />}>
            <Route path="/student/home" element={<StudentHomePage />} />
            <Route path="/student/complaints" element={<MyComplaintsPage />} />
            <Route path="/student/leaves" element={<MyLeavesPage />} />
            <Route path="/student/attendance" element={<MyAttendancePage />} />
            <Route path="/student/notices" element={<StudentNoticesPage />} />
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route path="/student/mess" element={<StudentMessPage />} />
            <Route path="/student/booking" element={<HostelBookingPage />} />
            <Route path="/student/outings" element={<MyOutingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
