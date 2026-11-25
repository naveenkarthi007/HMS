import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { authApi } from '../../api/auth';
import { passwordSchema } from '../../lib/validation';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export default function ChangePasswordModal({ open, onClose }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({ mutationFn: authApi.changePassword, meta: { silent: true } });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      toast.success('Password updated');
      close();
    } catch (err) {
      const fieldErrors = err?.response?.data?.error?.details || {};
      if (fieldErrors.currentPassword) setError('currentPassword', { message: fieldErrors.currentPassword });
      else if (fieldErrors.newPassword) setError('newPassword', { message: fieldErrors.newPassword });
      else toast.error(err?.response?.data?.error?.message || 'Could not update password');
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="change-password-form" loading={mutation.isPending}>
            Update password
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters with a letter and a number"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </form>
    </Modal>
  );
}
