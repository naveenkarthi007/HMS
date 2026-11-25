import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  useAssignWardenHostels,
  useCreateWarden,
  useDeleteWarden,
  useUpdateWarden,
  useWardens,
} from '../../hooks/useWardens';
import { useHostelOptions } from '../../hooks/useHostels';
import { useHostelRooms } from '../../hooks/useRooms';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input, { Checkbox } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { GENDER_OPTIONS, formatDateTime } from '../../lib/format';
import { email, emptyToNull, optionalPhone, passwordSchema, requiredText } from '../../lib/validation';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '' };

const createSchema = z.object({
  name: requiredText('Name'),
  email,
  password: passwordSchema,
  gender: z.enum(['male', 'female'], { error: 'Select a gender' }),
  phone: optionalPhone,
});

const editSchema = z.object({
  name: requiredText('Name'),
  gender: z.enum(['male', 'female'], { error: 'Select a gender' }),
  phone: optionalPhone,
  isActive: z.boolean(),
  password: z.string().refine((v) => v === '' || passwordSchema.safeParse(v).success, {
    message: 'At least 8 characters with a letter and a number',
  }),
});

/** Parses room specs like "100 to 200", "100, 112", or "100 to 110 and 140 to 150". */
function parseRoomSpec(text) {
  if (!text?.trim()) return [];
  const tokens = text
    .split(/[,;]+|\band\b/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const items = [];
  for (const token of tokens) {
    const rangeMatch = token.match(/^([^\s-]+)\s*(?:-|to)\s*([^\s-]+)$/i);
    if (rangeMatch) {
      items.push({ scopeType: 'room_range', roomStart: rangeMatch[1].trim(), roomEnd: rangeMatch[2].trim() });
    } else {
      items.push({ scopeType: 'room', roomNumber: token });
    }
  }
  return items;
}

/** Parses floor numbers like "1, 2" or "0, 1". */
function parseFloorSpec(text) {
  if (!text?.trim()) return [];
  const seen = new Set();
  const floors = [];
  for (const part of text.split(/[,;\s]+|\band\b/i).map((t) => t.trim()).filter(Boolean)) {
    const n = Number(part);
    if (Number.isInteger(n) && n >= -5 && n <= 100 && !seen.has(n)) {
      seen.add(n);
      floors.push(n);
    }
  }
  return floors;
}

function assignmentsToEditorState(assignments = []) {
  const state = {};
  for (const a of assignments) {
    if (!state[a.hostelId]) {
      state[a.hostelId] = { enabled: true, mode: 'hostel', floors: [], rooms: [] };
    }
    const entry = state[a.hostelId];
    if (a.scopeType === 'floor') {
      entry.mode = 'custom';
      entry.floors.push(a.floor);
    } else if (a.scopeType === 'room_range') {
      entry.mode = 'custom';
      entry.rooms.push(`${a.roomStart}-${a.roomEnd}`);
    } else if (a.scopeType === 'room') {
      entry.mode = 'custom';
      entry.rooms.push(a.roomNumber);
    }
  }
  const result = {};
  for (const [hostelId, entry] of Object.entries(state)) {
    result[hostelId] = {
      enabled: true,
      mode: entry.mode,
      floorsText: entry.floors.join(', '),
      roomsText: entry.rooms.join(', '),
    };
  }
  return result;
}

function editorStateToAssignments(state) {
  const assignments = [];
  for (const [hostelIdStr, cfg] of Object.entries(state)) {
    if (!cfg?.enabled) continue;
    const hostelId = Number(hostelIdStr);
    if (cfg.mode !== 'custom') {
      assignments.push({ hostelId, scopeType: 'hostel' });
      continue;
    }
    const floors = parseFloorSpec(cfg.floorsText);
    const rooms = parseRoomSpec(cfg.roomsText);
    if (!floors.length && !rooms.length) {
      assignments.push({ hostelId, scopeType: 'hostel' });
      continue;
    }
    for (const floor of floors) {
      assignments.push({ hostelId, scopeType: 'floor', floor });
    }
    for (const r of rooms) {
      assignments.push({ hostelId, ...r });
    }
  }
  return assignments;
}

function roomMatchesRules(room, floors, roomRules) {
  if (floors.includes(Number(room.floor))) return true;
  const num = String(room.roomNumber ?? '').trim();
  for (const rule of roomRules) {
    if (rule.scopeType === 'room' && num === rule.roomNumber) return true;
    if (rule.scopeType === 'room_range') {
      const bothNumeric = /^\d+$/.test(rule.roomStart) && /^\d+$/.test(rule.roomEnd) && /^\d+$/.test(num);
      if (bothNumeric) {
        const lo = Math.min(Number(rule.roomStart), Number(rule.roomEnd));
        const hi = Math.max(Number(rule.roomStart), Number(rule.roomEnd));
        if (Number(num) >= lo && Number(num) <= hi) return true;
      } else if (num >= rule.roomStart && num <= rule.roomEnd) {
        return true;
      }
    }
  }
  return false;
}

function HostelAssignmentCard({ hostel, cfg, onToggle, onUpdate }) {
  const enabled = Boolean(cfg?.enabled);
  const isCustom = enabled && cfg.mode === 'custom';
  const { data: roomsData, isLoading: roomsLoading } = useHostelRooms(isCustom ? hostel.id : null, { limit: 200 });
  const rooms = roomsData?.data ?? [];
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [lastClickedRoom, setLastClickedRoom] = useState(null);

  const parsedFloors = isCustom ? parseFloorSpec(cfg.floorsText) : [];
  const parsedRooms = isCustom ? parseRoomSpec(cfg.roomsText) : [];

  const floorsMap = new Map();
  for (const r of rooms) {
    const f = Number(r.floor);
    floorsMap.set(f, (floorsMap.get(f) || 0) + 1);
  }
  const availableFloors = [...floorsMap.entries()].sort((a, b) => a[0] - b[0]);

  const matchedRooms = isCustom ? rooms.filter((r) => roomMatchesRules(r, parsedFloors, parsedRooms)) : [];
  const matchedSet = new Set(matchedRooms.map((r) => r.id));

  const formatRoomRules = (rules) =>
    rules.map((r) => (r.scopeType === 'room_range' ? `${r.roomStart}-${r.roomEnd}` : r.roomNumber)).join(', ');

  const toggleFloor = (floorNum) => {
    const next = parsedFloors.includes(floorNum)
      ? parsedFloors.filter((f) => f !== floorNum)
      : [...parsedFloors, floorNum].sort((a, b) => a - b);
    onUpdate({ floorsText: next.join(', ') });
  };

  const handleRoomChipClick = (roomNumber, e) => {
    if (e.shiftKey && lastClickedRoom && lastClickedRoom !== roomNumber) {
      const nextRules = [...parsedRooms, { scopeType: 'room_range', roomStart: lastClickedRoom, roomEnd: roomNumber }];
      onUpdate({ roomsText: formatRoomRules(nextRules) });
      setLastClickedRoom(null);
      return;
    }
    setLastClickedRoom(roomNumber);
    const exists = parsedRooms.some((r) => r.scopeType === 'room' && r.roomNumber === roomNumber);
    const nextRules = exists
      ? parsedRooms.filter((r) => !(r.scopeType === 'room' && r.roomNumber === roomNumber))
      : [...parsedRooms, { scopeType: 'room', roomNumber }];
    onUpdate({ roomsText: formatRoomRules(nextRules) });
  };

  const addQuickRange = () => {
    const start = rangeStart.trim();
    const end = rangeEnd.trim();
    if (!start || !end) return;
    const nextRules = [...parsedRooms, { scopeType: 'room_range', roomStart: start, roomEnd: end }];
    onUpdate({ roomsText: formatRoomRules(nextRules) });
    setRangeStart('');
    setRangeEnd('');
  };

  const removeRoomRule = (idxToRemove) => {
    const nextRules = parsedRooms.filter((_, idx) => idx !== idxToRemove);
    onUpdate({ roomsText: formatRoomRules(nextRules) });
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        enabled ? 'border-primary-500 bg-primary-50/40' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>{hostel.name}</span>
          <GenderBadge gender={hostel.gender} />
        </label>
        {enabled && (
          <div className="flex rounded-md border border-gray-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onUpdate({ mode: 'hostel' })}
              className={`rounded px-2.5 py-1 font-medium ${
                cfg.mode !== 'custom' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Entire hostel
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ mode: 'custom' })}
              className={`rounded px-2.5 py-1 font-medium ${
                cfg.mode === 'custom' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Floors / Rooms
            </button>
          </div>
        )}
      </div>

      {isCustom && (
        <div className="mt-3 space-y-3 border-t border-primary-100 pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Floors (optional)</label>
              <input
                type="text"
                value={cfg.floorsText}
                onChange={(e) => onUpdate({ floorsText: e.target.value })}
                placeholder="e.g. 1, 2"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {availableFloors.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {availableFloors.map(([f, count]) => {
                    const active = parsedFloors.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFloor(f)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {f === 0 ? 'Ground' : `Floor ${f}`} ({count})
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">Comma-separated floor numbers (0 = ground).</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Room numbers / ranges (optional)</label>
              <input
                type="text"
                value={cfg.roomsText}
                onChange={(e) => onUpdate({ roomsText: e.target.value })}
                placeholder="e.g. 100-110, 140-150 or 100, 112"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  placeholder="From (e.g. 100)"
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="text"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  placeholder="To (e.g. 150)"
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addQuickRange}
                  disabled={!rangeStart.trim() || !rangeEnd.trim()}
                  className="shrink-0 rounded bg-gray-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {(parsedFloors.length > 0 || parsedRooms.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {parsedFloors.map((f) => (
                <button
                  key={`f-${f}`}
                  type="button"
                  onClick={() => toggleFloor(f)}
                  className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-200"
                  title="Click to remove"
                >
                  {f === 0 ? 'Ground floor' : `Floor ${f}`}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {parsedRooms.map((r, idx) => (
                <button
                  key={`r-${idx}`}
                  type="button"
                  onClick={() => removeRoomRule(idx)}
                  className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
                  title="Click to remove"
                >
                  {r.scopeType === 'room_range' ? `Rooms ${r.roomStart}–${r.roomEnd}` : `Room ${r.roomNumber}`}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => onUpdate({ floorsText: '', roomsText: '' })}
                className="ml-auto text-xs text-gray-500 hover:text-gray-800"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="rounded-md bg-white/80 p-2.5 ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-700">
                {roomsLoading
                  ? 'Loading rooms...'
                  : rooms.length === 0
                    ? 'No rooms created in this hostel yet'
                    : parsedFloors.length === 0 && parsedRooms.length === 0
                      ? `Select floors or rooms (empty = all ${rooms.length} rooms)`
                      : `Matches ${matchedRooms.length} of ${rooms.length} rooms`}
              </span>
              {rooms.length > 0 && (
                <span className="text-[11px] text-gray-400">Click room · Shift+click two rooms for range</span>
              )}
            </div>
            {rooms.length > 0 && (
              <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {rooms.map((r) => {
                  const isMatched = matchedSet.has(r.id);
                  const isAnchor = lastClickedRoom === r.roomNumber;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={(e) => handleRoomChipClick(r.roomNumber, e)}
                      title={`Floor ${r.floor} · ${r.occupied}/${r.capacity} occupied`}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                        isMatched
                          ? 'bg-emerald-600 text-white'
                          : isAnchor
                            ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-400'
                            : 'border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {r.roomNumber}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WardenAssignmentsEditor({ value, onChange, preferredGender }) {
  const { hostels, isLoading } = useHostelOptions();
  if (isLoading) return <p className="text-sm text-gray-500">Loading hostels...</p>;
  if (!hostels.length) return <p className="text-sm text-gray-500">No hostels yet.</p>;

  const sortedHostels = preferredGender
    ? [...hostels].sort((a, b) => (a.gender === preferredGender ? -1 : b.gender === preferredGender ? 1 : 0))
    : hostels;

  const toggleHostel = (id) => {
    const current = value[id];
    if (current?.enabled) {
      const next = { ...value };
      delete next[id];
      onChange(next);
    } else {
      onChange({
        ...value,
        [id]: { enabled: true, mode: 'hostel', floorsText: '', roomsText: '' },
      });
    }
  };

  const updateHostel = (id, patch) => {
    onChange({
      ...value,
      [id]: { ...value[id], ...patch },
    });
  };

  return (
    <div className="space-y-2.5">
      {sortedHostels.map((h) => (
        <HostelAssignmentCard
          key={h.id}
          hostel={h}
          cfg={value[h.id]}
          onToggle={() => toggleHostel(h.id)}
          onUpdate={(patch) => updateHostel(h.id, patch)}
        />
      ))}
    </div>
  );
}

function WardenFormModal({ open, onClose, warden }) {
  const { managedGender } = useAccess();
  const isEdit = Boolean(warden);
  const createMutation = useCreateWarden();
  const updateMutation = useUpdateWarden();
  const [assignmentState, setAssignmentState] = useState({});
  const genderOptions = managedGender ? GENDER_OPTIONS.filter((o) => o.value === managedGender) : GENDER_OPTIONS;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(isEdit ? editSchema : createSchema) });
  const selectedGender = watch('gender');

  useEffect(() => {
    if (!open) return;
    setAssignmentState({});
    reset(
      warden
        ? {
            name: warden.name,
            gender: warden.gender,
            phone: warden.phone ?? '',
            isActive: warden.isActive,
            password: '',
          }
        : { name: '', email: '', password: '', gender: managedGender ?? '', phone: '' },
    );
  }, [open, warden, managedGender, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body = emptyToNull(values);
    try {
      if (isEdit) {
        if (!values.password) delete body.password;
        await updateMutation.mutateAsync({ id: warden.id, ...body });
        toast.success('Warden updated');
      } else {
        await createMutation.mutateAsync({ ...body, assignments: editorStateToAssignments(assignmentState) });
        toast.success('Warden created');
      }
      onClose();
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${warden.name}` : 'New warden'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="warden-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create warden'}
          </Button>
        </>
      }
    >
      <form id="warden-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full name" required error={errors.name?.message} {...register('name')} />
        {!isEdit && <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />}
        <Select
          label="Gender"
          required
          placeholder="Select gender"
          options={genderOptions}
          error={errors.gender?.message}
          {...register('gender')}
        />
        <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        <Input
          label={isEdit ? 'Reset password (optional)' : 'Password'}
          type="password"
          autoComplete="new-password"
          required={!isEdit}
          hint="At least 8 characters with a letter and a number"
          error={errors.password?.message}
          {...register('password')}
        />
        {isEdit && (
          <Checkbox
            label="Account active"
            className="self-center"
            description="Inactive wardens cannot sign in"
            {...register('isActive')}
          />
        )}
        {!isEdit && (
          <div className="sm:col-span-2">
            <p className="form-label">Assign hostels, floors or rooms</p>
            <WardenAssignmentsEditor
              value={assignmentState}
              onChange={setAssignmentState}
              preferredGender={selectedGender}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

function AssignHostelsModal({ warden, onClose }) {
  const assignMutation = useAssignWardenHostels();
  const [assignmentState, setAssignmentState] = useState({});

  useEffect(() => {
    if (warden) {
      if (warden.assignments?.length) {
        setAssignmentState(assignmentsToEditorState(warden.assignments));
      } else {
        setAssignmentState(
          assignmentsToEditorState((warden.hostelIds || []).map((hostelId) => ({ hostelId, scopeType: 'hostel' }))),
        );
      }
    }
  }, [warden]);

  return (
    <Modal
      open={Boolean(warden)}
      onClose={onClose}
      size="lg"
      title={`Assignments for ${warden?.name ?? ''}`}
      description="Assign entire hostels, specific floors, or room numbers/ranges. Wardens only see students, leaves, complaints and attendance in their assigned scope."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={assignMutation.isPending}
            onClick={() =>
              assignMutation.mutate(
                { id: warden.id, assignments: editorStateToAssignments(assignmentState) },
                {
                  onSuccess: () => {
                    toast.success('Warden assignments saved');
                    onClose();
                  },
                },
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <WardenAssignmentsEditor
        value={assignmentState}
        onChange={setAssignmentState}
        preferredGender={warden?.gender}
      />
    </Modal>
  );
}

export default function WardensPage() {
  const { canManage } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useWardens(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const deleteMutation = useDeleteWarden();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Warden',
      render: (w) => (
        <div>
          <p className="font-medium text-gray-900">{w.name}</p>
          <p className="text-xs text-gray-500">{w.email}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (w) => <GenderBadge gender={w.gender} /> },
    { key: 'phone', header: 'Phone', render: (w) => w.phone || '—' },
    {
      key: 'hostelNames',
      header: 'Assigned scope',
      render: (w) =>
        w.assignmentSummary ? (
          <button
            type="button"
            onClick={() => setAssigning(w)}
            className="flex flex-wrap gap-1 text-left"
            title="Click to edit assignments"
          >
            {w.assignmentSummary.split('; ').map((part, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 hover:bg-primary-50 hover:text-primary-700"
              >
                {part}
              </span>
            ))}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAssigning(w)}
            className="text-xs text-gray-400 hover:text-primary-600"
          >
            Not assigned
          </button>
        ),
    },
    { key: 'isActive', header: 'Status', render: (w) => <StatusBadge status={w.isActive ? 'active' : 'inactive'} /> },
    { key: 'lastLoginAt', header: 'Last sign-in', render: (w) => formatDateTime(w.lastLoginAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (w) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Assign hostels"
            aria-label="Assign hostels"
            onClick={() => setAssigning(w)}
          >
            <Building className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label={`Edit ${w.name}`}
            onClick={() => {
              setEditing(w);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            aria-label={`Delete ${w.name}`}
            onClick={() => setDeleting(w)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wardens"
        description="Wardens manage the hostels they are assigned to."
        actions={
          <>
            <ImportExportActions
              exportPath="/wardens/export"
              exportParams={filters}
              importKind="wardens"
              canImport={canManage}
            />
            {canManage && (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New warden
              </Button>
            )}
          </>
        }
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={(patch) => setFilters('gender' in patch ? { ...patch, hostelId: '' } : patch)}
          resetFilters={resetFilters}
          searchPlaceholder="Name, email, phone"
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
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </FilterBar>
        <Table
          columns={canManage ? columns : columns.filter((c) => c.key !== 'actions')}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={ShieldCheck}
          emptyTitle="No wardens found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <WardenFormModal open={formOpen} onClose={() => setFormOpen(false)} warden={editing} />
      <AssignHostelsModal warden={assigning} onClose={() => setAssigning(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete warden"
        message={`Delete ${deleting?.name}? Their hostel assignments are removed; complaints assigned to them become unassigned.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Warden deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
