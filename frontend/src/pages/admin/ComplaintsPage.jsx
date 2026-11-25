import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareWarning, PencilLine } from 'lucide-react';
import { useComplaints, useUpdateComplaint } from '../../hooks/useComplaints';
import { useHostelOptions } from '../../hooks/useHostels';
import { useWardens } from '../../hooks/useWardens';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import { useAuth } from '../../context/AuthContext';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Badge, { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatDateTime, labelize, toOptions } from '../../lib/format';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '', category: '', priority: '' };

function UpdateComplaintModal({ complaint, onClose }) {
  const { user } = useAuth();
  const { canManage: isAdmin } = useAccess();
  const updateMutation = useUpdateComplaint();
  const { data: wardens } = useWardens(
    { hostelId: complaint?.hostelId, limit: 100, status: 'active' },
    { enabled: Boolean(isAdmin && complaint) },
  );
  const [form, setForm] = useState({ status: '', priority: '', assignedTo: '' });

  useEffect(() => {
    if (complaint) {
      setForm({
        status: complaint.status,
        priority: complaint.priority,
        assignedTo: complaint.assignedTo ? String(complaint.assignedTo) : '',
      });
    }
  }, [complaint]);

  const assigneeOptions = [{ value: String(user.id), label: `Me (${user.name})` }];
  for (const w of wardens?.data ?? []) {
    if (w.id !== user.id) assigneeOptions.push({ value: String(w.id), label: `${w.name} (warden)` });
  }
  if (complaint?.assignedTo && !assigneeOptions.some((o) => o.value === String(complaint.assignedTo))) {
    assigneeOptions.push({
      value: String(complaint.assignedTo),
      label: complaint.assignedToName || 'Current assignee',
    });
  }

  const save = () =>
    updateMutation.mutate(
      {
        id: complaint.id,
        status: form.status,
        priority: form.priority,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
      },
      {
        onSuccess: () => {
          toast.success('Complaint updated');
          onClose();
        },
      },
    );

  return (
    <Modal
      open={Boolean(complaint)}
      onClose={onClose}
      size="lg"
      title={complaint?.title}
      description={complaint ? `${labelize(complaint.category)} · raised ${formatDateTime(complaint.createdAt)}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={updateMutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      {complaint && (
        <div className="space-y-5">
          <div className="rounded-xl bg-gray-50 p-4 text-sm">
            <p className="whitespace-pre-line text-gray-700">{complaint.description}</p>
            <p className="mt-3 text-xs text-gray-500">
              {complaint.studentName} ({complaint.registerNo}) · {complaint.hostelName}
              {complaint.roomNumber ? ` · Room ${complaint.roomNumber}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              options={toOptions(COMPLAINT_STATUSES)}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              options={toOptions(COMPLAINT_PRIORITIES)}
            />
            <Select
              label="Assigned to"
              value={form.assignedTo}
              onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              placeholder="Unassigned"
              options={assigneeOptions}
            />
          </div>
          {complaint.resolvedAt && (
            <p className="text-xs text-gray-500">Resolved {formatDateTime(complaint.resolvedAt)}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const { canHandle } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useComplaints(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const [editing, setEditing] = useState(null);

  const columns = [
    {
      key: 'title',
      header: 'Complaint',
      render: (c) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-gray-900">{c.title}</p>
          <p className="text-xs text-gray-500">{labelize(c.category)}</p>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      render: (c) => (
        <div>
          <p>{c.studentName}</p>
          <p className="text-xs text-gray-500">{c.registerNo}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (c) => <GenderBadge gender={c.gender} /> },
    {
      key: 'hostel',
      header: 'Hostel / Room',
      render: (c) => (
        <span>
          {c.hostelName}
          {c.roomNumber && <span className="text-gray-400"> · {c.roomNumber}</span>}
        </span>
      ),
    },
    { key: 'priority', header: 'Priority', render: (c) => <StatusBadge status={c.priority} /> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'assignedToName',
      header: 'Assigned',
      render: (c) =>
        c.assignedToName ? <Badge tone="indigo">{c.assignedToName}</Badge> : <span className="text-gray-400">—</span>,
    },
    { key: 'createdAt', header: 'Raised', render: (c) => formatDate(c.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (c) =>
        canHandle ? (
          <Button variant="secondary" size="sm" icon={PencilLine} onClick={() => setEditing(c)}>
            Update
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Complaints"
        description={
          user.role === 'warden'
            ? 'Complaints raised in your hostels.'
            : 'Maintenance and service complaints across all hostels.'
        }
        actions={<ImportExportActions exportPath="/complaints/export" exportParams={filters} />}
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
          resetFilters={resetFilters}
          searchPlaceholder="Title, student, register no"
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
            options={toOptions(COMPLAINT_STATUSES)}
          />
          <FilterSelect
            value={filters.category}
            onChange={(category) => setFilters({ category })}
            allLabel="All categories"
            options={toOptions(COMPLAINT_CATEGORIES)}
          />
          <FilterSelect
            value={filters.priority}
            onChange={(priority) => setFilters({ priority })}
            allLabel="All priorities"
            options={toOptions(COMPLAINT_PRIORITIES)}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={MessageSquareWarning}
          emptyTitle="No complaints found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>
      <UpdateComplaintModal complaint={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
