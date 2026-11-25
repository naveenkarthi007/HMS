import { Activity, Eye, ShieldCheck, UserCog, Users, UserRound } from 'lucide-react';
import { usePlatformOverview } from '../../hooks/useDashboard';
import { usePlatformView } from '../../context/PlatformViewContext';
import DashboardPage from '../admin/DashboardPage';
import Card, { CardHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import OccupancyBar from '../../components/ui/OccupancyBar';
import EmptyState from '../../components/ui/EmptyState';
import { ROLE_LABELS, formatDateTime, labelize } from '../../lib/format';

const ROLE_ICONS = {
  super_admin: ShieldCheck,
  org_admin: UserCog,
  boys_hostel_manager: UserCog,
  girls_hostel_manager: UserCog,
  warden: Users,
  student: UserRound,
};

function Pending({ value, tone }) {
  return value ? <Badge tone={tone}>{value}</Badge> : <span className="text-gray-300">0</span>;
}

function OrganisationsTable({ organisations, loading }) {
  const { enter } = usePlatformView();
  const columns = [
    {
      key: 'name',
      header: 'Organisation',
      render: (o) => (
        <div>
          <p className="font-medium text-gray-900">{o.name}</p>
          <p className="text-xs text-gray-500">
            {o.code} · {o.admins} admin{o.admins === 1 ? '' : 's'}, {o.wardens} warden{o.wardens === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      key: 'hostels',
      header: 'Hostels',
      render: (o) => (
        <div className="text-sm">
          <p>{o.hostels}</p>
          <p className="text-xs text-gray-500">
            <span className="text-blue-600">{o.maleHostels} M</span> ·{' '}
            <span className="text-pink-600">{o.femaleHostels} F</span>
          </p>
        </div>
      ),
    },
    {
      key: 'students',
      header: 'Students',
      render: (o) => (
        <div className="text-sm">
          <p>{o.students}</p>
          <p className="text-xs text-gray-500">
            <span className="text-blue-600">{o.maleStudents} M</span> ·{' '}
            <span className="text-pink-600">{o.femaleStudents} F</span>
          </p>
        </div>
      ),
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      render: (o) => (
        <div>
          <OccupancyBar occupied={o.occupied} capacity={o.beds} />
          <p className="mt-0.5 text-xs text-gray-500">
            {o.occupancyRate}% · {o.available} free · {o.rooms} rooms
          </p>
        </div>
      ),
    },
    { key: 'openComplaints', header: 'Complaints', render: (o) => <Pending value={o.openComplaints} tone="red" /> },
    { key: 'pendingLeaves', header: 'Leaves', render: (o) => <Pending value={o.pendingLeaves} tone="yellow" /> },
    {
      key: 'pendingApplications',
      header: 'Bookings',
      render: (o) => <Pending value={o.pendingApplications} tone="indigo" />,
    },
    { key: 'studentsOut', header: 'Out now', render: (o) => <Pending value={o.studentsOut} tone="blue" /> },
    { key: 'isActive', header: 'Status', render: (o) => <StatusBadge status={o.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (o) => (
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => enter(o)}>
          View
        </Button>
      ),
    },
  ];
  return (
    <Card padded={false}>
      <div className="px-6 pt-6">
        <CardHeader
          title="Organisations"
          description="Live numbers per organisation. Click View to open an organisation read-only."
        />
      </div>
      <Table
        columns={columns}
        rows={organisations}
        loading={loading}
        skeletonRows={2}
        emptyTitle="No organisations yet"
      />
    </Card>
  );
}

function UsersByRole({ rows }) {
  return (
    <Card>
      <CardHeader title="Users" description="Accounts on the platform by role" />
      <ul className="space-y-3">
        {rows.map((r) => {
          const Icon = ROLE_ICONS[r.role] || Users;
          return (
            <li key={r.role} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm text-gray-700">{ROLE_LABELS[r.role]}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{r.total}</span>
              {r.active !== r.total && <Badge tone="gray">{r.total - r.active} inactive</Badge>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RecentActivity({ rows }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="Latest actions across all organisations" />
      {rows.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate text-gray-900">
                  <span className="font-medium">{a.userName || 'Deleted user'}</span>{' '}
                  <span className="text-gray-500">{labelize(a.action).toLowerCase()}</span>{' '}
                  {labelize(a.entity).toLowerCase()}
                  {a.entityId ? ` #${a.entityId}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {a.organisationCode || 'Platform'} · {ROLE_LABELS[a.userRole] || '—'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{formatDateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SuperAdminDashboardPage() {
  const { data, isLoading } = usePlatformOverview();

  return (
    <DashboardPage
      title="Platform overview"
      description="Every organisation, hostel and bed on the platform. Use the gender toggle to compare."
      showOrganisations
    >
      <div className="mt-6 space-y-6">
        <OrganisationsTable organisations={data?.organisations} loading={isLoading} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <UsersByRole rows={data?.usersByRole ?? []} />
          <div className="lg:col-span-2">
            <RecentActivity rows={data?.recentActivity ?? []} />
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
