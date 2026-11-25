import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { KeyRound, Save } from 'lucide-react';
import { useMyProfile, useUpdateMyProfile } from '../../hooks/useStudents';
import Card, { CardHeader, PageHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { GenderBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import ChangePasswordModal from '../../components/layout/ChangePasswordModal';
import { formatDate } from '../../lib/format';
import { emptyToNull, optionalPhone } from '../../lib/validation';
import { applyServerErrors } from '../../lib/forms';

const schema = z.object({
  phone: optionalPhone,
  guardianName: z.string().trim().max(120),
  guardianPhone: optionalPhone,
  address: z.string().trim().max(255),
});

export default function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const updateMutation = useUpdateMyProfile();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (profile) {
      reset({
        phone: profile.phone ?? '',
        guardianName: profile.guardianName ?? '',
        guardianPhone: profile.guardianPhone ?? '',
        address: profile.address ?? '',
      });
    }
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync(emptyToNull(values));
      toast.success('Profile updated');
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const readOnly = [
    ['Name', profile.name],
    ['Email', profile.email],
    ['Register number', profile.registerNo],
    ['Department', profile.department],
    ['Year', `Year ${profile.year}`],
    ['Date of birth', formatDate(profile.dateOfBirth)],
    ['Room', profile.room ? `${profile.room.hostelName} · Room ${profile.room.roomNumber}` : 'Not allocated'],
  ];

  return (
    <div>
      <PageHeader
        title="My profile"
        actions={
          <Button variant="secondary" icon={KeyRound} onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Student details" description="Contact the hostel office to change these." />
          <dl className="space-y-3 text-sm">
            {readOnly.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="mt-0.5 text-gray-900">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Gender</dt>
              <dd className="mt-1">
                <GenderBadge gender={profile.gender} />
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Contact information"
            description="Keep your phone number and guardian details up to date."
          />
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
            <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
            <div className="hidden sm:block" />
            <Input label="Guardian name" error={errors.guardianName?.message} {...register('guardianName')} />
            <Input label="Guardian phone" error={errors.guardianPhone?.message} {...register('guardianPhone')} />
            <Input label="Address" className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
            <div className="sm:col-span-2">
              <Button type="submit" icon={Save} loading={isSubmitting} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
