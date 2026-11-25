import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import {
  useCreateHostelManager,
  useDeleteHostelManager,
  useHostelManagers,
  useUpdateHostelManager,
} from '../../hooks/useHostelManagers';
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
import Badge, { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { ROLE_LABELS, formatDateTime } from '../../lib/format';
import { email, emptyToNull, optionalPhone, passwordSchema, requiredText } from '../../lib/validation';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', role: '', status: '' };

const MANAGER_ROLE_OPTIONS = [
  { value: 'boys_hostel_manager', label: 'Boys Hostel Manager' },
  { value: 'girls_hostel_manager', label: 'Girls Hostel Manager' },
];

const createSchema = z.object({
  name: requiredText('Name'),
  email,
  password: passwordSchema,
  role: z.enum(['boys_hostel_manager', 'girls_hostel_manager'], { error: 'Select a role' }),
  phone: optionalPhone,
});

const editSchema = z.object({
  name: requiredText('Name'),
  role: z.enum(['boys_hostel_manager', 'girls_hostel_manager'], { error: 'Select a role' }),
  phone: optionalPhone,
  isActive: z.boolean(),
  password: z.string().refine((v) => v === '' || passwordSchema.safeParse(v).success, {
    message: 'At least 8 characters with a letter and a number',
  }),
});

function ManagerFormModal({ open, onClose, manager }) {
  const isEdit = Boolean(manager);
  const createMutation = useCreateHostelManager();
  const updateMutation = useUpdateHostelManager();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(isEdit ? editSchema : createSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      manager
        ? {
            name: manager.name,
            role: manager.role,
            phone: manager.phone ?? '',
            isActive: manager.isActive,
            password: '',
          }
        : { name: '', email: '', password: '', role: '', phone: '' },
    );
  }, [open, manager, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body = emptyToNull(values);
    try {
      if (isEdit) {
        if (!values.password) delete body.password;
        await updateMutation.mutateAsync({ id: manager.id, ...body });
        toast.success('Hostel manager updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Hostel manager created');
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
      title={isEdit ? `Edit ${manager.name}` : 'New hostel manager'}
      description="Boys hostel managers manage male hostels and students; girls hostel managers manage female hostels and students."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="hostel-manager-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create manager'}
          </Button>
        </>
      }
    >
      <form id="hostel-manager-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full name" required error={errors.name?.message} {...register('name')} />
        {!isEdit && <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />}
        <Select
          label="Role"
          required
          placeholder="Select role"
          options={MANAGER_ROLE_OPTIONS}
          error={errors.role?.message}
          {...register('role')}
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
            description="Inactive managers cannot sign in"
            {...register('isActive')}
          />
        )}
      </form>
    </Modal>
  );
}

export default function HostelManagersPage() {
  const { canManageManagers } = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useHostelManagers(filters);
  const deleteMutation = useDeleteHostelManager();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Manager',
      render: (m) => (
        <div>
          <p className="font-medium text-gray-900">{m.name}</p>
          <p className="text-xs text-gray-500">{m.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (m) => (
        <Badge tone={m.role === 'boys_hostel_manager' ? 'blue' : 'pink'}>{ROLE_LABELS[m.role]}</Badge>
      ),
    },
    { key: 'gender', header: 'Scope', render: (m) => <GenderBadge gender={m.gender} /> },
    { key: 'phone', header: 'Phone', render: (m) => m.phone || '—' },
    { key: 'isActive', header: 'Status', render: (m) => <StatusBadge status={m.isActive ? 'active' : 'inactive'} /> },
    { key: 'lastLoginAt', header: 'Last sign-in', render: (m) => formatDateTime(m.lastLoginAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (m) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label={`Edit ${m.name}`}
            onClick={() => {
              setEditing(m);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            aria-label={`Delete ${m.name}`}
            onClick={() => setDeleting(m)}
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
        title="Hostel managers"
        description="Boys and girls hostel managers administer all hostels and students of their assigned gender."
        actions={
          <>
            <ImportExportActions exportPath="/hostel-managers/export" exportParams={filters} canImport={false} />
            {canManageManagers && (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New manager
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
          searchPlaceholder="Name, email, phone"
        >
          <FilterSelect
            value={filters.role}
            onChange={(role) => setFilters({ role })}
            allLabel="All roles"
            options={MANAGER_ROLE_OPTIONS}
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
          columns={canManageManagers ? columns : columns.filter((c) => c.key !== 'actions')}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={UserCog}
          emptyTitle="No hostel managers found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <ManagerFormModal open={formOpen} onClose={() => setFormOpen(false)} manager={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete hostel manager"
        message={`Delete ${deleting?.name}? They will no longer be able to sign in.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Hostel manager deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
