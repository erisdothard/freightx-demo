import { createLoad } from './loads.service';
import type { LoadRow } from '@/lib/database.types';

export interface CsvLoadRow {
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  equipment: string;
  rate_usd: string;
  pickup_date: string;
  commodity?: string;
}

export interface ImportResult {
  succeeded: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const REQUIRED_COLUMNS = [
  'origin_city',
  'origin_state',
  'dest_city',
  'dest_state',
  'equipment',
  'rate_usd',
  'pickup_date',
] as const;

export function parseCsv(csvText: string): CsvLoadRow[] {
  const lines = csvText.trim().split('\n').filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required column: "${col}"`);
    }
  }

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row as unknown as CsvLoadRow;
  });
}

export async function importLoadsFromCsv(
  rows: CsvLoadRow[],
  postedBy: string,
  companyId: string | null,
): Promise<ImportResult> {
  if (rows.length > 50) {
    throw new Error('Maximum 50 loads per import batch');
  }

  const result: ImportResult = { succeeded: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    const rateUsd = parseFloat(row.rate_usd);
    if (!row.origin_city || !row.origin_state || !row.dest_city || !row.dest_state) {
      result.failed++;
      result.errors.push({ row: rowNum, message: 'Missing required address fields' });
      continue;
    }
    if (isNaN(rateUsd) || rateUsd <= 0) {
      result.failed++;
      result.errors.push({ row: rowNum, message: `Invalid rate_usd: "${row.rate_usd}"` });
      continue;
    }
    if (!row.pickup_date) {
      result.failed++;
      result.errors.push({ row: rowNum, message: 'Missing pickup_date' });
      continue;
    }

    try {
      const input: Omit<LoadRow, 'id' | 'created_at'> = {
        posted_by: postedBy,
        company_id: companyId,
        status: 'posted',
        equipment: row.equipment || 'van',
        origin_city: row.origin_city,
        origin_state: row.origin_state.toUpperCase().slice(0, 2),
        dest_city: row.dest_city,
        dest_state: row.dest_state.toUpperCase().slice(0, 2),
        rate_usd: rateUsd,
        pickup_date: row.pickup_date,
        commodity: row.commodity || null,
        // defaults
        load_number: null,
        weight_lbs: null,
        total_miles: null,
        delivery_date: null,
        notes: null,
        source: 'csv_import',
        co_driver_id: null,
        origin_address: null,
        dest_address: null,
        temp_min_f: null,
        temp_max_f: null,
        temp_controlled: false,
        hazmat: false,
        broker_credit_score: null,
        posted_at: new Date().toISOString(),
      } as unknown as Omit<LoadRow, 'id' | 'created_at'>;

      await createLoad(input);
      result.succeeded++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}
