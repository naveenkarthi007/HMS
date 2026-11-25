import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileUp, Upload } from 'lucide-react';
import { getErrorMessage, uploadCsv } from '../../api/client';
import { useResourceMutation } from '../../hooks/useResourceMutation';
import { passwordSchema } from '../../lib/validation';
import { IMPORT_SPECS } from '../../lib/importSpecs';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

const MAX_BYTES = 1_500_000;

const csvCell = (v) => (/[",\r\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);

function buildTemplate(spec) {
  const header = spec.columns.map((c) => c.name).join(',');
  const rows = spec.sample.map((r) => r.map(csvCell).join(','));
  return `${[header, ...rows].join('\r\n')}\r\n`;
}

/**
 * Generic CSV import dialog. `kind` is a key of IMPORT_SPECS (hostels, rooms, wardens, ...).
 * Every row is validated on the server first; nothing is saved unless all rows are valid.
 */
export default function ImportModal({ kind, open, onClose }) {
  const spec = IMPORT_SPECS[kind];
  const mutation = useResourceMutation((body) => uploadCsv(spec.path, body), spec.invalidate, { silent: true });
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [rowErrors, setRowErrors] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCsv('');
      setFileName('');
      setDefaultPassword('');
      setRowErrors([]);
      setError('');
    }
  }, [open]);

  const templateHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(buildTemplate(spec))}`, [spec]);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 1.5 MB, about 1000 rows)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ''));
      setFileName(file.name);
      setRowErrors([]);
      setError('');
    };
    reader.readAsText(file);
  };

  const submit = () => {
    setRowErrors([]);
    setError('');
    if (!csv) {
      setError('Choose a CSV file first');
      return;
    }
    if (spec.needsPassword && !passwordSchema.safeParse(defaultPassword).success) {
      setError('Default password needs at least 8 characters with a letter and a number');
      return;
    }
    mutation.mutate(spec.needsPassword ? { csv, defaultPassword } : { csv }, {
      onSuccess: (result) => {
        toast.success(`Imported ${result.imported} row${result.imported === 1 ? '' : 's'}`);
        onClose();
      },
      onError: (err) => {
        setError(getErrorMessage(err));
        setRowErrors(err?.response?.data?.error?.details?.rows || []);
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={spec.title}
      description={spec.description || 'Every row is checked first; nothing is saved unless all rows are valid.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Upload} onClick={submit} loading={mutation.isPending}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-4 text-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-gray-900">Columns</p>
            <a
              href={templateHref}
              download={`${kind}-template.csv`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Download className="h-4 w-4" /> Download template
            </a>
          </div>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {spec.columns.map((c) => (
              <li key={c.name} className="text-gray-600">
                <code className="text-xs font-semibold text-gray-900">{c.name}</code>
                {c.required && <span className="ml-1 text-red-500">*</span>}
                {c.hint && <span className="text-xs text-gray-500"> — {c.hint}</span>}
              </li>
            ))}
          </ul>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-primary-400">
          <FileUp className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{fileName || 'Click to choose a .csv file'}</span>
          <span className="text-xs text-gray-500">Save Excel sheets as “CSV UTF-8”. Up to 1000 rows.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
        </label>

        {spec.needsPassword && (
          <Input
            label="Default password for the new accounts"
            type="password"
            autoComplete="new-password"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            hint="Share it with them; they should change it after their first sign-in"
          />
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {rowErrors.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Line</th>
                  <th className="px-3 py-2 text-left font-semibold">Problems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rowErrors.map((row) => (
                  <tr key={row.line}>
                    <td className="px-3 py-2 align-top tabular-nums">{row.line}</td>
                    <td className="px-3 py-2">
                      {Object.entries(row.errors)
                        .map(([field, message]) => `${field}: ${message}`)
                        .join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
