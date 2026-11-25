import EmptyState from './EmptyState';

/**
 * columns: [{ key, header, render?: (row) => node, className?, headerClassName? }]
 */
export default function Table({
  columns,
  rows = [],
  loading = false,
  rowKey = 'id',
  emptyTitle = 'No records found',
  emptyDescription = 'Try changing the filters or search term.',
  emptyIcon,
  emptyAction,
  skeletonRows = 6,
  onRowClick,
}) {
  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50/80">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          className={`divide-y divide-gray-100 bg-white transition-opacity ${loading && rows.length ? 'opacity-60' : ''}`}
        >
          {showSkeleton &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <div className="skeleton h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`hover:bg-gray-50/70 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 align-middle text-gray-700 ${col.className || ''}`}>
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
