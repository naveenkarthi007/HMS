import { labelize } from '../../lib/format';

const TONES = {
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  indigo: 'bg-primary-50 text-primary-700 ring-primary-200',
};

export default function Badge({ tone = 'gray', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function GenderBadge({ gender }) {
  if (!gender) return <span className="text-gray-400">—</span>;
  return <Badge tone={gender === 'male' ? 'blue' : 'pink'}>{gender === 'male' ? 'Male' : 'Female'}</Badge>;
}

const STATUS_TONES = {
  active: 'green',
  inactive: 'gray',
  maintenance: 'yellow',
  vacated: 'gray',
  open: 'red',
  in_progress: 'yellow',
  resolved: 'green',
  closed: 'gray',
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  present: 'green',
  absent: 'red',
  on_leave: 'indigo',
  allocated: 'green',
  unallocated: 'gray',
  expired: 'gray',
  high: 'red',
  medium: 'yellow',
  low: 'gray',
};

export function StatusBadge({ status, label }) {
  return <Badge tone={STATUS_TONES[status] || 'gray'}>{label || labelize(status)}</Badge>;
}
