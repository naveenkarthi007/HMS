import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Footprints, Plus, XCircle } from 'lucide-react';
import { useCancelOuting, useCreateOuting, useOutings } from '../../hooks/useOutings';
import { useMyProfile } from '../../hooks/useStudents';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import { labelize, localInputFromNow, localInputToIso } from '../../lib/format';
import { OUTING_STATUSES } from '../../lib/constants';
import { applyServerErrors } from '../../lib/forms';
import { OutingStatus, OutingTimes } from '../admin/OutingsPage';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', status: '' };
const MAX_HOURS = 24;

const schema = z
  .object({
    destination: z.string().trim().min(2, 'Where are you going?').max(150),
    reason: z.string().trim().min(3, 'Give a short reason').max(500),
    outAt: z.string().min(1, 'Choose when you go out'),
    expectedReturnAt: z.string().min(1, 'Choose when you will be back'),
  })
  .refine((v) => new Date(v.outAt).getTime() > Date.now() - 15 * 60 * 1000, {
    message: 'Choose a time from now on',
    path: ['outAt'],
  })
  .refine((v) => new Date(v.expectedReturnAt) > new Date(v.outAt), {
    message: 'Return time must be after the time you go out',
    path: ['expectedReturnAt'],
  })
  .refine((v) => new Date(v.expectedReturnAt) - new Date(v.outAt) <= MAX_HOURS * 3600 * 1000, {
    message: `Outings can last at most ${MAX_HOURS} hours — apply for leave instead`,
    path: ['expectedReturnAt'],
  });

function NewOutingModal({ open, onClose }) {
  const createMutation = useCreateOuting();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open)
      reset({ destination: '', reason: '', outAt: localInputFromNow(0.5), expectedReturnAt: localInputFromNow(3.5) });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        ...values,
        outAt: localInputToIso(values.outAt),
        expectedReturnAt: localInputToIso(values.expectedReturnAt),
      });
      toast.success('Outing request sent to your warden');
      onClose();
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request an outing"
      description={`For short trips out of the hostel (up to ${MAX_HOURS} hours). For longer, apply for leave.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="outing-form" loading={isSubmitting}>
            Send request
          </Button>
        </>
      }
    >
      <form id="outing-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="Going to"
          required
          className="sm:col-span-2"
          placeholder="e.g. City market"
          error={errors.destination?.message}
          {...register('destination')}
        />
        <Input
          label="Going out at"
          type="datetime-local"
          required
          error={errors.outAt?.message}
          {...register('outAt')}
        />
        <Input
          label="Back by"
          type="datetime-local"
          required
          error={errors.expectedReturnAt?.message}
          {...register('expectedReturnAt')}
        />
        <Textarea
          label="Reason"
          required
          rows={3}
          className="sm:col-span-2"
          error={errors.reason?.message}
          {...register('reason')}
        />
      </form>
    </Modal>
  );
}

export default function MyOutingsPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useOutings(filters);
  const { data: profile } = useMyProfile();
  const cancelMutation = useCancelOuting();
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const hasRoom = Boolean(profile?.room);

  const columns = [
    {
      key: 'destination',
      header: 'Going to',
      render: (o) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-gray-900">{o.destination}</p>
          <p className="truncate text-xs text-gray-500">{o.reason}</p>
        </div>
      ),
    },
    { key: 'times', header: 'Times', render: (o) => <OutingTimes outing={o} /> },
    { key: 'status', header: 'Status', render: (o) => <OutingStatus outing={o} /> },
    {
      key: 'review',
      header: 'Warden',
      render: (o) =>
        o.reviewedByName ? (
          <div className="max-w-xs">
            <p className="text-sm">{o.reviewedByName}</p>
            {o.reviewNote && <p className="truncate text-xs text-gray-500">{o.reviewNote}</p>}
          </div>
        ) : (
          <span className="text-gray-400">Awaiting review</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (o) =>
        o.status === 'pending' || o.status === 'approved' ? (
          <Button variant="ghost" size="sm" icon={XCircle} onClick={() => setCancelling(o)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="My outings"
        description={
          hasRoom || !profile
            ? 'Ask your warden before going out of the hostel.'
            : 'You need a hostel room to request outings.'
        }
        actions={
          <>
            <ImportExportActions exportPath="/outings/export" exportParams={filters} />
            <Button icon={Plus} onClick={() => setCreateOpen(true)} disabled={!hasRoom}>
              Request outing
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
          searchPlaceholder="Search place"
        >
          <FilterSelect
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            allLabel="All statuses"
            options={OUTING_STATUSES.map((s) => ({ value: s, label: s === 'out' ? 'Out now' : labelize(s) }))}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={Footprints}
          emptyTitle="No outings yet"
          emptyDescription="Your outing requests will appear here."
        />
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
      <NewOutingModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel outing"
        message={cancelling ? `Cancel your outing to ${cancelling.destination}?` : ''}
        confirmLabel="Cancel outing"
        loading={cancelMutation.isPending}
        onConfirm={() =>
          cancelMutation.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success('Outing cancelled');
              setCancelling(null);
            },
          })
        }
      />
    </div>
  );
}
