import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CalendarDays, Plus, XCircle } from 'lucide-react';
import { useCancelLeave, useCreateLeave, useLeaves } from '../../hooks/useLeaves';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate, todayIso, toOptions } from '../../lib/format';
import { LEAVE_STATUSES } from '../../lib/constants';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', status: '' };

const schema = z
  .object({
    fromDate: z.string().min(1, 'From date is required'),
    toDate: z.string().min(1, 'To date is required'),
    reason: z.string().trim().min(5, 'Please give a reason (at least 5 characters)').max(500),
  })
  .refine((v) => v.fromDate >= todayIso(), { message: 'Leave cannot start in the past', path: ['fromDate'] })
  .refine((v) => v.toDate >= v.fromDate, { message: 'To date must be on or after the from date', path: ['toDate'] });

function ApplyLeaveModal({ open, onClose }) {
  const createMutation = useCreateLeave();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ fromDate: todayIso(), toDate: todayIso(), reason: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Leave request submitted');
      onClose();
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="leave-form" loading={isSubmitting}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="leave-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="From"
          type="date"
          required
          min={todayIso()}
          error={errors.fromDate?.message}
          {...register('fromDate')}
        />
        <Input
          label="To"
          type="date"
          required
          min={todayIso()}
          error={errors.toDate?.message}
          {...register('toDate')}
        />
        <Textarea
          label="Reason"
          required
          rows={4}
          className="sm:col-span-2"
          error={errors.reason?.message}
          {...register('reason')}
        />
      </form>
    </Modal>
  );
}

export default function MyLeavesPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useLeaves(filters);
  const cancelMutation = useCancelLeave();
  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const columns = [
    {
      key: 'dates',
      header: 'Dates',
      render: (l) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-gray-900">
            {formatDate(l.fromDate)} – {formatDate(l.toDate)}
          </p>
          <p className="text-xs text-gray-500">
            {l.days} day{l.days > 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (l) => (
        <p className="max-w-xs truncate" title={l.reason}>
          {l.reason}
        </p>
      ),
    },
    { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
    {
      key: 'review',
      header: 'Review',
      render: (l) =>
        l.reviewedByName ? (
          <div className="max-w-xs">
            <p className="text-sm">{l.reviewedByName}</p>
            {l.reviewNote && <p className="truncate text-xs text-gray-500">{l.reviewNote}</p>}
          </div>
        ) : (
          <span className="text-gray-400">Awaiting review</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (l) =>
        l.status === 'pending' ? (
          <Button variant="ghost" size="sm" icon={XCircle} onClick={() => setCancelling(l)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="My leave requests"
        description="Apply for leave and track approvals."
        actions={
          <>
            <ImportExportActions exportPath="/leaves/export" exportParams={filters} />
            <Button icon={Plus} onClick={() => setApplyOpen(true)}>
              Apply for leave
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
          searchPlaceholder="Search reason"
        >
          <FilterSelect
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            allLabel="All statuses"
            options={toOptions(LEAVE_STATUSES)}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={CalendarDays}
          emptyTitle="No leave requests"
          emptyDescription="Your leave requests will appear here."
        />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
      <ApplyLeaveModal open={applyOpen} onClose={() => setApplyOpen(false)} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel leave request"
        message={
          cancelling
            ? `Cancel your leave from ${formatDate(cancelling.fromDate)} to ${formatDate(cancelling.toDate)}?`
            : ''
        }
        confirmLabel="Cancel request"
        loading={cancelMutation.isPending}
        onConfirm={() =>
          cancelMutation.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success('Leave request cancelled');
              setCancelling(null);
            },
          })
        }
      />
    </div>
  );
}
