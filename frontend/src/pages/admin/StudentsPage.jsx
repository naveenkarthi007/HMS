import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { BedDouble, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useCreateStudent, useDeleteStudent, useStudents, useUpdateStudent } from '../../hooks/useStudents';
import { useHostelOptions } from '../../hooks/useHostels';
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
import { GENDER_OPTIONS, formatDate, toDateInput } from '../../lib/format';
import { email, emptyToNull, optionalPhone, passwordSchema, requiredText } from '../../lib/validation';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '' };
const YEAR_OPTIONS = [1, 2, 3, 4, 5].map((y) => ({ value: String(y), label: `Year ${y}` }));

const baseSchema = {
  name: requiredText('Name'),
  email,
  gender: z.enum(['male', 'female'], { error: 'Select a gender' }),
  phone: optionalPhone,
  registerNo: z
    .string()
    .trim()
    .min(1, 'Register number is required')
    .max(30)
    .regex(/^[A-Za-z0-9/-]+$/, 'Letters, digits, "/" and "-" only'),
  department: requiredText('Department', 2, 100),
  year: z.coerce.number().int().min(1, 'Year must be 1–5').max(5, 'Year must be 1–5'),
  dateOfBirth: z.string(),
  guardianName: z.string().trim().max(120),
  guardianPhone: optionalPhone,
  address: z.string().trim().max(255),
};

const createSchema = z.object({ ...baseSchema, password: passwordSchema });
const editSchema = z.object({
  ...baseSchema,
  isActive: z.boolean(),
  password: z.string().refine((v) => v === '' || passwordSchema.safeParse(v).success, {
    message: 'At least 8 characters with a letter and a number',
  }),
});

function StudentFormModal({ open, onClose, student }) {
  const { managedGender } = useAccess();
  const isEdit = Boolean(student);
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const genderOptions = managedGender ? GENDER_OPTIONS.filter((o) => o.value === managedGender) : GENDER_OPTIONS;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(isEdit ? editSchema : createSchema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: student?.name ?? '',
      email: student?.email ?? '',
      gender: student?.gender ?? managedGender ?? '',
      phone: student?.phone ?? '',
      registerNo: student?.registerNo ?? '',
      department: student?.department ?? '',
      year: student?.year ?? 1,
      dateOfBirth: toDateInput(student?.dateOfBirth),
      guardianName: student?.guardianName ?? '',
      guardianPhone: student?.guardianPhone ?? '',
      address: student?.address ?? '',
      password: '',
      ...(student ? { isActive: student.isActive } : {}),
    });
  }, [open, student, managedGender, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body = emptyToNull({ ...values, registerNo: values.registerNo.toUpperCase() });
    if (isEdit && !values.password) delete body.password;
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: student.id, ...body });
        toast.success('Student updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Student created');
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
      title={isEdit ? `Edit ${student.name}` : 'New student'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create student'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full name" required error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
        <Select
          label="Gender"
          required
          placeholder="Select gender"
          options={genderOptions}
          error={errors.gender?.message}
          hint={isEdit && student.allocationId ? 'Vacate the room before changing gender' : undefined}
          {...register('gender')}
        />
        <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        <Input label="Register number" required error={errors.registerNo?.message} {...register('registerNo')} />
        <Input label="Department" required error={errors.department?.message} {...register('department')} />
        <Select label="Year" required options={YEAR_OPTIONS} error={errors.year?.message} {...register('year')} />
        <Input label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
        <Input label="Guardian name" error={errors.guardianName?.message} {...register('guardianName')} />
        <Input label="Guardian phone" error={errors.guardianPhone?.message} {...register('guardianPhone')} />
        <Input label="Address" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
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
            description="Inactive students cannot sign in"
            className="self-center"
            {...register('isActive')}
          />
        )}
      </form>
    </Modal>
  );
}

function StudentDetailsModal({ student, onClose }) {
  const rows = student
    ? [
        ['Register no', student.registerNo],
        ['Email', student.email],
        ['Phone', student.phone || '—'],
        ['Department', `${student.department} · Year ${student.year}`],
        ['Date of birth', formatDate(student.dateOfBirth)],
        ['Guardian', [student.guardianName, student.guardianPhone].filter(Boolean).join(' · ') || '—'],
        ['Address', student.address || '—'],
        ['Room', student.roomNumber ? `${student.hostelName} · Room ${student.roomNumber}` : 'Not allocated'],
        ['Allocated on', formatDate(student.allocatedOn)],
      ]
    : [];
  return (
    <Modal open={Boolean(student)} onClose={onClose} title={student?.name}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

export default function StudentsPage() {
  const { adminView, canManage: isAdmin } = useAccess();
  const navigate = useNavigate();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useStudents(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const deleteMutation = useDeleteStudent();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.name}</p>
          <p className="text-xs text-gray-500">{s.email}</p>
        </div>
      ),
    },
    { key: 'registerNo', header: 'Register no' },
    { key: 'gender', header: 'Gender', render: (s) => <GenderBadge gender={s.gender} /> },
    {
      key: 'department',
      header: 'Department',
      render: (s) => (
        <span>
          {s.department} <span className="text-gray-400">· Y{s.year}</span>
        </span>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (s) =>
        s.roomNumber ? (
          <span>
            {s.hostelName} <span className="text-gray-400">·</span> {s.roomNumber}
          </span>
        ) : (
          <StatusBadge status="unallocated" label="Not allocated" />
        ),
    },
    {
      key: 'isActive',
      header: 'Account',
      render: (s) => <StatusBadge status={s.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Details"
            aria-label={`View ${s.name}`}
            onClick={() => setViewing(s)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              {!s.allocationId && s.isActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Allocate room"
                  aria-label={`Allocate a room to ${s.name}`}
                  onClick={() => navigate(`/admin/allocations?allocate=${s.id}`)}
                >
                  <BedDouble className="h-4 w-4 text-primary-600" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="Edit"
                aria-label={`Edit ${s.name}`}
                onClick={() => {
                  setEditing(s);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                aria-label={`Delete ${s.name}`}
                onClick={() => setDeleting(s)}
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
        title="Students"
        description={adminView ? 'All students of the organisation.' : 'Residents of your assigned hostels.'}
        actions={
          <>
            <ImportExportActions
              exportPath="/students/export"
              exportParams={filters}
              importKind="students"
              canImport={isAdmin}
            />
            {isAdmin && (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New student
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
          searchPlaceholder="Name, email, register no"
        >
          <FilterSelect
            value={filters.hostelId}
            onChange={(hostelId) => setFilters({ hostelId })}
            allLabel="All hostels"
            options={hostelOptions}
          />
          {adminView && (
            <FilterSelect
              value={filters.status}
              onChange={(status) => setFilters({ status })}
              allLabel="All students"
              options={[
                { value: 'allocated', label: 'Allocated' },
                { value: 'unallocated', label: 'Not allocated' },
                { value: 'inactive', label: 'Inactive accounts' },
              ]}
            />
          )}
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={Users}
          emptyTitle="No students found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      {isAdmin && (
        <>
          <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} student={editing} />
          <ConfirmDialog
            open={Boolean(deleting)}
            onClose={() => setDeleting(null)}
            title="Delete student"
            message={`Permanently delete ${deleting?.name} (${deleting?.registerNo}) with their complaints, leaves and attendance? Students with an active room must be vacated first.`}
            confirmLabel="Delete"
            loading={deleteMutation.isPending}
            onConfirm={() =>
              deleteMutation.mutate(deleting.id, {
                onSuccess: () => {
                  toast.success('Student deleted');
                  setDeleting(null);
                },
              })
            }
          />
        </>
      )}
      <StudentDetailsModal student={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
