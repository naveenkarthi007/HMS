const TONES = {
  indigo: 'bg-primary-50 text-primary-600',
  blue: 'bg-blue-50 text-blue-600',
  pink: 'bg-pink-50 text-pink-600',
  green: 'bg-emerald-50 text-emerald-600',
  yellow: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
};

export default function StatCard({ label, value, icon: Icon, tone = 'indigo', hint, loading = false }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-500">{label}</p>
        {loading ? (
          <div className="skeleton mt-1.5 h-7 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
        )}
        {hint && !loading && <p className="truncate text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}
