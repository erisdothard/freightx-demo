const FMCSA_BASE = 'https://mobile.fmcsa.dot.gov/qc/services';
const API_KEY = import.meta.env.VITE_FMCSA_API_KEY as string;

export interface FmcsaResult {
  status: 'AUTHORIZED' | 'NOT AUTHORIZED' | 'PENDING' | 'UNKNOWN';
  legalName: string | null;
  dotNumber: string | null;
  mcNumber: string | null;
  safetyRating: string | null;
  csaScore: number | null;
}

export async function verifyByMcNumber(mcNumber: string): Promise<FmcsaResult> {
  if (API_KEY === 'PLACEHOLDER_FMCSA_KEY') {
    return mockFmcsaResult(mcNumber);
  }
  const res = await fetch(`${FMCSA_BASE}/carriers/${mcNumber}?webKey=${API_KEY}`);
  if (!res.ok) throw new Error('FMCSA lookup failed');
  const data = await res.json();
  const carrier = data?.content?.carrier;
  return {
    status: carrier?.allowedToOperate === 'Y' ? 'AUTHORIZED' : 'NOT AUTHORIZED',
    legalName: carrier?.legalName ?? null,
    dotNumber: carrier?.dotNumber ? String(carrier.dotNumber) : null,
    mcNumber: mcNumber,
    safetyRating: carrier?.safetyRating ?? null,
    csaScore: null,
  };
}

export async function verifyByDotNumber(dotNumber: string): Promise<FmcsaResult> {
  if (API_KEY === 'PLACEHOLDER_FMCSA_KEY') {
    return mockFmcsaResult(dotNumber);
  }
  const res = await fetch(`${FMCSA_BASE}/carriers/docket-number/${dotNumber}?webKey=${API_KEY}`);
  if (!res.ok) throw new Error('FMCSA lookup failed');
  const data = await res.json();
  const carrier = data?.content?.carrier;
  return {
    status: carrier?.allowedToOperate === 'Y' ? 'AUTHORIZED' : 'NOT AUTHORIZED',
    legalName: carrier?.legalName ?? null,
    dotNumber: dotNumber,
    mcNumber: carrier?.mcNumber ? String(carrier.mcNumber) : null,
    safetyRating: carrier?.safetyRating ?? null,
    csaScore: null,
  };
}

// Stub when FMCSA key isn't configured yet
function mockFmcsaResult(identifier: string): FmcsaResult {
  return {
    status: 'AUTHORIZED',
    legalName: 'PLACEHOLDER — FMCSA API key not configured',
    dotNumber: identifier,
    mcNumber: null,
    safetyRating: 'Satisfactory',
    csaScore: null,
  };
}
