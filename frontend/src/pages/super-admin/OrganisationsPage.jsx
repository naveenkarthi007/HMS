import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building2, Eye, Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import {
  useCreateOrgAdmin,
  useCreateOrganisation,
  useDeleteOrganisation,
  useOrganisationAdmins,
  useOrganisations,
  useUpdateOrgAdmin,
  useUpdateOrganisation,
} from '../../hooks/useOrganisations';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { usePlatformView } from '../../context/PlatformViewContext';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input, { Checkbox } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { GENDER_OPTIONS, formatDateTime } from '../../lib/format';
import { email, emptyToNull, optionalPhone, passwordSchema, requiredText } from '../../lib/validation';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', status: '' };

const orgSchema = z.object({
  name: requiredText('Name', 2, 150),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be 2–20 characters')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only'),
  address: z.string().trim().max(255),
  contactEmail: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
  contactPhone: optionalPhone,
  isActive: z.boolean(),
});

const adminSchema = z.object({
  name: requiredText('Name'),
  email,
  password: passwordSchema,
  gender: z.string(),
  phone: optionalPhone,
});

function OrganisationFormModal({ open, onClose, organisation }) {
  const isEdit = Boolean(organisation);
  const createMutation = useCreateOrganisation();
  const updateMutation = useUpdateOrganisation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(orgSchema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: organisation?.name ?? '',
      code: organisation?.code ?? '',
      address: organisation?.address ?? '',
      contactEmail: organisation?.contactEmail ?? '',
      contactPhone: organisation?.contactPhone ?? '',
      isActive: organisation?.isActive ?? true,
    });
  }, [open, organisation, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body = emptyToNull({ ...values, code: values.code.toUpperCase() });
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: organisation.id, ...body });
        toast.success('Organisation updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Organisation created');
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
      title={isEdit ? 'Edit organisation' : 'New organisation'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="org-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create organisation'}
          </Button>
        </>
      }
    >
      <form id="org-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Name" required className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
        <Input label="Code" required placeholder="GIT" error={errors.code?.message} {...register('code')} />
        <Input label="Contact phone" error={errors.contactPhone?.message} {...register('contactPhone')} />
        <Input
          label="Contact email"
          type="email"
          className="sm:col-span-2"
          error={errors.contactEmail?.message}
          {...register('contactEmail')}
        />
        <Input label="Address" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
        <Checkbox
          label="Active"
          description="Users of inactive organisations cannot sign in"
          className="sm:col-span-2"
          {...register('isActive')}
        />
      </form>
    </Modal>
  );
}

function AdminsModal({ organisation, onClose }) {
  const { data: admins, isLoading } = useOrganisationAdmins(organisation?.id);
  const createMutation = useCreateOrgAdmin();
  const updateMutation = useUpdateOrgAdmin();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: '', email: '', password: '', gender: '', phone: '' },
  });

  useEffect(() => {
    if (organisation) reset({ name: '', email: '', password: '', gender: '', phone: '' });
  }, [organisation, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({ organisationId: organisation.id, ...emptyToNull(values) });
      toast.success('Organisation admin created');
      reset({ name: '', email: '', password: '', gender: '', phone: '' });
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  const toggleActive = (admin) =>
    updateMutation.mutate(
      { organisationId: organisation.id, adminId: admin.id, isActive: !admin.isActive },
      { onSuccess: () => toast.success(admin.isActive ? 'Admin deactivated' : 'Admin activated') },
    );

  return (
    <Modal open={Boolean(organisation)} onClose={onClose} size="lg" title={`Admins · ${organisation?.name ?? ''}`}>
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : admins?.length ? (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500">
                    {a.email} · last sign-in {formatDateTime(a.lastLoginAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.isActive ? 'active' : 'inactive'} />
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => toggleActive(a)}
                    disabled={updateMutation.isPending}
                  >
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No admins yet. Create the first one below.</p>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-gray-100 p-4" noValidate>
          <p className="text-sm font-semibold text-gray-900">Add an organisation admin</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" required error={errors.name?.message} {...register('name')} />
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
            <Select label="Gender" placeholder="Prefer not to say" options={GENDER_OPTIONS} {...register('gender')} />
          </div>
          <Button type="submit" icon={Plus} loading={isSubmitting}>
            Create admin
          </Button>
        </form>
      </div>
    </Modal>
  );
}

export default function OrganisationsPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useOrganisations(filters);
  const deleteMutation = useDeleteOrganisation();
  const { enter } = usePlatformView();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managingAdmins, setManagingAdmins] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Organisation',
      render: (o) => (
        <div>
          <p className="font-medium text-gray-900">{o.name}</p>
          <p className="text-xs text-gray-500">{o.code}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (o) => (
        <div className="text-sm">
          <p>{o.contactEmail || '—'}</p>
          <p className="text-xs text-gray-500">{o.contactPhone}</p>
        </div>
      ),
    },
    { key: 'hostelCount', header: 'Hostels', className: 'tabular-nums' },
    { key: 'studentCount', header: 'Students', className: 'tabular-nums' },
    { key: 'adminCount', header: 'Admins', className: 'tabular-nums' },
    { key: 'isActive', header: 'Status', render: (o) => <StatusBadge status={o.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (o) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="View organisation (read-only)"
            aria-label={`View ${o.name}`}
            onClick={() => enter(o)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Admins"
            aria-label={`Admins of ${o.name}`}
            onClick={() => setManagingAdmins(o)}
          >
            <UserCog className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label={`Edit ${o.name}`}
            onClick={() => {
              setEditing(o);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            aria-label={`Delete ${o.name}`}
            onClick={() => setDeleting(o)}
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
        title="Organisations"
        description="Colleges and institutes on the platform."
        actions={
          <>
            <ImportExportActions exportPath="/organisations/export" exportParams={filters} importKind="organisations" />
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              New organisation
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
          searchPlaceholder="Name, code, email"
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
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={Building2}
          emptyTitle="No organisations found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <OrganisationFormModal open={formOpen} onClose={() => setFormOpen(false)} organisation={editing} />
      <AdminsModal organisation={managingAdmins} onClose={() => setManagingAdmins(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete organisation"
        message={`Delete ${deleting?.name}? Only empty organisations (no hostels, students or admins) can be deleted.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Organisation deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
