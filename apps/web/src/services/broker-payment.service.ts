import { supabase } from '@/lib/supabase';

export interface BrokerPaymentSummary {
  avg_days_to_pay: number | null;
  on_time_pct: number | null;
  speed_label: 'Fast' | 'Average' | 'Slow' | 'Very Slow' | null;
  total_payments: number;
}

export async function getBrokerPaymentSummary(
  companyId: string,
): Promise<BrokerPaymentSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_broker_payment_summary', {
    p_company_id: companyId,
  });

  if (error || !data) {
    return {
      avg_days_to_pay: null,
      on_time_pct: null,
      speed_label: null,
      total_payments: 0,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      avg_days_to_pay: null,
      on_time_pct: null,
      speed_label: null,
      total_payments: 0,
    };
  }

  return {
    avg_days_to_pay: row.avg_days_to_pay != null ? Number(row.avg_days_to_pay) : null,
    on_time_pct: row.on_time_pct != null ? Number(row.on_time_pct) : null,
    speed_label: row.speed_label as BrokerPaymentSummary['speed_label'],
    total_payments: Number(row.total_payments ?? 0),
  };
}

export async function checkBrokerVerified(companyId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('check_broker_verified', {
    p_company_id: companyId,
  });

  if (error) return false;
  return data === true;
}
