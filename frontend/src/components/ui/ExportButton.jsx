import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import Button from './Button';
import { downloadCsv, getErrorMessage } from '../../api/client';

/**
 * Downloads `GET <path>` as CSV using the page's current filters (all matching rows, not just this page).
 */
export default function ExportButton({ path, params = {}, label = 'Export', size = 'md' }) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const filters = Object.fromEntries(
        Object.entries(params).filter(([key]) => !['page', 'limit', 'tab'].includes(key)),
      );
      const count = await downloadCsv(path, filters);
      toast.success(count ? `Exported ${count} row${count === 1 ? '' : 's'}` : 'Nothing to export for these filters');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size={size}
      icon={Download}
      loading={loading}
      onClick={onClick}
      title="Download as CSV (opens in Excel)"
    >
      {label}
    </Button>
  );
}
