import { supabase } from '@/lib/supabase';
import type { Receipt, ReceiptCategory } from '@freightx/shared';

// receipts table not yet in generated DB types — use untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapRow(row: Record<string, unknown>): Receipt {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    loadNumber: (row.load_number as string) ?? undefined,
    category: row.category as ReceiptCategory,
    amountUsd: Number(row.amount_usd),
    vendorName: row.vendor_name as string,
    receiptDate: row.receipt_date as string,
    notes: (row.notes as string) ?? undefined,
    imageUrl: row.image_url as string,
    imageThumbnailUrl: (row.image_thumbnail_url as string) ?? undefined,
    fileSizeBytes: (row.file_size_bytes as number) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getReceipts(
  driverId: string,
  filters?: { category?: ReceiptCategory; startDate?: string; endDate?: string },
): Promise<Receipt[]> {
  let query = db
    .from('receipts')
    .select('*')
    .eq('driver_id', driverId)
    .order('receipt_date', { ascending: false });

  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.startDate) query = query.gte('receipt_date', filters.startDate);
  if (filters?.endDate) query = query.lte('receipt_date', filters.endDate);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createReceipt(params: {
  driverId: string;
  loadNumber?: string;
  category: ReceiptCategory;
  amountUsd: number;
  vendorName: string;
  receiptDate: string;
  notes?: string;
  imageUrl: string;
  fileSizeBytes?: number;
}): Promise<Receipt> {
  const { data, error } = await db
    .from('receipts')
    .insert({
      driver_id: params.driverId,
      load_number: params.loadNumber ?? null,
      category: params.category,
      amount_usd: params.amountUsd,
      vendor_name: params.vendorName,
      receipt_date: params.receiptDate,
      notes: params.notes ?? null,
      image_url: params.imageUrl,
      file_size_bytes: params.fileSizeBytes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadReceiptImage(file: File, driverId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${driverId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}

export interface ExpenseSummary {
  totalUsd: number;
  fuelUsd: number;
  receiptCount: number;
  byCategory: Record<ReceiptCategory, number>;
}

export async function getExpenseSummary(
  driverId: string,
  startDate?: string,
  endDate?: string,
): Promise<ExpenseSummary> {
  let query = db.from('receipts').select('category, amount_usd').eq('driver_id', driverId);

  if (startDate) query = query.gte('receipt_date', startDate);
  if (endDate) query = query.lte('receipt_date', endDate);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const byCategory: Record<string, number> = {};
  let totalUsd = 0;
  let fuelUsd = 0;

  for (const row of rows) {
    const amt = Number(row.amount_usd);
    totalUsd += amt;
    if (row.category === 'fuel') fuelUsd += amt;
    byCategory[row.category as string] = (byCategory[row.category as string] ?? 0) + amt;
  }

  return {
    totalUsd,
    fuelUsd,
    receiptCount: rows.length,
    byCategory: byCategory as Record<ReceiptCategory, number>,
  };
}
