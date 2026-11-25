/** Small horizontal bar: occupied / capacity. */
export default function OccupancyBar({ occupied = 0, capacity = 0, gender }) {
  const pct = capacity ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const color =
    pct >= 100
      ? 'bg-red-500'
      : gender === 'female'
        ? 'bg-pink-500'
        : gender === 'male'
          ? 'bg-blue-500'
          : 'bg-primary-600';
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-gray-500">
        {occupied}/{capacity}
      </span>
    </div>
  );
}
