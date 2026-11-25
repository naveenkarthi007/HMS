import { Megaphone, Pin } from 'lucide-react';
import { useNotices } from '../../hooks/useNotices';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import SearchInput from '../../components/filters/SearchInput';
import Card, { PageHeader } from '../../components/ui/Card';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { CategoryBadge } from '../admin/NoticesPage';
import { formatDate } from '../../lib/format';

const DEFAULTS = { page: 1, limit: 10, search: '' };

export default function StudentNoticesPage() {
  const { filters, setFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading } = useNotices(filters);
  const notices = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Notices" description="Announcements for your hostel." />
      <Card padded={false}>
        <div className="border-b border-gray-100 p-4">
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters({ search })}
            placeholder="Search notices"
            className="w-full sm:w-72"
          />
        </div>
        {isLoading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-4 w-full" />
              </div>
            ))}
          </div>
        ) : notices.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No notices"
            description="There are no active notices for you right now."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {notices.map((n) => (
              <li key={n.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {n.isPinned && (
                    <Badge tone="indigo">
                      <Pin className="h-3 w-3" /> Pinned
                    </Badge>
                  )}
                  <CategoryBadge category={n.category} />
                  <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{n.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {n.hostelName || 'All hostels'} · {formatDate(n.createdAt)}
                  {n.publishedByName ? ` · ${n.publishedByName}` : ''}
                  {n.expiresAt ? ` · until ${formatDate(n.expiresAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={data?.meta} onPageChange={(page) => setFilters({ page })} />
      </Card>
    </div>
  );
}
