import { useState } from 'react';
import { FileUp } from 'lucide-react';
import Button from './Button';
import ExportButton from './ExportButton';
import ImportModal from './ImportModal';

/**
 * The Import + Export buttons used in page headers.
 * - exportPath: GET endpoint returning CSV (omit to hide Export)
 * - exportParams: current filters (page/limit are dropped)
 * - importKind: key of IMPORT_SPECS (omit or pass canImport=false to hide Import)
 */
export default function ImportExportActions({ exportPath, exportParams, importKind, canImport = true }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {importKind && canImport && (
        <>
          <Button variant="secondary" icon={FileUp} onClick={() => setOpen(true)}>
            Import
          </Button>
          <ImportModal kind={importKind} open={open} onClose={() => setOpen(false)} />
        </>
      )}
      {exportPath && <ExportButton path={exportPath} params={exportParams} />}
    </>
  );
}
