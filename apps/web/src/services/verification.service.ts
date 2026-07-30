import { supabase } from '@/lib/supabase';
import type { CarrierVerificationRow } from '@/lib/database.types';
import { verifyByMcNumber, verifyByDotNumber } from '@/features/verification/lib/fmcsa';

export type { CarrierVerificationRow };

export async function getVerification(companyId: string): Promise<CarrierVerificationRow | null> {
  const { data, error } = await supabase
    .from('carrier_verifications')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function startFmcsaLookup(
  companyId: string,
  opts: { mcNumber?: string; dotNumber?: string },
): Promise<CarrierVerificationRow> {
  const result = opts.mcNumber
    ? await verifyByMcNumber(opts.mcNumber)
    : opts.dotNumber
      ? await verifyByDotNumber(opts.dotNumber)
      : null;

  if (!result) throw new Error('Provide an MC or DOT number');

  const { data, error } = await supabase
    .from('carrier_verifications')
    .upsert({
      company_id: companyId,
      mc_number: result.mcNumber,
      dot_number: result.dotNumber,
      fmcsa_status: result.status,
      fmcsa_verified_at: new Date().toISOString(),
      safety_rating: result.safetyRating,
      csa_score: result.csaScore,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CarrierVerificationRow;
}

export async function uploadInsuranceCert(
  companyId: string,
  file: File,
  meta: {
    carrier: string;
    policy: string;
    amountUsd: number;
    expiresAt: string;
  },
): Promise<CarrierVerificationRow> {
  const path = `insurance/${companyId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

  const { data, error } = await supabase
    .from('carrier_verifications')
    .upsert({
      company_id: companyId,
      insurance_carrier: meta.carrier,
      insurance_policy: meta.policy,
      insurance_amount_usd: meta.amountUsd,
      insurance_expires_at: meta.expiresAt,
      insurance_cert_url: urlData.publicUrl,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CarrierVerificationRow;
}

export async function uploadW9(companyId: string, file: File): Promise<CarrierVerificationRow> {
  const path = `w9/${companyId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

  const { data, error } = await supabase
    .from('carrier_verifications')
    .upsert({
      company_id: companyId,
      w9_url: urlData.publicUrl,
      w9_uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CarrierVerificationRow;
}
