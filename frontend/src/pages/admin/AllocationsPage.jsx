import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BedDouble, LogOut, Plus } from 'lucide-react';
import { useAllocations, useVacateAllocation } from '../../hooks/useAllocations';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import FilterBar, { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { GenderBadge, StatusBadge } from '../../components/ui/Badge';
import { formatDate, todayIso } from '../../lib/format';
import AllocationWizard from './AllocationWizard';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { page: 1, limit: 10, search: '', gender: '', hostelId: '', status: 'active' };

export default function AllocationsPage() {
  const { canManage: isAdmin } = useAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, resetFilters } = useUrlFilters(DEFAULTS);
  const { data, isLoading, isFetching } = useAllocations(filters);
  const { options: hostelOptions } = useHostelOptions(filters.gender);
  const vacateMutation = useVacateAllocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [vacating, setVacating] = useState(null);
  const [endDate, setEndDate] = useState(todayIso());

  const preselectedStudentId = searchParams.get('allocate');
  const wizardVisible = wizardOpen || Boolean(preselectedStudentId && isAdmin);

  const closeWizard = () => {
    setWizardOpen(false);
    if (preselectedStudentId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('allocate');
          return next;
        },
        { replace: true },
      );
    }
  };

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      render: (a) => (
        <div>
          <p className="font-medium text-gray-900">{a.studentName}</p>
          <p className="text-xs text-gray-500">{a.registerNo}</p>
        </div>
      ),
    },
    { key: 'gender', header: 'Gender', render: (a) => <GenderBadge gender={a.gender} /> },
    {
      key: 'room',
      header: 'Hostel / Room',
      render: (a) => (
        <span>
          {a.hostelName} <span className="text-gray-400">·</span> {a.roomNumber}
        </span>
      ),
    },
    { key: 'startDate', header: 'From', render: (a) => formatDate(a.startDate) },
    { key: 'endDate', header: 'To', render: (a) => (a.endDate ? formatDate(a.endDate) : '—') },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'allocatedByName', header: 'By', render: (a) => a.allocatedByName || '—' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (a) =>
        isAdmin && a.status === 'active' ? (
          <Button
            variant="secondary"
            size="sm"
            icon={LogOut}
            onClick={() => {
              setEndDate(todayIso() < a.startDate ? a.startDate : todayIso());
              setVacating(a);
            }}
          >
            Vacate
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Allocations"
        description="Bed allocations. A student can hold only one active allocation."
        actions={
          <>
            <ImportExportActions
              exportPath="/allocations/export"
              exportParams={filters}
              importKind="allocations"
              canImport={isAdmin}
            />
            {isAdmin && (
              <Button icon={Plus} onClick={() => setWizardOpen(true)}>
                New allocation
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
          searchPlaceholder="Student, register no, room"
        >
          <FilterSelect
            value={filters.hostelId}
            onChange={(hostelId) => setFilters({ hostelId })}
            allLabel="All hostels"
            options={hostelOptions}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            aria-label="Allocation status"
            className="form-control h-10 w-full py-0 pr-8 sm:w-auto"
          >
            <option value="active">Active</option>
            <option value="vacated">Vacated</option>
            <option value="all">All statuses</option>
          </select>
        </FilterBar>
        <Table
          columns={columns}
          rows={data?.data}
          loading={isLoading || isFetching}
          emptyIcon={BedDouble}
          emptyTitle="No allocations found"
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>

      {isAdmin && (
        <>
          <AllocationWizard open={wizardVisible} onClose={closeWizard} preselectedStudentId={preselectedStudentId} />
          <ConfirmDialog
            open={Boolean(vacating)}
            onClose={() => setVacating(null)}
            title="Vacate room"
            variant="primary"
            confirmLabel="Vacate"
            message={`End ${vacating?.studentName}'s stay in ${vacating?.hostelName}, room ${vacating?.roomNumber}?`}
            loading={vacateMutation.isPending}
            onConfirm={() =>
              vacateMutation.mutate(
                { id: vacating.id, endDate },
                {
                  onSuccess: () => {
                    toast.success('Room vacated');
                    setVacating(null);
                  },
                },
              )
            }
          >
            <Input
              label="End date"
              type="date"
              value={endDate}
              min={vacating?.startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
