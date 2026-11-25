import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BedDouble, Building, CheckCircle2, ClipboardCheck, Info, Send, XCircle } from 'lucide-react';
import {
  useApplicationOptions,
  useApplications,
  useCancelApplication,
  useCreateApplication,
} from '../../hooks/useApplications';
import Card, { CardHeader, PageHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/Modal';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { formatDate, formatDateTime, labelize } from '../../lib/format';
import { ROOM_TYPES } from '../../lib/constants';
import { applyServerErrors } from '../../lib/forms';

function HostelChoice({ hostel, selected, onSelect }) {
  const full = hostel.available === 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? '' : String(hostel.id))}
      disabled={full}
      className={`w-full rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{hostel.name}</p>
          <p className="text-xs text-gray-500">{full ? 'Full right now' : `${hostel.available} beds free`}</p>
        </div>
        <GenderBadge gender={hostel.gender} />
      </div>
      {hostel.roomTypes.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">Rooms: {hostel.roomTypes.map(labelize).join(', ')}</p>
      )}
    </button>
  );
}

export default function HostelBookingPage() {
  const { data: options, isLoading } = useApplicationOptions();
  const { data: history } = useApplications({ limit: 20 });
  const createMutation = useCreateApplication();
  const cancelMutation = useCancelApplication();
  const [preferredHostelId, setPreferredHostelId] = useState('');
  const [preferredRoomType, setPreferredRoomType] = useState('');
  const [studentNote, setStudentNote] = useState('');
  const [errors, setErrors] = useState({});
  const [cancelling, setCancelling] = useState(null);

  const applications = history?.data ?? [];
  const pending = applications.find((a) => a.status === 'pending');

  const submit = () => {
    setErrors({});
    createMutation.mutate(
      {
        preferredHostelId: preferredHostelId ? Number(preferredHostelId) : null,
        preferredRoomType: preferredRoomType || null,
        studentNote: studentNote.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Application submitted. The hostel office will review it.');
          setStudentNote('');
        },
        onError: (err) =>
          applyServerErrors(err, (field, { message }) => setErrors((e) => ({ ...e, [field]: message }))),
      },
    );
  };

  if (isLoading || !options) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Hostel booking" description="First-year students can apply for a hostel room here." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {options.hasRoom ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="You already have a room"
                description="See your hostel, room and roommates on the My Room page."
                action={
                  <Link to="/student/home" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                    Go to My Room
                  </Link>
                }
              />
            </Card>
          ) : !options.eligible ? (
            <Card>
              <EmptyState
                icon={Info}
                title="Booking is not open for you"
                description={`${options.reason} You are in year ${options.year}. Contact the hostel office for help.`}
              />
            </Card>
          ) : pending ? (
            <Card>
              <EmptyState
                icon={ClipboardCheck}
                title="Your application is being reviewed"
                description={`Submitted on ${formatDate(pending.createdAt)}. You will get a room once the hostel office approves it.`}
                action={
                  <Button variant="secondary" icon={XCircle} onClick={() => setCancelling(pending)}>
                    Cancel application
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Apply for a hostel"
                description="Only hostels for your gender are shown. Preferences are not guaranteed."
              />
              <div className="space-y-5">
                <div>
                  <p className="form-label">Preferred hostel (optional)</p>
                  {options.hostels.length === 0 ? (
                    <p className="text-sm text-gray-500">No hostels available right now.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {options.hostels.map((h) => (
                        <HostelChoice
                          key={h.id}
                          hostel={h}
                          selected={preferredHostelId === String(h.id)}
                          onSelect={setPreferredHostelId}
                        />
                      ))}
                    </div>
                  )}
                  {errors.preferredHostelId && <p className="mt-1 text-xs text-red-600">{errors.preferredHostelId}</p>}
                </div>
                <Select
                  label="Preferred room type (optional)"
                  value={preferredRoomType}
                  onChange={(e) => setPreferredRoomType(e.target.value)}
                  placeholder="No preference"
                  options={ROOM_TYPES.map((t) => ({ value: t, label: labelize(t) }))}
                  className="max-w-xs"
                />
                <Textarea
                  label="Anything the office should know? (optional)"
                  rows={3}
                  maxLength={500}
                  value={studentNote}
                  error={errors.studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="e.g. medical needs, want to stay with a classmate"
                />
                <Button icon={Send} onClick={submit} loading={createMutation.isPending}>
                  Submit application
                </Button>
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader title="My applications" />
          {applications.length === 0 ? (
            <EmptyState icon={Building} title="No applications yet" />
          ) : (
            <ul className="space-y-4">
              {applications.map((a) => (
                <li key={a.id} className="rounded-xl border border-gray-100 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">{formatDate(a.createdAt)}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-2 text-gray-900">
                    {a.preferredHostelName || 'Any hostel'}
                    {a.preferredRoomType ? ` · ${labelize(a.preferredRoomType)}` : ''}
                  </p>
                  {a.allocatedRoomNumber && (
                    <p className="mt-1 flex items-center gap-1.5 text-emerald-700">
                      <BedDouble className="h-4 w-4" /> {a.allocatedHostelName}, room {a.allocatedRoomNumber}
                    </p>
                  )}
                  {a.reviewNote && <p className="mt-1 text-xs text-gray-500">“{a.reviewNote}”</p>}
                  {a.reviewedAt && (
                    <p className="mt-1 text-xs text-gray-400">Reviewed {formatDateTime(a.reviewedAt)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel application"
        message="Withdraw your hostel application? You can apply again later."
        confirmLabel="Withdraw"
        loading={cancelMutation.isPending}
        onConfirm={() =>
          cancelMutation.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success('Application withdrawn');
              setCancelling(null);
            },
          })
        }
      />
    </div>
  );
}
