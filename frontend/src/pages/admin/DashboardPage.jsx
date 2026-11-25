import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BedDouble,
  ClipboardCheck,
  Footprints,
  BedSingle,
  Building,
  Building2,
  CalendarDays,
  DoorOpen,
  MessageSquareWarning,
  UserCheck,
  Users,
} from 'lucide-react';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import GenderFilter from '../../components/filters/GenderFilter';
import Card, { CardHeader, PageHeader } from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { labelize } from '../../lib/format';

const DEFAULTS = { gender: '' };

const COLORS = {
  male: '#3b82f6',
  female: '#ec4899',
  primary: '#4f46e5',
  available: '#c7d2fe',
  status: { open: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981', closed: '#9ca3af' },
};

const tooltipStyle = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 12,
  color: 'var(--chart-tooltip-text)',
  fontSize: 12,
};
const axisTick = { fill: 'currentColor', fontSize: 12 };

function ChartCard({ title, description, children, empty }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {empty ? (
        <EmptyState title="No data yet" description="Data will appear here once records exist." />
      ) : (
        <div className="h-72 w-full text-gray-500">{children}</div>
      )}
    </Card>
  );
}

/**
 * Shared dashboard for org admins, wardens and the super admin.
 * The All / Male / Female toggle drives every card and chart via ?gender=.
 */
export default function DashboardPage({
  title = 'Dashboard',
  description = 'Occupancy, complaints and leave requests at a glance.',
  showOrganisations = false,
  hideApplications = false,
  children,
}) {
  const { filters, setFilters } = useUrlFilters(DEFAULTS);
  const { managedGender } = useAccess();
  const effectiveGender = filters.gender || managedGender || '';
  const { data, isLoading } = useDashboardSummary({ gender: filters.gender || undefined });
  const stats = data?.stats;
  const loading = isLoading || !stats;

  const genderData = (() => {
    if (!data) return [];
    if (effectiveGender) {
      const g = data.genderOccupancy[0] || { occupied: 0, available: 0 };
      return [
        { name: 'Occupied', value: g.occupied, color: COLORS[effectiveGender] },
        { name: 'Available', value: g.available, color: COLORS.available },
      ];
    }
    return data.genderOccupancy.map((g) => ({ name: labelize(g.gender), value: g.occupied, color: COLORS[g.gender] }));
  })();
  const genderTotal = genderData.reduce((sum, d) => sum + d.value, 0);

  const hostelData = (data?.occupancyByHostel || []).map((h) => ({
    name: h.code || h.name,
    fullName: h.name,
    occupied: h.occupied,
    available: h.available,
    gender: h.gender,
  }));

  const complaintData = (data?.complaintsByStatus || []).map((c) => ({ ...c, label: labelize(c.status) }));
  const complaintsTotal = complaintData.reduce((sum, c) => sum + c.count, 0);

  const cards = [
    showOrganisations && {
      label: 'Organisations',
      value: data?.organisations ? `${data.organisations.active}/${data.organisations.total}` : 0,
      icon: Building2,
      tone: 'indigo',
      hint: 'active / total',
    },
    { label: 'Hostels', value: stats?.hostels, icon: Building, tone: 'indigo' },
    {
      label: 'Rooms',
      value: stats?.rooms,
      icon: DoorOpen,
      tone: 'gray',
      hint: `${stats?.maintenanceRooms ?? 0} under maintenance`,
    },
    { label: 'Beds', value: stats?.beds, icon: BedDouble, tone: 'blue' },
    {
      label: 'Occupied',
      value: stats?.occupied,
      icon: UserCheck,
      tone: 'green',
      hint: `${stats?.occupancyRate ?? 0}% occupancy`,
    },
    { label: 'Available', value: stats?.available, icon: BedSingle, tone: 'yellow' },
    { label: 'Open complaints', value: stats?.openComplaints, icon: MessageSquareWarning, tone: 'red' },
    { label: 'Pending leaves', value: stats?.pendingLeaves, icon: CalendarDays, tone: 'pink' },
    {
      label: 'Students out',
      value: stats?.studentsOut,
      icon: Footprints,
      tone: 'blue',
      hint: `${stats?.pendingOutings ?? 0} outing requests pending`,
    },
    !hideApplications && {
      label: 'Booking requests',
      value: stats?.pendingApplications,
      icon: ClipboardCheck,
      tone: 'indigo',
      hint: 'first-year applications pending',
    },
    {
      label: 'Students',
      value: stats?.students,
      icon: Users,
      tone: 'gray',
      hint: `${stats?.allocatedStudents ?? 0} with a room`,
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<GenderFilter value={filters.gender} onChange={(gender) => setFilters({ gender })} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} value={card.value ?? 0} loading={loading} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Occupancy by hostel"
            description="Occupied vs available beds"
            empty={!loading && hostelData.length === 0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hostelData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="occupied" name="Occupied" stackId="beds" fill={COLORS.primary} radius={[0, 0, 0, 0]}>
                  {hostelData.map((h) => (
                    <Cell key={h.name} fill={COLORS[h.gender] || COLORS.primary} />
                  ))}
                </Bar>
                <Bar
                  dataKey="available"
                  name="Available"
                  stackId="beds"
                  fill={COLORS.available}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard
          title={effectiveGender ? `${labelize(effectiveGender)} occupancy` : 'Male vs female occupancy'}
          description={effectiveGender ? 'Occupied vs available beds' : 'Occupied beds by gender'}
          empty={!loading && genderTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderData}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {genderData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="xl:col-span-3">
          <ChartCard title="Complaints by status" empty={!loading && complaintsTotal === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complaintData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="count" name="Complaints" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {complaintData.map((c) => (
                    <Cell key={c.status} fill={COLORS.status[c.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
      {children}
    </div>
  );
}
