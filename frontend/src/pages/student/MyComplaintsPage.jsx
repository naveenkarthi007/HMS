import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { MessageSquareWarning, Plus } from 'lucide-react';
import { useComplaints, useCreateComplaint } from '../../hooks/useComplaints';
import { useMyProfile } from '../../hooks/useStudents';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatDateTime, labelize, toOptions } from '../../lib/format';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../../lib/constants';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', status: '', category: '' };

const schema = z.object({
  category: z.enum(['electrical', 'plumbing', 'cleaning', 'furniture', 'internet', 'mess', 'other'], {
    error: 'Choose a category',
  }),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().trim().min(10, 'Please describe the issue (at least 10 characters)').max(2000),
  priority: z.enum(['low', 'medium', 'high']),
});

function NewComplaintModal({ open, onClose }) {
  const createMutation = useCreateComplaint();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ category: '', title: '', description: '', priority: 'medium' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Complaint submitted');
      onClose();
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a complaint"
      description="Your warden will be notified and can update the status."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="complaint-form" loading={isSubmitting}>
            Submit
          </Button>
        </>
      }
    >
      <form id="complaint-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Select
          label="Category"
          required
          placeholder="Select category"
          options={toOptions(COMPLAINT_CATEGORIES)}
          error={errors.category?.message}
          {...register('category')}
        />
        <Select label="Priority" options={toOptions(COMPLAINT_PRIORITIES)} {...register('priority')} />
        <Input label="Title" required className="sm:col-span-2" error={errors.title?.message} {...register('title')} />
        <Textarea
          label="Description"
          required
          rows={5}
          className="sm:col-span-2"
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Modal>
  );
}

function ComplaintDetails({ complaint, onClose }) {
  return (
    <Modal open={Boolean(complaint)} onClose={onClose} title={complaint?.title}>
      {complaint && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={complaint.status} />
            <StatusBadge status={complaint.priority} label={`${labelize(complaint.priority)} priority`} />
          </div>
          <p className="whitespace-pre-line text-gray-700">{complaint.description}</p>
          <dl className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div>
              <dt>Category</dt>
              <dd className="text-sm text-gray-900">{labelize(complaint.category)}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd className="text-sm text-gray-900">{complaint.assignedToName || 'Not yet assigned'}</dd>
            </div>
            <div>
              <dt>Raised</dt>
              <dd className="text-sm text-gray-900">{formatDateTime(complaint.createdAt)}</dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd className="text-sm text-gray-900">{formatDateTime(complaint.resolvedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}

export default function MyComplaintsPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useComplaints(filters);
  const { data: profile } = useMyProfile();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const hasRoom = Boolean(profile?.room);

  const columns = [
    {
      key: 'title',
      header: 'Complaint',
      render: (c) => (
        <div className="max-w-sm">
          <p className="truncate font-medium text-gray-900">{c.title}</p>
          <p className="text-xs text-gray-500">{labelize(c.category)}</p>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (c) => <StatusBadge status={c.priority} /> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'assignedToName', header: 'Assigned to', render: (c) => c.assignedToName || '—' },
    { key: 'createdAt', header: 'Raised', render: (c) => formatDate(c.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="My complaints"
        description={
          hasRoom || !profile
            ? 'Report an issue in your room or hostel.'
            : 'You need a room allocation to raise complaints.'
        }
        actions={
          <>
            <ImportExportActions exportPath="/complaints/export" exportParams={filters} />
            <Button icon={Plus} onClick={() => setCreateOpen(true)} disabled={!hasRoom}>
              Raise complaint
            </Button>
          </>
        }
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          showGender={false}
          searchPlaceholder="Search complaints"
        >
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
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          onRowClick={setViewing}
          emptyIcon={MessageSquareWarning}
          emptyTitle="No complaints"
          emptyDescription="Complaints you raise will appear here."
        />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
      <NewComplaintModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ComplaintDetails complaint={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
