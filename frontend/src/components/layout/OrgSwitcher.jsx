import { Building2 } from 'lucide-react';
import { useOrganisations } from '../../hooks/useOrganisations';
import { usePlatformView } from '../../context/PlatformViewContext';

/** Super admin: pick an organisation to view (read-only), or go back to the whole platform. */
export default function OrgSwitcher() {
  const { org, enter, exit } = usePlatformView();
  const { data } = useOrganisations({ limit: 100 });
  const organisations = data?.data ?? [];

  const onChange = (event) => {
    const id = Number(event.target.value);
    if (!id) {
      exit();
      return;
    }
    const next = organisations.find((o) => o.id === id);
    if (next) enter(next);
  };

  return (
    <label className="relative hidden items-center sm:flex">
      <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" aria-hidden="true" />
      <select
        value={org?.id ?? ''}
        onChange={onChange}
        aria-label="Organisation to view"
        className="form-control h-9 w-56 py-0 pl-9 pr-8 text-sm"
      >
        <option value="">All organisations</option>
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
