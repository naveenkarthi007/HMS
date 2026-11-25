import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building, DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCreateHostel, useDeleteHostel, useHostels, useUpdateHostel } from '../../hooks/useHostels';
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
import OccupancyBar from '../../components/ui/OccupancyBar';
import { GENDER_OPTIONS } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', status: '' };

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only'),
  gender: z.enum(['male', 'female'], { error: 'Select a gender' }),
  address: z.string().trim().max(255),
  isActive: z.boolean(),
});

function HostelFormModal({ open, onClose, hostel }) {
  const { managedGender } = useAccess();
  const createMutation = useCreateHostel();
  const updateMutation = useUpdateHostel();
  const isEdit = Boolean(hostel);
  const genderOptions = managedGender ? GENDER_OPTIONS.filter((o) => o.value === managedGender) : GENDER_OPTIONS;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: hostel?.name ?? '',
        code: hostel?.code ?? '',
        gender: hostel?.gender ?? managedGender ?? '',
        address: hostel?.address ?? '',
        isActive: hostel?.isActive ?? true,
      });
    }
  }, [open, hostel, managedGender, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body = { ...values, code: values.code.toUpperCase(), address: values.address || null };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: hostel.id, ...body });
        toast.success('Hostel updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Hostel created');
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
      title={isEdit ? 'Edit hostel' : 'New hostel'}
      description="Students can only be allocated to a hostel of their own gender."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="hostel-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create hostel'}
          </Button>
        </>
      }
    >
      <form id="hostel-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Name" required className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
        <Input label="Code" required placeholder="BH1" error={errors.code?.message} {...register('code')} />
        <Select
          label="Gender"
          required
          placeholder="Select gender"
          options={genderOptions}
          error={errors.gender?.message}
          hint={isEdit && hostel.occupied > 0 ? 'Cannot change while residents are allocated' : undefined}
          {...register('gender')}
        />
        <Input label="Address" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
        <Checkbox
          label="Active"
          description="Inactive hostels cannot receive new allocations"
          className="sm:col-span-2"
          {...register('isActive')}
        />
      </form>
    </Modal>
  );
}

export default function HostelsPage() {
  const { canManage } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useHostels(filters);
  const deleteMutation = useDeleteHostel();
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Hostel',
      render: (h) => (
        <div>
          <p className="font-medium text-gray-900">{h.name}</p>
          <p className="text-xs text-gray-500">{h.code}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (h) => <GenderBadge gender={h.gender} /> },
    { key: 'roomCount', header: 'Rooms', className: 'tabular-nums' },
    {
      key: 'occupancy',
      header: 'Occupancy',
      render: (h) => <OccupancyBar occupied={h.occupied} capacity={h.beds} gender={h.gender} />,
    },
    { key: 'available', header: 'Free beds', className: 'tabular-nums' },
    {
      key: 'wardenNames',
      header: 'Wardens',
      render: (h) => <span className="text-sm">{h.wardenNames || <span className="text-gray-400">None</span>}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (h) => <StatusBadge status={h.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (h) => (
        <div className="flex justify-end gap-1">
          <Link
            to={`/admin/rooms?hostelId=${h.id}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            title="View rooms"
            aria-label={`View rooms of ${h.name}`}
          >
            <DoorOpen className="h-4 w-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label={`Edit ${h.name}`}
            onClick={() => {
              setEditing(h);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            aria-label={`Delete ${h.name}`}
            onClick={() => setDeleting(h)}
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
        title="Hostels"
        description="Male and female hostels of your organisation."
        actions={
          <>
            <ImportExportActions
              exportPath="/hostels/export"
              exportParams={filters}
              importKind="hostels"
              canImport={canManage}
            />
            {canManage && (
              <Button icon={Plus} onClick={openCreate}>
                New hostel
              </Button>
            )}
          </>
        }
      />
      <Card padded={false}>
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          searchPlaceholder="Search name or code"
        >
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
          emptyIcon={Building}
          emptyTitle="No hostels found"
          emptyAction={
            canManage && (
              <Button size="sm" icon={Plus} onClick={openCreate}>
                Add a hostel
              </Button>
            )
          }
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <HostelFormModal open={formOpen} onClose={() => setFormOpen(false)} hostel={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete hostel"
        message={`Delete ${deleting?.name}? Hostels with rooms cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Hostel deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
