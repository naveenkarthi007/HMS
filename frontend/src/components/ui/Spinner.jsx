import { Loader2 } from 'lucide-react';

const SIZES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

export function Spinner({ size = 'md', className = '' }) {
  return <Loader2 aria-hidden="true" className={`animate-spin text-primary-600 ${SIZES[size]} ${className}`} />;
}

export function FullPageSpinner({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3" role="status">
      <Spinner size="lg" />
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

export default Spinner;
