import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { DoorOpen, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCreateRoom, useDeleteRoom, useRoom, useRooms, useUpdateRoom } from '../../hooks/useRooms';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import OccupancyBar from '../../components/ui/OccupancyBar';
import { Spinner } from '../../components/ui/Spinner';
import { formatDate, labelize } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '', available: '' };

const ROOM_TYPES = [
  { value: 'single', label: 'Single', capacity: 1 },
  { value: 'double', label: 'Double', capacity: 2 },
  { value: 'quad', label: 'Quad', capacity: 4 },
];

const schema = z.object({
  hostelId: z.string().min(1, 'Select a hostel'),
  roomNumber: z
    .string()
    .trim()
    .min(1, 'Room number is required')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only'),
  floor: z.coerce.number({ error: 'Floor is required' }).int().min(-2).max(100),
  roomType: z.enum(['single', 'double', 'quad']),
  capacity: z.coerce.number().int().min(1, 'Capacity must be 1–6').max(6, 'Capacity must be 1–6'),
  status: z.enum(['active', 'maintenance']),
});

function RoomFormModal({ open, onClose, room, defaultHostelId }) {
  const { options: hostelOptions } = useHostelOptions();
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const isEdit = Boolean(room);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        hostelId: room ? String(room.hostelId) : defaultHostelId || '',
        roomNumber: room?.roomNumber ?? '',
        floor: room?.floor ?? 1,
        roomType: room?.roomType ?? 'double',
        capacity: room?.capacity ?? 2,
        status: room?.status ?? 'active',
      });
    }
  }, [open, room, defaultHostelId, reset]);

  const roomTypeField = register('roomType', {
    onChange: (e) => {
      const type = ROOM_TYPES.find((t) => t.value === e.target.value);
      if (type) setValue('capacity', type.capacity, { shouldValidate: true });
    },
  });

  const onSubmit = handleSubmit(async ({ hostelId, ...values }) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: room.id, ...values });
        toast.success('Room updated');
      } else {
        await createMutation.mutateAsync({ hostelId: Number(hostelId), ...values });
        toast.success('Room created');
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
      title={isEdit ? `Edit room ${room.roomNumber}` : 'New room'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="room-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create room'}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {isEdit ? (
          <div className="sm:col-span-2">
            <p className="form-label">Hostel</p>
            <p className="text-sm text-gray-900">{room.hostelName}</p>
            <input type="hidden" {...register('hostelId')} />
          </div>
        ) : (
          <Select
            label="Hostel"
            required
            className="sm:col-span-2"
            placeholder="Select hostel"
            options={hostelOptions}
            error={errors.hostelId?.message}
            {...register('hostelId')}
          />
        )}
        <Input label="Room number" required error={errors.roomNumber?.message} {...register('roomNumber')} />
        <Input label="Floor" type="number" required error={errors.floor?.message} {...register('floor')} />
        <Select label="Room type" options={ROOM_TYPES} error={errors.roomType?.message} {...roomTypeField} />
        <Input
          label="Capacity (beds)"
          type="number"
          min={1}
          max={6}
          required
          error={errors.capacity?.message}
          {...register('capacity')}
        />
        <Select
          label="Status"
          className="sm:col-span-2"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'maintenance', label: 'Under maintenance' },
          ]}
          error={errors.status?.message}
          {...register('status')}
        />
      </form>
    </Modal>
  );
}

function ResidentsModal({ roomId, onClose }) {
  const { data: room, isLoading } = useRoom(roomId);
  return (
    <Modal
      open={Boolean(roomId)}
      onClose={onClose}
      title={room ? `Room ${room.roomNumber} · ${room.hostelName}` : 'Room'}
    >
      {isLoading || !room ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <GenderBadge gender={room.gender} />
            <StatusBadge status={room.status} />
            <span>
              {labelize(room.roomType)} · Floor {room.floor} · {room.occupied}/{room.capacity} beds used
            </span>
          </div>
          {room.residents.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No residents in this room.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {room.residents.map((r) => (
                <li key={r.allocationId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500">
                      {r.registerNo} · {r.department} · Year {r.year}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">since {formatDate(r.startDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function RoomsPage() {
  const { canManage } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useRooms(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const deleteMutation = useDeleteRoom();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const columns = [
    {
      key: 'roomNumber',
      header: 'Room',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.roomNumber}</p>
          <p className="text-xs text-gray-500">Floor {r.floor}</p>
        </div>
      ),
    },
    { key: 'hostelName', header: 'Hostel' },
    { key: 'gender', header: 'Gender', render: (r) => <GenderBadge gender={r.gender} /> },
    { key: 'roomType', header: 'Type', render: (r) => labelize(r.roomType) },
    {
      key: 'occupancy',
      header: 'Occupancy',
      render: (r) => <OccupancyBar occupied={r.occupied} capacity={r.capacity} gender={r.gender} />,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Residents"
            aria-label="View residents"
            onClick={() => setViewingId(r.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Edit"
                aria-label={`Edit room ${r.roomNumber}`}
                onClick={() => {
                  setEditing(r);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                aria-label={`Delete room ${r.roomNumber}`}
                onClick={() => setDeleting(r)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Occupancy is calculated live from active allocations."
        actions={
          <>
            <ImportExportActions
              exportPath="/rooms/export"
              exportParams={filters}
              importKind="rooms"
              canImport={canManage}
            />
            {canManage && (
              <Button icon={Plus} onClick={openCreate}>
                New room
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
          searchPlaceholder="Search room or hostel"
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
              { value: 'maintenance', label: 'Maintenance' },
            ]}
          />
          <FilterSelect
            value={filters.available}
            onChange={(available) => setFilters({ available })}
            allLabel="Any availability"
            options={[
              { value: 'true', label: 'Has free beds' },
              { value: 'false', label: 'Full' },
            ]}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={DoorOpen}
          emptyTitle="No rooms found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <RoomFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        room={editing}
        defaultHostelId={filters.hostelId}
      />
      <ResidentsModal roomId={viewingId} onClose={() => setViewingId(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete room"
        message={`Delete room ${deleting?.roomNumber} in ${deleting?.hostelName}? Rooms with allocation history cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Room deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
