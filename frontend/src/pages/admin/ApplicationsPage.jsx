import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { useApplications, useReviewApplication } from '../../hooks/useApplications';
import { useHostelOptions, useHostels } from '../../hooks/useHostels';
import { useRooms } from '../../hooks/useRooms';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDate, formatDateTime, labelize, todayIso, toOptions } from '../../lib/format';
import { APPLICATION_STATUSES } from '../../lib/constants';
import { getErrorMessage } from '../../api/client';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: 'pending' };

function ApproveModal({ application, onClose }) {
  const reviewMutation = useReviewApplication();
  const [hostelId, setHostelId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Only hostels of the applicant's gender that still have free beds.
  const { data: hostelData } = useHostels(
    { gender: application?.gender, hasAvailability: true, status: 'active', limit: 100 },
    { enabled: Boolean(application) },
  );
  const hostels = useMemo(() => hostelData?.data ?? [], [hostelData]);
  const { data: roomData, isLoading: roomsLoading } = useRooms(
    { hostelId, available: true, limit: 200 },
    { enabled: Boolean(hostelId) },
  );
  const rooms = roomData?.data ?? [];

  useEffect(() => {
    if (!application) return;
    setRoomId('');
    setStartDate(todayIso());
    setNote('');
    setError('');
    setHostelId(application.preferredHostelId ? String(application.preferredHostelId) : '');
  }, [application]);

  useEffect(() => {
    if (!hostelId && hostels.length && application) setHostelId(String(hostels[0].id));
  }, [hostels, hostelId, application]);

  const preferredType = application?.preferredRoomType;
  const roomOptions = [...rooms]
    .sort((a, b) => Number(b.roomType === preferredType) - Number(a.roomType === preferredType))
    .map((r) => ({
      value: String(r.id),
      label: `Room ${r.roomNumber} · ${labelize(r.roomType)} · ${r.available} free${r.roomType === preferredType ? ' (preferred)' : ''}`,
    }));

  const approve = () => {
    if (!roomId) {
      setError('Choose a room');
      return;
    }
    reviewMutation.mutate(
      { id: application.id, decision: 'approved', roomId: Number(roomId), startDate, note: note.trim() || null },
      {
        onSuccess: (res) => {
          toast.success(`${res.studentName} allocated to ${res.allocatedHostelName}, room ${res.allocatedRoomNumber}`);
          onClose();
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <Modal
      open={Boolean(application)}
      onClose={onClose}
      size="lg"
      title="Approve and allocate"
      description={application ? `${application.studentName} (${application.registerNo})` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" icon={Check} onClick={approve} loading={reviewMutation.isPending}>
            Approve &amp; allocate
          </Button>
        </>
      }
    >
      {application && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <GenderBadge gender={application.gender} />
            <span>
              Prefers {application.preferredHostelName || 'any hostel'}
              {application.preferredRoomType ? `, ${application.preferredRoomType} room` : ''}
            </span>
            {application.studentNote && <p className="w-full text-gray-500">“{application.studentNote}”</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Hostel"
              value={hostelId}
              onChange={(e) => {
                setHostelId(e.target.value);
                setRoomId('');
              }}
              placeholder="Select hostel"
              options={hostels.map((h) => ({ value: String(h.id), label: `${h.name} · ${h.available} free` }))}
              hint={`Only ${application.gender} hostels with free beds are shown`}
            />
            <Select
              label="Room"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              placeholder={
                roomsLoading && hostelId ? 'Loading rooms...' : rooms.length ? 'Select room' : 'No free rooms'
              }
              options={roomOptions}
              disabled={!hostelId}
            />
            <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Textarea
            label="Note to student (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function RejectModal({ application, onClose }) {
  const reviewMutation = useReviewApplication();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const close = () => {
    setNote('');
    setError('');
    onClose();
  };
  const reject = () => {
    if (note.trim().length < 3) {
      setError('Give a short reason for the student');
      return;
    }
    reviewMutation.mutate(
      { id: application.id, decision: 'rejected', note: note.trim() },
      {
        onSuccess: () => {
          toast.success('Application rejected');
          close();
        },
      },
    );
  };
  return (
    <Modal
      open={Boolean(application)}
      onClose={close}
      title="Reject application"
      description={application ? `${application.studentName} (${application.registerNo})` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" icon={X} loading={reviewMutation.isPending} onClick={reject}>
            Reject
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        required
        rows={3}
        maxLength={500}
        value={note}
        error={error}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}

export default function ApplicationsPage() {
  const access = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useApplications(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (a) => (
        <div>
          <p className="font-medium text-gray-900">{a.studentName}</p>
          <p className="text-xs text-gray-500">
            {a.registerNo} · {a.department} · Year {a.year}
          </p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (a) => <GenderBadge gender={a.gender} /> },
    {
      key: 'preference',
      header: 'Preference',
      render: (a) => (
        <div className="max-w-xs text-sm">
          <p>{a.preferredHostelName || 'Any hostel'}</p>
          <p className="text-xs text-gray-500">
            {a.preferredRoomType ? `${labelize(a.preferredRoomType)} room` : 'Any room type'}
          </p>
          {a.studentNote && (
            <p className="truncate text-xs italic text-gray-500" title={a.studentNote}>
              “{a.studentNote}”
            </p>
          )}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Applied', render: (a) => formatDate(a.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <div>
          <StatusBadge status={a.status} />
          {a.allocatedRoomNumber && (
            <p className="mt-1 text-xs text-gray-500">
              {a.allocatedHostelName} · {a.allocatedRoomNumber}
            </p>
          )}
          {a.reviewedByName && (
            <p className="mt-1 text-xs text-gray-500" title={formatDateTime(a.reviewedAt)}>
              by {a.reviewedByName}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (a) =>
        access.canManage && a.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button variant="success" size="sm" icon={Check} onClick={() => setApproving(a)}>
              Approve
            </Button>
            <Button variant="secondary" size="sm" icon={X} onClick={() => setRejecting(a)}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hostel applications"
        description="First-year students apply for a hostel; approving allocates a bed of their gender."
        actions={<ImportExportActions exportPath="/applications/export" exportParams={filters} />}
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
          resetFilters={resetFilters}
          searchPlaceholder="Student, register no, email"
        >
          <FilterSelect
            value={filters.hostelId}
            onChange={(hostelId) => setFilters({ hostelId })}
            allLabel="Any preferred hostel"
            options={hostelOptions}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            aria-label="Application status"
            className="form-control h-10 w-full py-0 pr-8 sm:w-auto"
          >
            {toOptions(APPLICATION_STATUSES).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="all">All statuses</option>
          </select>
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={ClipboardCheck}
          emptyTitle="No applications"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>
      <ApproveModal application={approving} onClose={() => setApproving(null)} />
      <RejectModal application={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}
