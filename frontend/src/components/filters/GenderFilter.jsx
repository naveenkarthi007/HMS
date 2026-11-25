import { useAccess } from '../../hooks/useAccess';

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ACTIVE = {
  '': 'bg-white text-gray-900 shadow-sm',
  male: 'bg-blue-600 text-white shadow-sm',
  female: 'bg-pink-600 text-white shadow-sm',
};

/** Segmented control: All / Male / Female. `value` is '' | 'male' | 'female'. Hidden for gender-locked managers. */
export default function GenderFilter({ value = '', onChange, className = '' }) {
  const { managedGender } = useAccess();
  if (managedGender) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Filter by gender"
      className={`inline-flex h-10 items-center rounded-lg bg-gray-100 p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = (value || '') === option.value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-md px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              active ? ACTIVE[option.value] : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
