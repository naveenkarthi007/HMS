import { useAuth } from '../context/AuthContext';
import { usePlatformView } from '../context/PlatformViewContext';

const MANAGER_GENDER = {
  boys_hostel_manager: 'male',
  girls_hostel_manager: 'female',
};

/**
 * What the signed-in user may do on the shared staff pages.
 * A super admin looking at an organisation (platform view) sees everything read-only.
 */
export function useAccess() {
  const { user } = useAuth();
  const { org } = usePlatformView();
  const role = user?.role;
  const managedGender = MANAGER_GENDER[role] || null;
  const isManager = Boolean(managedGender);
  const platformView = role === 'super_admin' && Boolean(org);
  return {
    role,
    user,
    managedGender,
    isManager,
    platformView,
    viewingOrg: platformView ? org : null,
    isOrgAdmin: role === 'org_admin',
    isWarden: role === 'warden',
    /** org admin, hostel manager, or super admin viewing an organisation */
    adminView: role === 'org_admin' || isManager || platformView,
    readOnly: platformView,
    canManage: role === 'org_admin' || isManager,
    canManageManagers: role === 'org_admin',
    canHandle: role === 'org_admin' || isManager || role === 'warden',
  };
}
