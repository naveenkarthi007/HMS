import { Navigate, Outlet } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../context/AuthContext';
import { usePlatformView } from '../context/PlatformViewContext';

/**
 * Only renders children for the allowed roles; others are sent to their own home page.
 * With `platformView`, a super admin may also enter once they have picked an organisation to view.
 */
export default function RoleRoute({ roles, platformView = false }) {
  const { user } = useAuth();
  const { org } = usePlatformView();
  if (!user) return <Navigate to="/login" replace />;
  if (platformView && user.role === 'super_admin') {
    return org ? <Outlet /> : <Navigate to="/super/organisations" replace />;
  }
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return <Outlet />;
}
