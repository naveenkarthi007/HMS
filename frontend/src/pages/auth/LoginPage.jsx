import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building2, LogIn } from 'lucide-react';
import { ROLE_HOME, useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { FullPageSpinner } from '../../components/ui/Spinner';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const DEMO_PASSWORD = 'Password@123';
const DEMO_ACCOUNTS = [
  { label: 'Super admin', email: 'super@hms.dev' },
  { label: 'Org admin', email: 'admin@git.edu' },
  { label: 'Boys hostel manager', email: 'boys.manager@git.edu' },
  { label: 'Girls hostel manager', email: 'girls.manager@git.edu' },
  { label: 'Warden (male)', email: 'warden.male@git.edu' },
  { label: 'Warden (female)', email: 'warden.female@git.edu' },
  { label: 'Student (male)', email: 'student01@git.edu' },
  { label: 'Student (female)', email: 'student21@git.edu' },
];

/** Only allow same-app relative redirects (no protocol-relative or backslash tricks). */
function safeRedirect(path) {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) && !path.includes('\\') ? path : null;
}

export default function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      const signedIn = await login(values);
      toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}!`);
      const from = safeRedirect(location.state?.from);
      navigate(from && from !== '/' ? from : ROLE_HOME[signedIn.role], { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not sign in'));
    }
  });

  const fillDemo = (email) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
    setFormError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-soft-lg">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in to HostelHub</h1>
          <p className="mt-1 text-sm text-gray-500">Hostel management for colleges and institutes</p>
        </div>

        <div className="card p-6 sm:p-8">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {formError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@institute.edu"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={isSubmitting} icon={LogIn}>
              Sign in
            </Button>
          </form>
        </div>

        <div className="card mt-4 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Demo accounts · password {DEMO_PASSWORD}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account.email)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs transition hover:border-primary-300 hover:bg-primary-50"
              >
                <span className="block font-medium text-gray-900">{account.label}</span>
                <span className="block truncate text-gray-500">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
