import { RotateCcw } from 'lucide-react';
import Button from '../ui/Button';
import GenderFilter from './GenderFilter';
import SearchInput from './SearchInput';

/**
 * Standard filter bar used by every list page:
 * GenderFilter (optional) + search + any extra dropdowns passed as children + reset.
 */
export default function FilterBar({
  filters,
  setFilters,
  resetFilters,
  showGender = true,
  searchPlaceholder = 'Search...',
  children,
}) {
  const hasActive = Object.entries(filters).some(([key, value]) => !['page', 'limit'].includes(key) && value);

  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
      {showGender && <GenderFilter value={filters.gender} onChange={(gender) => setFilters({ gender })} />}
      <SearchInput
        value={filters.search || ''}
        onChange={(search) => setFilters({ search })}
        placeholder={searchPlaceholder}
        className="w-full lg:w-64"
      />
      {children && <div className="flex flex-wrap items-center gap-3 [&_select]:h-10">{children}</div>}
      {hasActive && resetFilters && (
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetFilters} className="lg:ml-auto">
          Reset
        </Button>
      )}
    </div>
  );
}

/** Compact select for filter bars (no label, `All ...` empty option). */
export function FilterSelect({ value, onChange, options, allLabel, ariaLabel, className = '' }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel || allLabel}
      className={`form-control h-10 w-full py-0 pr-8 sm:w-auto ${className}`}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
