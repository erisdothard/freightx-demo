import { supabase } from '@/lib/supabase';
import type { DocumentRow, DocumentType } from '@/lib/database.types';
import { notifyBolSigned } from '@/services/email-notifications.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type { DocumentRow };

export async function getDocumentsForLoad(loadId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('load_id', loadId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function createDocument(params: {
  loadId: string;
  type: DocumentType;
  fileName: string;
  uploadedBy?: string;
  companyId?: string | null;
  bolNumber?: string;
}): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      load_id: params.loadId,
      uploaded_by: params.uploadedBy ?? null,
      company_id: params.companyId ?? null,
      type: params.type,
      file_name: params.fileName,
      file_url: '', // Will be updated after signature capture
      file_size: 0,
      mime_type: 'application/pdf',
      bol_number: params.bolNumber ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export async function uploadDocument(params: {
  loadId: string;
  uploadedBy: string;
  companyId: string | null;
  type: DocumentType;
  file: File;
  bolNumber?: string;
}): Promise<DocumentRow> {
  const ext = params.file.name.split('.').pop() ?? 'bin';
  const path = `${params.loadId}/${params.type}-${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(path, params.file, { contentType: params.file.type, upsert: false });
  if (storageError) throw new Error(storageError.message);

  // Get public/signed URL
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

  // Insert document row
  const { data, error } = await supabase
    .from('documents')
    .insert({
      load_id: params.loadId,
      uploaded_by: params.uploadedBy,
      company_id: params.companyId,
      type: params.type,
      file_name: params.file.name,
      file_url: urlData.publicUrl,
      file_size: params.file.size,
      mime_type: params.file.type,
      bol_number: params.bolNumber ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export interface BolStatus {
  loadId: string;
  hasBol: boolean;
  signed: boolean;
}

export async function getBolStatusForLoads(loadIds: string[]): Promise<BolStatus[]> {
  if (loadIds.length === 0) return [];
  if (loadIds[0]?.startsWith('load-')) {
    const { DEMO_BOL_STATUS } = await import('@/lib/demo-data');
    return loadIds.map(
      (id) =>
        DEMO_BOL_STATUS.find((b) => b.loadId === id) ?? {
          loadId: id,
          hasBol: false,
          signed: false,
        },
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('documents')
    .select('load_id, signed_at')
    .in('load_id', loadIds)
    .eq('type', 'bill_of_lading');
  if (error) return loadIds.map((id) => ({ loadId: id, hasBol: false, signed: false }));

  const bolByLoad = new Map<string, { hasBol: boolean; signed: boolean }>();
  for (const row of data ?? []) {
    const existing = bolByLoad.get(row.load_id);
    bolByLoad.set(row.load_id, {
      hasBol: true,
      signed: existing?.signed || !!row.signed_at,
    });
  }
  return loadIds.map((id) => ({
    loadId: id,
    hasBol: bolByLoad.get(id)?.hasBol ?? false,
    signed: bolByLoad.get(id)?.signed ?? false,
  }));
}

/**
 * Mark a BOL document as signed and notify broker + carrier.
 */
export async function markBolSigned(params: {
  documentId: string;
  signatoryName: string;
  signatureUrl?: string; // Separate PNG (for quick preview)
  signedPdfUrl?: string; // Full signed PDF URL
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('documents')
    .update({
      signed_at: new Date().toISOString(),
      signature_url: params.signatureUrl ?? null,
      signatory_name: params.signatoryName,
      ...(params.signedPdfUrl && { file_url: params.signedPdfUrl }), // Replace with signed PDF
    })
    .eq('id', params.documentId);
  if (error) throw new Error(error.message);
}

/**
 * After a BOL is signed, notify both the broker (load poster)
 * and the carrier (accepted bidder) via email + in-app notification.
 * Non-blocking — failures are logged but never thrown.
 */
export async function notifyBolSignedParties(params: {
  loadId: string;
  loadNumber: string;
  origin: string;
  dest: string;
  signerName: string;
  bolPdfUrl?: string;
}): Promise<void> {
  const { loadId, loadNumber, origin, dest, signerName, bolPdfUrl } = params;
  const body = `${signerName} signed BOL for load ${loadNumber}`;
  const emailData = { loadNumber, origin, dest, signedBy: signerName, bolPdfUrl };

  try {
    // Parallel: resolve broker (load poster) + carrier (accepted bid)
    const [loadRes, bidRes] = await Promise.all([
      supabase.from('loads').select('posted_by').eq('id', loadId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('bids')
        .select('carrier_id')
        .eq('load_id', loadId)
        .eq('status', 'accepted')
        .limit(1)
        .single(),
    ]);

    const brokerUserId: string | null = loadRes.data?.posted_by ?? null;
    const carrierUserId: string | null = bidRes.data?.carrier_id ?? null;

    // Resolve both emails in parallel
    const userIds = [brokerUserId, carrierUserId].filter(Boolean) as string[];
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    // Fire all emails + in-app notifications in parallel (non-blocking)
    const tasks: Promise<unknown>[] = [];

    for (const userId of userIds) {
      const email = emailMap.get(userId);
      if (email) {
        tasks.push(notifyBolSigned({ email, ...emailData }).catch(console.warn));
      }
      tasks.push(
        db
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'bol_signed',
            title: 'BOL Signed',
            body,
            load_id: loadId,
          })
          .then(undefined, console.warn),
      );
    }

    await Promise.all(tasks);
  } catch (err) {
    console.warn('[notifyBolSignedParties] Non-fatal error:', err);
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) throw new Error(error.message);
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600); // 1 hour
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
