import { CalendarCheck, CalendarX, ClipboardList, Plane } from 'lucide-react';
import { useAttendance } from '../../hooks/useAttendance';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatDateTime, todayIso, toOptions } from '../../lib/format';
import { ATTENDANCE_STATUSES } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, status: '', fromDate: '', toDate: '' };

export default function MyAttendancePage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useAttendance(filters);
  const summary = data?.meta?.summary;
  const total = summary ? summary.present + summary.absent + summary.onLeave : 0;
  const rate = total ? Math.round((summary.present / total) * 100) : 0;
  const hasFilters = filters.status || filters.fromDate || filters.toDate;

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'hostelName', header: 'Hostel' },
    { key: 'markedByName', header: 'Marked by', render: (r) => r.markedByName || '—' },
    { key: 'markedAt', header: 'Updated', render: (r) => formatDateTime(r.markedAt) },
  ];

  return (
    <div>
      <PageHeader
        title="My attendance"
        description="Daily hostel roll call records."
        actions={<ImportExportActions exportPath="/attendance/export" exportParams={filters} />}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Present"
          value={summary?.present ?? 0}
          icon={CalendarCheck}
          tone="green"
          hint={`${rate}% of marked days`}
          loading={!summary}
        />
        <StatCard label="Absent" value={summary?.absent ?? 0} icon={CalendarX} tone="red" loading={!summary} />
        <StatCard label="On leave" value={summary?.onLeave ?? 0} icon={Plane} tone="indigo" loading={!summary} />
      </div>
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSelect
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            allLabel="All statuses"
            options={toOptions(ATTENDANCE_STATUSES)}
          />
          <label className="text-xs text-gray-500">
            From
            <input
              type="date"
              value={filters.fromDate}
              max={todayIso()}
              onChange={(e) => setFilters({ fromDate: e.target.value })}
              className="form-control mt-1 h-10"
            />
          </label>
          <label className="text-xs text-gray-500">
            To
            <input
              type="date"
              value={filters.toDate}
              max={todayIso()}
              onChange={(e) => setFilters({ toDate: e.target.value })}
              className="form-control mt-1 h-10"
            />
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={ClipboardList}
          emptyTitle="No attendance records"
          emptyDescription="Records appear once your warden marks attendance."
        />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
    </div>
  );
}
