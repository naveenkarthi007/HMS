import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Trash2, UtensilsCrossed } from 'lucide-react';
import { useDeleteMenu, useMessMonth, useSaveMenu } from '../../hooks/useMess';
import { useHostelOptions } from '../../hooks/useHostels';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useAccess } from '../../hooks/useAccess';
import GenderFilter from '../../components/filters/GenderFilter';
import { FilterSelect } from '../../components/filters/FilterBar';
import Card, { PageHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { GenderBadge } from '../../components/ui/Badge';
import { todayIso } from '../../lib/format';
import { MEALS } from '../../lib/constants';
import ImportExportActions from '../../components/ui/ImportExportActions';

const DEFAULTS = { month: '', hostelId: '', gender: '' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const pad = (n) => String(n).padStart(2, '0');
const currentMonth = () => todayIso().slice(0, 7);

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 6×7 grid of { date: 'YYYY-MM-DD', day, inMonth } starting on Sunday. */
function buildGrid(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      day: d.getDate(),
      inMonth: d.getMonth() === m - 1,
    };
  });
}

function DayCell({ cell, menu, isToday, onOpen }) {
  if (!cell.inMonth) {
    return (
      <div className="min-h-[5.5rem] rounded-xl border border-gray-100 bg-gray-50/40 p-2.5 sm:min-h-[6.5rem]">
        <span className="text-sm font-medium text-gray-300">{cell.day}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(cell.date)}
      className={`flex min-h-[5.5rem] flex-col rounded-xl border p-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-[6.5rem] ${
        isToday
          ? 'border-transparent bg-[#1d3b6f] text-white shadow-soft-lg'
          : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-soft'
      }`}
      aria-label={`Menu for ${cell.date}`}
    >
      <span className="flex items-start justify-between gap-1">
        <span className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-gray-900'}`}>{cell.day}</span>
        {isToday && (
          <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Today
          </span>
        )}
      </span>
      <span className="mt-auto block w-full space-y-0.5 pt-2">
        {menu ? (
          MEALS.filter((meal) => menu[meal.key])
            .slice(0, 3)
            .map((meal) => (
              <span
                key={meal.key}
                className={`hidden truncate text-[11px] leading-4 sm:block ${isToday ? 'text-blue-100' : 'text-gray-500'}`}
              >
                <span className="font-semibold">{meal.short}:</span> {menu[meal.key]}
              </span>
            ))
        ) : (
          <span className={`hidden text-xs italic sm:block ${isToday ? 'text-blue-100' : 'text-gray-300'}`}>
            No menu
          </span>
        )}
        <span
          className={`block h-1.5 w-1.5 rounded-full sm:hidden ${menu ? (isToday ? 'bg-white' : 'bg-primary-500') : 'bg-transparent'}`}
        />
      </span>
    </button>
  );
}

function DayMenuModal({ date, hostel, menu, canEdit, onClose }) {
  const saveMutation = useSaveMenu();
  const deleteMutation = useDeleteMenu();
  const [form, setForm] = useState({ breakfast: '', lunch: '', snacks: '', dinner: '', notes: '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (date) {
      setForm({
        breakfast: menu?.breakfast ?? '',
        lunch: menu?.lunch ?? '',
        snacks: menu?.snacks ?? '',
        dinner: menu?.dinner ?? '',
        notes: menu?.notes ?? '',
      });
      setError('');
    }
  }, [date, menu]);

  const title = date ? dayFormatter.format(new Date(`${date}T00:00:00`)) : '';

  const save = () => {
    if (!MEALS.some((meal) => form[meal.key].trim())) {
      setError('Enter at least one meal');
      return;
    }
    saveMutation.mutate(
      { hostelId: hostel.id, date, ...form },
      {
        onSuccess: () => {
          toast.success('Menu saved');
          onClose();
        },
      },
    );
  };

  return (
    <>
      <Modal
        open={Boolean(date)}
        onClose={onClose}
        title={title}
        description={hostel?.name}
        footer={
          canEdit ? (
            <>
              {menu && (
                <Button
                  variant="ghost"
                  icon={Trash2}
                  className="text-red-600 sm:mr-auto"
                  onClick={() => setConfirmDelete(true)}
                >
                  Clear day
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} loading={saveMutation.isPending}>
                Save menu
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        {canEdit ? (
          <div className="space-y-4">
            {MEALS.map((meal) => (
              <Textarea
                key={meal.key}
                label={meal.label}
                rows={2}
                maxLength={500}
                value={form[meal.key]}
                onChange={(e) => {
                  setForm((f) => ({ ...f, [meal.key]: e.target.value }));
                  setError('');
                }}
                placeholder={`What's for ${meal.label.toLowerCase()}?`}
              />
            ))}
            <Textarea
              label="Notes (optional)"
              rows={2}
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : menu ? (
          <dl className="space-y-4">
            {MEALS.map((meal) => (
              <div key={meal.key} className="rounded-xl bg-gray-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{meal.label}</dt>
                <dd className="mt-1 text-sm text-gray-900">{menu[meal.key] || '—'}</dd>
              </div>
            ))}
            {menu.notes && <p className="text-sm text-gray-600">{menu.notes}</p>}
          </dl>
        ) : (
          <EmptyState icon={UtensilsCrossed} title="No menu for this day" description="Check back later." />
        )}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Clear this day"
        message="Remove the menu for this day?"
        confirmLabel="Clear"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(
            { hostelId: hostel.id, date },
            {
              onSuccess: () => {
                toast.success('Menu cleared');
                setConfirmDelete(false);
                onClose();
              },
            },
          )
        }
      />
    </>
  );
}

/**
 * Monthly mess menu calendar. Staff pick a hostel; students always see their own hostel.
 */
export default function MessPage() {
  const access = useAccess();
  const isStudent = access.role === 'student';
  const { filters, setFilters } = useUrlFilters(DEFAULTS);
  const { options: hostelOptions, hostels } = useHostelOptions(filters.gender, {}, { enabled: !isStudent });
  const month = filters.month || currentMonth();
  const hostelId = isStudent ? undefined : filters.hostelId || (hostels[0] ? String(hostels[0].id) : '');
  const { data, isLoading } = useMessMonth({ month, hostelId }, { enabled: isStudent || Boolean(hostelId) });
  const [openDate, setOpenDate] = useState(null);

  const menusByDate = useMemo(() => Object.fromEntries((data?.menus ?? []).map((m) => [m.date, m])), [data]);
  const grid = useMemo(() => buildGrid(month), [month]);
  const today = todayIso();
  const hostel = data?.hostel;
  const canEdit = access.canHandle && Boolean(hostel);
  const [y, m] = month.split('-').map(Number);

  return (
    <div>
      <PageHeader
        title="Mess menu"
        description={
          isStudent
            ? hostel
              ? `Daily meals at ${hostel.name}.`
              : 'Your hostel mess menu.'
            : canEdit
              ? 'Click a day to set breakfast, lunch, snacks and dinner.'
              : 'Daily meals for each hostel.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ImportExportActions
              exportPath={isStudent || hostelId ? '/mess/export' : undefined}
              exportParams={{ month, hostelId }}
              importKind="mess"
              canImport={access.canHandle}
            />
            {!isStudent && (
              <div className="flex flex-wrap items-center gap-3">
                <GenderFilter value={filters.gender} onChange={(gender) => setFilters({ gender, hostelId: '' })} />
                <FilterSelect
                  value={hostelId}
                  onChange={(value) => setFilters({ hostelId: value })}
                  allLabel="Select hostel"
                  options={hostelOptions}
                />
              </div>
            )}
          </div>
        }
      />

      {isStudent && !isLoading && !hostel ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title="No hostel yet"
            description="The mess menu appears here once you have a room."
          />
        </Card>
      ) : (
        <Card className="p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                {monthFormatter.format(new Date(y, m - 1, 1))}
              </h2>
              <button
                type="button"
                onClick={() => setFilters({ month: '' })}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Today
              </button>
              {hostel && (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  {hostel.name} <GenderBadge gender={hostel.gender} />
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous month"
                onClick={() => setFilters({ month: shiftMonth(month, -1) })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next month"
                onClick={() => setFilters({ month: shiftMonth(month, 1) })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5 rounded-xl bg-gray-50 py-3 sm:gap-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {!isStudent && !hostelId ? (
            <EmptyState icon={UtensilsCrossed} title="Select a hostel" description="Choose a hostel to see its menu." />
          ) : (
            <div className={`grid grid-cols-7 gap-1.5 transition-opacity sm:gap-2 ${isLoading ? 'opacity-50' : ''}`}>
              {grid.map((cell) => (
                <DayCell
                  key={cell.date}
                  cell={cell}
                  menu={menusByDate[cell.date]}
                  isToday={cell.date === today}
                  onOpen={setOpenDate}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <DayMenuModal
        date={openDate}
        hostel={hostel}
        menu={openDate ? menusByDate[openDate] : null}
        canEdit={canEdit}
        onClose={() => setOpenDate(null)}
      />
    </div>
  );
}
