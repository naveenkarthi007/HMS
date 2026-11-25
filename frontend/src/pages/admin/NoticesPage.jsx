import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { useCreateNotice, useDeleteNotice, useNotices, useUpdateNotice } from '../../hooks/useNotices';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import Input, { Checkbox, Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import { formatDate, formatDateTime, isoToLocalInput, labelize, localInputToIso, toOptions } from '../../lib/format';
import { FLOORS, NOTICE_CATEGORIES, NOTICE_TARGETS, YEARS } from '../../lib/constants';
import { applyServerErrors } from '../../lib/forms';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: '', category: '' };

const CATEGORY_TONES = {
  general: 'gray',
  maintenance: 'yellow',
  mess: 'green',
  event: 'indigo',
  academic: 'blue',
  emergency: 'red',
};

const schema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
    category: z.enum(['general', 'maintenance', 'mess', 'event', 'academic', 'emergency']),
    startsAt: z.string(),
    expiresAt: z.string(),
    targetType: z.enum(['all', 'hostel', 'floor', 'year']),
    hostelId: z.string(),
    targetValues: z.array(z.number()),
    audienceGender: z.enum(['all', 'male', 'female']),
    body: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000),
    isPinned: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if ((v.targetType === 'hostel' || v.targetType === 'floor') && !v.hostelId) issue('hostelId', 'Select a hostel');
    if (v.targetType === 'floor' && !v.targetValues.length) issue('targetValues', 'Select at least one floor');
    if (v.targetType === 'year' && !v.targetValues.length) issue('targetValues', 'Select at least one year');
    if (v.startsAt && v.expiresAt && new Date(v.expiresAt) <= new Date(v.startsAt)) {
      issue('expiresAt', 'Expiry must be after the start date');
    }
  });

export function CategoryBadge({ category }) {
  return <Badge tone={CATEGORY_TONES[category] || 'gray'}>{labelize(category)}</Badge>;
}

const floorLabel = (n) => FLOORS.find((f) => f.value === n)?.label.replace(' Floor', '') ?? n;

/** Human summary of "Send To", e.g. "Aryabhata Hall · Ground, First floor". */
export function targetSummary(n) {
  const gender = n.audienceGender === 'all' ? '' : ` · ${labelize(n.audienceGender)} only`;
  switch (n.targetType) {
    case 'hostel':
      return `${n.hostelName}${gender}`;
    case 'floor':
      return `${n.hostelName} · ${n.targetValues.map(floorLabel).join(', ')} floor${n.targetValues.length > 1 ? 's' : ''}`;
    case 'year':
      return `Year ${n.targetValues.join(', ')}${n.hostelName ? ` · ${n.hostelName}` : ' · all hostels'}${gender}`;
    default:
      return `All users${gender}`;
  }
}

function CheckboxGrid({ items, value, onChange }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v].sort());
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {items.map((item) => (
        <label key={item.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value.includes(item.value)}
            onChange={() => toggle(item.value)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function NoticeFormModal({ open, onClose, notice }) {
  const access = useAccess();
  const isEdit = Boolean(notice);
  const { options: hostelOptions } = useHostelOptions();
  const createMutation = useCreateNotice();
  const updateMutation = useUpdateNotice();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const targetType = useWatch({ control, name: 'targetType' });

  // Wardens always address one of their own hostels.
  const targets = access.isWarden ? NOTICE_TARGETS.filter((t) => t.value !== 'all') : NOTICE_TARGETS;

  useEffect(() => {
    if (!open) return;
    reset({
      title: notice?.title ?? '',
      category: notice?.category ?? 'general',
      startsAt: isoToLocalInput(notice?.startsAt),
      expiresAt: isoToLocalInput(notice?.expiresAt),
      targetType: notice?.targetType ?? (access.isWarden ? 'hostel' : 'all'),
      hostelId: notice?.hostelId ? String(notice.hostelId) : '',
      targetValues: notice?.targetValues ?? [],
      audienceGender: notice?.audienceGender ?? access.managedGender ?? 'all',
      body: notice?.body ?? '',
      isPinned: notice?.isPinned ?? false,
    });
  }, [open, notice, reset, access.isWarden, access.managedGender]);

  const onSubmit = handleSubmit(async (values) => {
    const body = {
      ...values,
      hostelId: values.targetType === 'all' || !values.hostelId ? null : Number(values.hostelId),
      targetValues: values.targetType === 'floor' || values.targetType === 'year' ? values.targetValues : [],
      startsAt: localInputToIso(values.startsAt),
      expiresAt: localInputToIso(values.expiresAt),
    };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: notice.id, ...body });
        toast.success('Notice updated');
      } else {
        await createMutation.mutateAsync(body);
        toast.success('Notice posted');
      }
      onClose();
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  const showHostel = targetType === 'hostel' || targetType === 'floor' || targetType === 'year';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit Notice' : 'Post New Notice'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="notice-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Post notice'}
          </Button>
        </>
      }
    >
      <form id="notice-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input
          label="Notice Title"
          required
          placeholder="Brief, descriptive title"
          error={errors.title?.message}
          {...register('title')}
        />
        <Select label="Category" options={toOptions(NOTICE_CATEGORIES)} {...register('category')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Start Date (Optional)"
            type="datetime-local"
            error={errors.startsAt?.message}
            {...register('startsAt')}
          />
          <Input
            label="Expiry Date (Optional)"
            type="datetime-local"
            error={errors.expiresAt?.message}
            {...register('expiresAt')}
          />
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-5">
          <fieldset>
            <legend className="form-label">Send To</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {targets.map((t) => (
                <label key={t.value} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    value={t.value}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                    {...register('targetType', { onChange: () => setValue('targetValues', []) })}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          {showHostel && (
            <Select
              label="Select Hostel"
              placeholder={targetType === 'year' && !access.isWarden ? 'All hostels' : 'Select hostel'}
              options={hostelOptions}
              error={errors.hostelId?.message}
              {...register('hostelId')}
            />
          )}

          {(targetType === 'floor' || targetType === 'year') && (
            <div>
              <p className="form-label">{targetType === 'floor' ? 'Select Floors' : 'Select Years'}</p>
              <Controller
                control={control}
                name="targetValues"
                render={({ field }) => (
                  <CheckboxGrid
                    items={targetType === 'floor' ? FLOORS : YEARS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.targetValues && <p className="mt-1 text-xs text-red-600">{errors.targetValues.message}</p>}
            </div>
          )}

          {(targetType === 'all' || targetType === 'year') && (
            <Select
              label="Gender"
              options={
                access.managedGender
                  ? [{ value: access.managedGender, label: `${labelize(access.managedGender)} students only` }]
                  : [
                      { value: 'all', label: 'All students' },
                      { value: 'male', label: 'Male students only' },
                      { value: 'female', label: 'Female students only' },
                    ]
              }
              error={errors.audienceGender?.message}
              {...register('audienceGender')}
            />
          )}
        </div>

        <Textarea
          label="Message"
          required
          rows={5}
          placeholder="Notice content..."
          error={errors.body?.message}
          {...register('body')}
        />
        <Checkbox label="Pin to top" description="Pinned notices are shown first" {...register('isPinned')} />
      </form>
    </Modal>
  );
}

export default function NoticesPage() {
  const access = useAccess();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useNotices(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const deleteMutation = useDeleteNotice();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const canModify = (n) => access.canManage || (access.isWarden && n.publishedBy === access.user.id);

  const columns = [
    {
      key: 'title',
      header: 'Notice',
      render: (n) => (
        <div className="max-w-md">
          <p className="flex items-center gap-1.5 font-medium text-gray-900">
            {n.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-label="Pinned" />}
            <span className="truncate">{n.title}</span>
          </p>
          <p className="truncate text-xs text-gray-500">{n.body}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (n) => <CategoryBadge category={n.category} /> },
    {
      key: 'target',
      header: 'Sent to',
      render: (n) => <span className="text-sm">{targetSummary(n)}</span>,
    },
    {
      key: 'window',
      header: 'Visible',
      render: (n) => (
        <div className="whitespace-nowrap text-sm">
          {n.isScheduled ? (
            <Badge tone="indigo">From {formatDateTime(n.startsAt)}</Badge>
          ) : n.isExpired ? (
            <Badge tone="gray">Expired</Badge>
          ) : (
            <Badge tone="green">Live</Badge>
          )}
          {n.expiresAt && !n.isExpired && (
            <p className="mt-1 text-xs text-gray-500">until {formatDateTime(n.expiresAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'published',
      header: 'Posted',
      render: (n) => (
        <div>
          <p>{formatDate(n.createdAt)}</p>
          <p className="text-xs text-gray-500">{n.publishedByName || '—'}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (n) =>
        canModify(n) ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Edit"
              aria-label="Edit notice"
              onClick={() => {
                setEditing(n);
                setFormOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete"
              aria-label="Delete notice"
              onClick={() => setDeleting(n)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Notices"
        description="Announcements by hostel, floor, year and gender."
        actions={
          <>
            <ImportExportActions exportPath="/notices/export" exportParams={filters} />
            {access.canHandle && (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New notice
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
          searchPlaceholder="Search notices"
        >
          <FilterSelect
            value={filters.hostelId}
            onChange={(hostelId) => setFilters({ hostelId })}
            allLabel="All hostels"
            options={hostelOptions}
          />
          <FilterSelect
            value={filters.category}
            onChange={(category) => setFilters({ category })}
            allLabel="All categories"
            options={toOptions(NOTICE_CATEGORIES)}
          />
          <FilterSelect
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            allLabel="All notices"
            options={[
              { value: 'active', label: 'Live' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'expired', label: 'Expired' },
            ]}
          />
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={Megaphone}
          emptyTitle="No notices found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      <NoticeFormModal open={formOpen} onClose={() => setFormOpen(false)} notice={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete notice"
        message={`Delete "${deleting?.title}"?`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Notice deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
