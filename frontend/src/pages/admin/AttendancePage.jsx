import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarCheck, CheckCheck, ClipboardList, Save } from 'lucide-react';
import { useAttendance, useAttendanceSheet, useMarkAttendance } from '../../hooks/useAttendance';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import { useAuth } from '../../context/AuthContext';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import GenderFilter from '../../components/filters/GenderFilter';
import SearchInput from '../../components/filters/SearchInput';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Badge, { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDate, labelize, todayIso, toOptions } from '../../lib/format';
import { ATTENDANCE_STATUSES } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = {
  tab: 'mark',
  page: 1,
  limit: 10,
  search: '',
  gender: '',
  hostelId: '',
  status: '',
  date: '',
};

const STATUS_STYLES = {
  present: 'bg-emerald-600 text-white',
  absent: 'bg-red-600 text-white',
  on_leave: 'bg-primary-600 text-white',
};

function StatusToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="Attendance status">
      {ATTENDANCE_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={value === status}
          onClick={() => onChange(status)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === status ? STATUS_STYLES[status] : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {labelize(status)}
        </button>
      ))}
    </div>
  );
}

function MarkAttendance({ filters, setFilters }) {
  const { options: hostelOptions, hostels } = useHostelOptions(filters.gender);
  const hostelId = filters.hostelId || (hostels.length === 1 ? String(hostels[0].id) : '');
  const date = filters.date || todayIso();
  const {
    data: sheet,
    isLoading,
    isFetching,
  } = useAttendanceSheet({ hostelId, date, search: filters.search || undefined });
  const markMutation = useMarkAttendance();
  const [changes, setChanges] = useState({});

  useEffect(() => {
    setChanges({});
  }, [hostelId, date]);

  const rows = useMemo(
    () => (sheet?.rows ?? []).map((r) => ({ ...r, current: changes[r.studentId] ?? r.status })),
    [sheet, changes],
  );
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.current]: (acc[r.current] || 0) + 1 }), {});
  const unsaved = rows.filter((r) => !r.isSaved || changes[r.studentId]).length;

  const markAllPresent = () => {
    const next = {};
    for (const r of rows) next[r.studentId] = r.onApprovedLeave ? 'on_leave' : 'present';
    setChanges(next);
  };

  const save = () =>
    markMutation.mutate(
      {
        hostelId: Number(hostelId),
        date,
        records: rows.map((r) => ({ studentId: r.studentId, status: r.current })),
      },
      {
        onSuccess: (res) => {
          toast.success(`Attendance saved for ${res.saved} students`);
          setChanges({});
        },
      },
    );

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.studentName}</p>
          <p className="text-xs text-gray-500">{r.registerNo}</p>
        </div>
      ),
    },
    { key: 'roomNumber', header: 'Room' },
    { key: 'gender', header: 'Gender', render: (r) => <GenderBadge gender={r.gender} /> },
    {
      key: 'note',
      header: 'Note',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.onApprovedLeave && <Badge tone="indigo">Approved leave</Badge>}
          {r.isSaved && !changes[r.studentId] ? (
            <Badge tone="green">Saved</Badge>
          ) : (
            <Badge tone="yellow">Not saved</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'text-right',
      render: (r) => (
        <StatusToggle value={r.current} onChange={(status) => setChanges((c) => ({ ...c, [r.studentId]: status }))} />
      ),
    },
  ];

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <GenderFilter value={filters.gender} onChange={(gender) => setFilters({ gender, hostelId: '' })} />
        <FilterSelect
          value={hostelId}
          onChange={(value) => setFilters({ hostelId: value })}
          allLabel="Select hostel"
          options={hostelOptions}
        />
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setFilters({ date: e.target.value })}
          aria-label="Attendance date"
          className="form-control h-10 w-full sm:w-auto"
        />
        <SearchInput
          value={filters.search || ''}
          onChange={(search) => setFilters({ search })}
          placeholder="Search student"
          className="w-full lg:w-56"
        />
        <div className="flex gap-2 lg:ml-auto">
          <Button variant="secondary" icon={CheckCheck} onClick={markAllPresent} disabled={!rows.length}>
            All present
          </Button>
          <Button icon={Save} onClick={save} loading={markMutation.isPending} disabled={!rows.length}>
            Save
          </Button>
        </div>
      </div>
      {!hostelId ? (
        <EmptyState
          icon={CalendarCheck}
          title="Select a hostel"
          description="Choose a hostel and date to mark attendance."
        />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-4 text-xs">
              <Badge tone="green">Present {counts.present || 0}</Badge>
              <Badge tone="red">Absent {counts.absent || 0}</Badge>
              <Badge tone="indigo">On leave {counts.on_leave || 0}</Badge>
              {unsaved > 0 && <Badge tone="yellow">{unsaved} unsaved</Badge>}
              <span className="text-gray-500">for {formatDate(date)}</span>
            </div>
          )}
          <Table
            columns={columns}
            rows={rows}
            rowKey="studentId"
            loading={isLoading || isFetching}
            emptyIcon={CalendarCheck}
            emptyTitle="No residents"
            emptyDescription="This hostel has no students with an active allocation."
          />
        </>
      )}
    </Card>
  );
}

function AttendanceRecords({ filters, setFilters, resetFilters }) {
  const { data, isLoading, isFetching } = useAttendance({
    page: filters.page,
    limit: filters.limit,
    search: filters.search,
    gender: filters.gender,
    hostelId: filters.hostelId,
    status: filters.status,
    date: filters.date,
  });
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const summary = data?.meta?.summary;

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.studentName}</p>
          <p className="text-xs text-gray-500">{r.registerNo}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (r) => <GenderBadge gender={r.gender} /> },
    { key: 'hostelName', header: 'Hostel' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'markedByName', header: 'Marked by', render: (r) => r.markedByName || '—' },
  ];

  return (
    <Card padded={false}>
      <FilterBar
        filters={{ ...filters, tab: '' }}
        setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
        resetFilters={resetFilters}
        searchPlaceholder="Student or register no"
      >
        <FilterSelect
          value={filters.hostelId}
          onChange={(hostelId) => setFilters({ hostelId })}
          allLabel="All hostels"
          options={hostelOptions}
        />
        <FilterSelect
          value={filters.status}
          onChange={(status) => setFilters({ status })}
          allLabel="All statuses"
          options={toOptions(ATTENDANCE_STATUSES)}
        />
        <input
          type="date"
          value={filters.date}
          max={todayIso()}
          onChange={(e) => setFilters({ date: e.target.value })}
          aria-label="Filter by date"
          className="form-control h-10 w-full sm:w-auto"
        />
      </FilterBar>
      {summary && (
        <div className="flex flex-wrap gap-2 px-4 pt-4">
          <Badge tone="green">Present {summary.present}</Badge>
          <Badge tone="red">Absent {summary.absent}</Badge>
          <Badge tone="indigo">On leave {summary.onLeave}</Badge>
        </div>
      )}
      <Table
        columns={columns}
        rows={data?.data}
        loading={isLoading || isFetching}
        emptyIcon={ClipboardList}
        emptyTitle="No attendance records"
      />
      <Pagination
        meta={data?.meta}
        onPageChange={(page) => setFilters({ page })}
        onLimitChange={(limit) => setFilters({ limit })}
      />
    </Card>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { canHandle } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  // Platform view (read-only) only shows the records.
  const tab = filters.tab === 'records' || !canHandle ? 'records' : 'mark';

  const tabs = [
    { id: 'mark', label: 'Mark attendance', icon: CalendarCheck },
    { id: 'records', label: 'Records', icon: ClipboardList },
  ].filter((t) => canHandle || t.id === 'records');

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={
          user.role === 'warden' ? 'Daily roll call for your hostels.' : 'Daily roll call across all hostels.'
        }
        actions={
          <ImportExportActions
            exportPath="/attendance/export"
            exportParams={filters}
            importKind="attendance"
            canImport={canHandle}
          />
        }
      />
      <div className="mb-4 inline-flex rounded-lg bg-gray-200/70 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilters({ tab: id, status: '', date: '', search: '' })}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'mark' ? (
        <MarkAttendance filters={filters} setFilters={setFilters} />
      ) : (
        <AttendanceRecords filters={filters} setFilters={setFilters} resetFilters={resetFilters} />
      )}
    </div>
  );
}
