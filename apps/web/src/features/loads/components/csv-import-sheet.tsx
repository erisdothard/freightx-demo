import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { parseCsv, importLoadsFromCsv } from '@/services/load-import.service';
import type { CsvLoadRow, ImportResult } from '@/services/load-import.service';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/shared/lib/utils';

interface CsvImportSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function CsvImportSheet({ open, onClose, onSuccess }: CsvImportSheetProps) {
  const { user, company } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<CsvLoadRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCsv(e.target?.result as string);
        if (parsed.length > 50) {
          setParseError('Maximum 50 rows per import. Please split your file.');
          return;
        }
        setRows(parsed);
        setParseError(null);
        setStep('preview');
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!user) return;
    setStep('importing');
    try {
      const importResult = await importLoadsFromCsv(rows, user.id, company?.id ?? null);
      setResult(importResult);
      setStep('done');
      onSuccess?.(importResult);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  function handleReset() {
    setStep('upload');
    setRows([]);
    setParseError(null);
    setResult(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-fx-surface rounded-t-ios-sm pb-safe-area-inset-bottom max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-fx-border rounded-full" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-fx-orange" />
              <h2 className="text-[17px] font-bold text-white">Import Loads from CSV</h2>
            </div>
            <button onClick={onClose} className="p-1 text-fx-text-dim hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Step: Upload */}
          {step === 'upload' && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className="border-2 border-dashed border-fx-border rounded-ios p-8 text-center cursor-pointer hover:border-fx-orange/50 transition-colors mb-4"
              >
                <FileText size={32} className="text-fx-text-dim mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-white mb-1">Drop your CSV here</p>
                <p className="text-[12px] text-fx-text-dim">or click to browse — max 50 rows</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              {parseError && <p className="text-red-400 text-sm text-center mb-4">{parseError}</p>}

              {/* Required columns hint */}
              <div className="bg-fx-surface-2 rounded-ios-xs p-3">
                <p className="text-[11px] font-bold text-fx-text-dim uppercase tracking-wider mb-2">
                  Required columns
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'origin_city',
                    'origin_state',
                    'dest_city',
                    'dest_state',
                    'equipment',
                    'rate_usd',
                    'pickup_date',
                  ].map((col) => (
                    <code
                      key={col}
                      className="text-[11px] bg-fx-surface-3 px-2 py-0.5 rounded text-fx-orange"
                    >
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-[11px] text-fx-text-dim mt-2">Optional: commodity</p>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-white">
                  {rows.length} loads ready to import
                </p>
                <button
                  onClick={handleReset}
                  className="text-[12px] text-fx-text-dim hover:text-white"
                >
                  Change file
                </button>
              </div>

              {parseError && <p className="text-red-400 text-sm mb-3">{parseError}</p>}

              <div className="overflow-x-auto rounded-ios-xs border border-fx-border mb-5 max-h-[250px] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-fx-surface-2 text-fx-text-dim uppercase text-[10px] tracking-wider">
                      {['Origin', 'Dest', 'Equipment', 'Rate', 'Pickup'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-t border-fx-border',
                          i % 2 === 0 ? '' : 'bg-fx-surface-2/30',
                        )}
                      >
                        <td className="px-3 py-2 text-white">
                          {row.origin_city}, {row.origin_state}
                        </td>
                        <td className="px-3 py-2 text-white">
                          {row.dest_city}, {row.dest_state}
                        </td>
                        <td className="px-3 py-2 text-fx-text-dim">{row.equipment}</td>
                        <td className="px-3 py-2 text-fx-orange font-bold">${row.rate_usd}</td>
                        <td className="px-3 py-2 text-fx-text-dim">{row.pickup_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => void handleImport()}
                className="w-full h-12 bg-fx-orange rounded-ios-xs font-bold text-white text-[15px] flex items-center justify-center gap-2 active-scale"
              >
                <Upload size={16} />
                Import {rows.length} Load{rows.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-2 border-fx-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Importing {rows.length} loads...</p>
              <p className="text-fx-text-dim text-sm mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && result && (
            <div className="py-6 text-center">
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-[17px] font-bold text-white mb-4">Import Complete</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-fx-surface-2 rounded-ios-xs p-3">
                  <p className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                    Succeeded
                  </p>
                  <p className="text-[22px] font-extrabold text-emerald-400">{result.succeeded}</p>
                </div>
                <div className="bg-fx-surface-2 rounded-ios-xs p-3">
                  <p className="text-[11px] text-fx-text-dim uppercase tracking-wider mb-1">
                    Failed
                  </p>
                  <p className="text-[22px] font-extrabold text-red-400">{result.failed}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-400/10 border border-red-400/20 rounded-ios-xs p-3 mb-4 text-left">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} className="text-red-400" />
                    <span className="text-[12px] font-bold text-red-400">Errors</span>
                  </div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[11px] text-red-400/80">
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-[11px] text-fx-text-dim mt-1">
                      +{result.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 h-11 bg-fx-surface-2 rounded-ios-xs font-semibold text-white text-sm active-scale"
                >
                  Import Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-11 bg-fx-orange rounded-ios-xs font-bold text-white text-sm active-scale"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
