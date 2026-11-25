import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, BedDouble, Building, Check, UserRound } from 'lucide-react';
import { useStudent, useStudents } from '../../hooks/useStudents';
import { useHostels } from '../../hooks/useHostels';
import { useRooms } from '../../hooks/useRooms';
import { useCreateAllocation } from '../../hooks/useAllocations';
import { useDebounce } from '../../hooks/useDebounce';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { GenderBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import OccupancyBar from '../../components/ui/OccupancyBar';
import { labelize, todayIso } from '../../lib/format';

const STEPS = ['Student', 'Hostel', 'Room', 'Confirm'];

function Stepper({ step }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-primary-600 text-white'
                  : current
                    ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={current ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
            {index < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-gray-200 sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function OptionButton({ selected, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
          : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function StudentStep({ selected, onSelect }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useStudents({ status: 'unallocated', search: debounced || undefined, limit: 8 });
  const students = data?.data ?? [];

  return (
    <div className="space-y-3">
      <Input
        label="Find an unallocated student"
        placeholder="Name, email or register number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No unallocated students"
          description="Everyone matching has a room already."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {students.map((s) => (
            <OptionButton key={s.id} selected={selected?.id === s.id} onClick={() => onSelect(s)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {s.registerNo} · {s.department} · Y{s.year}
                  </p>
                </div>
                <GenderBadge gender={s.gender} />
              </div>
            </OptionButton>
          ))}
        </div>
      )}
    </div>
  );
}

function HostelStep({ student, selected, onSelect }) {
  // Only hostels of the student's gender with at least one free bed.
  const { data, isLoading } = useHostels({
    gender: student.gender,
    hasAvailability: true,
    status: 'active',
    limit: 100,
  });
  const hostels = data?.data ?? [];
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (!hostels.length) {
    return (
      <EmptyState
        icon={Building}
        title={`No ${student.gender} hostel has free beds`}
        description="Add rooms or vacate a bed, then try again."
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Showing only <GenderBadge gender={student.gender} /> hostels with free beds for {student.name}.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {hostels.map((h) => (
          <OptionButton key={h.id} selected={selected?.id === h.id} onClick={() => onSelect(h)}>
            <p className="text-sm font-medium text-gray-900">{h.name}</p>
            <p className="mb-2 text-xs text-gray-500">
              {h.code} · {h.available} free of {h.beds} beds
            </p>
            <OccupancyBar occupied={h.occupied} capacity={h.beds} gender={h.gender} />
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

function RoomStep({ hostel, selected, onSelect }) {
  const { data, isLoading } = useRooms({ hostelId: hostel.id, available: true, limit: 200 });
  const rooms = data?.data ?? [];
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (!rooms.length) {
    return <EmptyState icon={BedDouble} title="No rooms with free beds" description="Pick another hostel." />;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rooms.map((r) => (
        <OptionButton key={r.id} selected={selected?.id === r.id} onClick={() => onSelect(r)}>
          <p className="text-sm font-semibold text-gray-900">Room {r.roomNumber}</p>
          <p className="text-xs text-gray-500">
            Floor {r.floor} · {labelize(r.roomType)}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-600">
            {r.available} free / {r.capacity}
          </p>
        </OptionButton>
      ))}
    </div>
  );
}

export default function AllocationWizard({ open, onClose, preselectedStudentId }) {
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState(null);
  const [hostel, setHostel] = useState(null);
  const [room, setRoom] = useState(null);
  const [startDate, setStartDate] = useState(todayIso());
  const createMutation = useCreateAllocation();
  const { data: preselected } = useStudent(open ? preselectedStudentId : null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setStudent(null);
      setHostel(null);
      setRoom(null);
      setStartDate(todayIso());
    }
  }, [open]);

  useEffect(() => {
    if (open && preselected && !preselected.allocationId) {
      setStudent(preselected);
      setStep(1);
    }
  }, [open, preselected]);

  const canNext = [Boolean(student), Boolean(hostel), Boolean(room), Boolean(startDate)][step];

  const submit = () =>
    createMutation.mutate(
      { studentId: student.id, roomId: room.id, startDate },
      {
        onSuccess: () => {
          toast.success(`${student.name} allocated to ${hostel.name}, room ${room.roomNumber}`);
          onClose();
        },
        onError: (err) => {
          const code = err?.response?.data?.error?.code;
          if (code === 'ROOM_FULL') {
            setRoom(null);
            setStep(2);
          }
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Allocate a room"
      description="Students can only be placed in hostels of their own gender."
      footer={
        <>
          {step > 0 && (
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} className="sm:mr-auto">
              Back
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue
            </Button>
          ) : (
            <Button icon={Check} onClick={submit} loading={createMutation.isPending} disabled={!canNext}>
              Confirm allocation
            </Button>
          )}
        </>
      }
    >
      <Stepper step={step} />
      {step === 0 && (
        <StudentStep
          selected={student}
          onSelect={(s) => {
            setStudent(s);
            setHostel(null);
            setRoom(null);
          }}
        />
      )}
      {step === 1 && student && (
        <HostelStep
          student={student}
          selected={hostel}
          onSelect={(h) => {
            setHostel(h);
            setRoom(null);
          }}
        />
      )}
      {step === 2 && hostel && <RoomStep hostel={hostel} selected={room} onSelect={setRoom} />}
      {step === 3 && student && hostel && room && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Student</dt>
              <dd className="mt-1 font-medium text-gray-900">{student.name}</dd>
              <dd className="text-xs text-gray-500">{student.registerNo}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Hostel</dt>
              <dd className="mt-1 font-medium text-gray-900">{hostel.name}</dd>
              <dd>
                <GenderBadge gender={hostel.gender} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Room</dt>
              <dd className="mt-1 font-medium text-gray-900">Room {room.roomNumber}</dd>
              <dd className="text-xs text-gray-500">
                {room.available} of {room.capacity} beds free
              </dd>
            </div>
          </dl>
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}
    </Modal>
  );
}
