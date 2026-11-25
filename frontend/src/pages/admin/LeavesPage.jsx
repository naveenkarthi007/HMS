import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Check, X } from 'lucide-react';
import { useLeaves, useReviewLeave } from '../../hooks/useLeaves';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import { useAuth } from '../../context/AuthContext';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatDateTime, toOptions } from '../../lib/format';
import { LEAVE_STATUSES } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '' };

function ReviewModal({ review, onClose }) {
  const reviewMutation = useReviewLeave();
  const [note, setNote] = useState('');
  const leave = review?.leave;
  const approving = review?.status === 'approved';

  const close = () => {
    setNote('');
    onClose();
  };

  return (
    <Modal
      open={Boolean(review)}
      onClose={close}
      title={approving ? 'Approve leave' : 'Reject leave'}
      description={
        leave
          ? `${leave.studentName} · ${formatDate(leave.fromDate)} – ${formatDate(leave.toDate)} (${leave.days} day${leave.days > 1 ? 's' : ''})`
          : ''
      }
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
                { id: leave.id, status: review.status, note: note.trim() || null },
                {
                  onSuccess: () => {
                    toast.success(approving ? 'Leave approved' : 'Leave rejected');
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
      {leave && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{leave.reason}</div>
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

export default function LeavesPage() {
  const { user } = useAuth();
  const { canHandle } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useLeaves(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const [review, setReview] = useState(null);

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (l) => (
        <div>
          <p className="font-medium text-gray-900">{l.studentName}</p>
          <p className="text-xs text-gray-500">{l.registerNo}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (l) => <GenderBadge gender={l.gender} /> },
    {
      key: 'hostel',
      header: 'Hostel / Room',
      render: (l) =>
        l.hostelName ? (
          <span>
            {l.hostelName} <span className="text-gray-400">· {l.roomNumber}</span>
          </span>
        ) : (
          <span className="text-gray-400">No room</span>
        ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (l) => (
        <div className="whitespace-nowrap">
          <p>
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
    {
      key: 'status',
      header: 'Status',
      render: (l) => (
        <div>
          <StatusBadge status={l.status} />
          {l.reviewedByName && (
            <p className="mt-1 text-xs text-gray-500" title={formatDateTime(l.reviewedAt)}>
              by {l.reviewedByName}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (l) =>
        canHandle && l.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="success"
              size="sm"
              icon={Check}
              onClick={() => setReview({ leave: l, status: 'approved' })}
            >
              Approve
            </Button>
            <Button variant="secondary" size="sm" icon={X} onClick={() => setReview({ leave: l, status: 'rejected' })}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave requests"
        description={
          user.role === 'warden'
            ? 'Leave requests from residents of your hostels.'
            : 'Leave requests from all students.'
        }
        actions={<ImportExportActions exportPath="/leaves/export" exportParams={filters} />}
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
          resetFilters={resetFilters}
          searchPlaceholder="Student, register no, reason"
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
            options={toOptions(LEAVE_STATUSES)}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={CalendarDays}
          emptyTitle="No leave requests found"
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
