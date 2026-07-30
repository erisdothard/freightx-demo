/**
 * SMS template functions — typed, consistent copy for all notification events.
 * Replace raw string construction in email-notifications.service.ts with these.
 *
 * All templates return strings under 160 chars where possible (1 SMS segment).
 */

export function bidReceivedSms(loadNumber: string, amountUsd: number): string {
  return `FreightX: New bid of $${amountUsd.toLocaleString()} on load #${loadNumber}. View: https://app.freightx.app/carrier/loads`;
}

export function bidAcceptedSms(loadNumber: string): string {
  return `FreightX: Your bid on load #${loadNumber} was ACCEPTED. Check the app to confirm booking details.`;
}

export function bidDeclinedSms(loadNumber: string): string {
  return `FreightX: Your bid on load #${loadNumber} was not selected. Browse open loads: https://app.freightx.app/carrier/loads`;
}

export function bookingConfirmedSms(
  loadNumber: string,
  pickupDate: string,
  origin: string,
  dest: string,
): string {
  return `FreightX: Load #${loadNumber} confirmed. Pickup ${pickupDate} — ${origin} → ${dest}. Check app for full details.`;
}

export function loadStatusChangedSms(loadNumber: string, newStatus: string): string {
  return `FreightX: Load #${loadNumber} status → ${newStatus}. https://app.freightx.app`;
}

export function insuranceExpirySms(expiryDate: string): string {
  return `FreightX: Your insurance expires ${expiryDate}. Upload renewed certificate to keep posting loads. https://app.freightx.app/profile`;
}

export function factoringApprovedSms(loadNumber: string, netPayout: number): string {
  return `FreightX: QuickPay approved for load #${loadNumber}. Net payout: $${netPayout.toLocaleString()}. Funds on the way.`;
}

export function newLoadAvailableSms(
  origin: string,
  dest: string,
  equipment: string,
  rateUsd: number,
): string {
  return `FreightX: New ${equipment} load ${origin}→${dest} at $${rateUsd.toLocaleString()}. Bid now: https://app.freightx.app/carrier/loads`;
}

export function driverAssignedSms(loadNumber: string, pickupDate: string): string {
  return `FreightX: You've been assigned to load #${loadNumber}. Pickup: ${pickupDate}. Open app for details.`;
}
