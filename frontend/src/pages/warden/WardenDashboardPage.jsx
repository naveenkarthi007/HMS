import { useAuth } from '../../context/AuthContext';
import DashboardPage from '../admin/DashboardPage';

export default function WardenDashboardPage() {
  const { user } = useAuth();
  const description = user?.assignmentSummary
    ? `Assigned scope: ${user.assignmentSummary}`
    : 'Your assigned hostels, floors, and rooms at a glance.';
  return <DashboardPage title="Warden dashboard" description={description} hideApplications />;
}
