import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Footprints, LogIn, LogOut, X } from 'lucide-react';
import { useCheckInOuting, useCheckOutOuting, useOutings, useReviewOuting } from '../../hooks/useOutings';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import Badge, { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDateTime, labelize } from '../../lib/format';
import { OUTING_STATUSES } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '' };

export function OutingStatus({ outing }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge status={outing.status} label={outing.status === 'out' ? 'Out now' : undefined} />
      {outing.isLate && <Badge tone="red">Late</Badge>}
    </div>
  );
}

export function OutingTimes({ outing }) {
  return (
    <div className="whitespace-nowrap text-sm">
      <p>
        <span className="text-gray-400">Out </span>
        {formatDateTime(outing.checkedOutAt || outing.outAt)}
      </p>
      <p>
        <span className="text-gray-400">{outing.returnedAt ? 'Back ' : 'Due '}</span>
        {formatDateTime(outing.returnedAt || outing.expectedReturnAt)}
      </p>
    </div>
  );
}

function ReviewModal({ review, onClose }) {
  const reviewMutation = useReviewOuting();
  const [note, setNote] = useState('');
  const approving = review?.status === 'approved';
  const close = () => {
    setNote('');
    onClose();
  };
  return (
    <Modal
      open={Boolean(review)}
      onClose={close}
      title={approving ? 'Approve outing' : 'Reject outing'}
      description={review ? `${review.outing.studentName} → ${review.outing.destination}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={approving ? 'success' : 'danger'}
            icon={approving ? Check : X}
            loading={reviewMutation.isPending}
            onClick={() =>
              reviewMutation.mutate(
                { id: review.outing.id, status: review.status, note: note.trim() || null },
                {
                  onSuccess: () => {
                    toast.success(approving ? 'Outing approved' : 'Outing rejected');
                    close();
                  },
                },
              )
            }
          >
            {approving ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      {review && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <p>{review.outing.reason}</p>
            <div className="mt-3">
              <OutingTimes outing={review.outing} />
            </div>
          </div>
          <Textarea
            label="Note to student (optional)"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}

export default function OutingsPage() {
  const access = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useOutings(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const checkOutMutation = useCheckOutOuting();
  const checkInMutation = useCheckInOuting();
  const [review, setReview] = useState(null);

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (o) => (
        <div>
          <p className="font-medium text-gray-900">{o.studentName}</p>
          <p className="text-xs text-gray-500">
            {o.registerNo} · {o.hostelName}
            {o.roomNumber ? ` · ${o.roomNumber}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (o) => <GenderBadge gender={o.gender} /> },
    {
      key: 'destination',
      header: 'Going to',
      render: (o) => (
        <div className="max-w-xs">
          <p className="truncate">{o.destination}</p>
          <p className="truncate text-xs text-gray-500" title={o.reason}>
            {o.reason}
          </p>
        </div>
      ),
    },
    { key: 'times', header: 'Times', render: (o) => <OutingTimes outing={o} /> },
    { key: 'status', header: 'Status', render: (o) => <OutingStatus outing={o} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (o) => {
        if (!access.canHandle) return null;
        if (o.status === 'pending') {
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="success"
                size="sm"
                icon={Check}
                onClick={() => setReview({ outing: o, status: 'approved' })}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={X}
                onClick={() => setReview({ outing: o, status: 'rejected' })}
              >
                Reject
              </Button>
            </div>
          );
        }
        if (o.status === 'approved') {
          return (
            <Button
              variant="secondary"
              size="sm"
              icon={LogOut}
              loading={checkOutMutation.isPending && checkOutMutation.variables === o.id}
              onClick={() =>
                checkOutMutation.mutate(o.id, { onSuccess: () => toast.success(`${o.studentName} marked out`) })
              }
            >
              Mark out
            </Button>
          );
        }
        if (o.status === 'out') {
          return (
            <Button
              size="sm"
              icon={LogIn}
              loading={checkInMutation.isPending && checkInMutation.variables === o.id}
              onClick={() =>
                checkInMutation.mutate(o.id, { onSuccess: () => toast.success(`${o.studentName} is back`) })
              }
            >
              Mark returned
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Outings"
        description={
          access.isWarden
            ? 'Short outings of residents in your hostels: approve, mark out and mark returned.'
            : 'Outing requests across all hostels.'
        }
        actions={<ImportExportActions exportPath="/outings/export" exportParams={filters} />}
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
          resetFilters={resetFilters}
          searchPlaceholder="Student, register no, place"
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
            options={[
              ...OUTING_STATUSES.map((s) => ({ value: s, label: s === 'out' ? 'Out now' : labelize(s) })),
              { value: 'late', label: 'Late' },
            ]}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={Footprints}
          emptyTitle="No outing requests"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>
      <ReviewModal review={review} onClose={() => setReview(null)} />
    </div>
  );
}
