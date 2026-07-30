/**
 * Mock data for demo mode — realistic freight loads, bids, and driver data
 * for video recordings and walkthroughs. No Supabase calls needed.
 */
import type { Load } from '@freightx/shared';
import type { BidWithLoad } from '@/services/bids.service';
import type { BidRow } from '@/lib/database.types';

// ──────────────────────────────────────────
// Shared IDs
// ──────────────────────────────────────────
const CARRIER_ID = 'demo-carrier';
const BROKER_ID = 'demo-broker';
const SHIPPER_ID = 'demo-shipper';
const DRIVER_ID = 'demo-driver';
const DRIVER_2_ID = 'demo-driver-2';
const COMPANY_ID = 'demo-company-carrier';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ──────────────────────────────────────────
// Loads — mixed statuses for all dashboards
// ──────────────────────────────────────────
export const DEMO_LOADS: Load[] = [
  {
    id: 'load-001',
    loadNumber: 'FX-1042',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Atlanta',
    originState: 'GA',
    destCity: 'Dallas',
    destState: 'TX',
    pickupDate: daysFromNow(0),
    deliveryDate: daysFromNow(2),
    equipment: 'van',
    commodity: 'Electronics',
    weightLbs: 38000,
    rateUsd: 3200,
    ratePerMile: 2.48,
    totalMiles: 1290,
    status: 'in_transit',
    bidCount: 4,
    assignedDriverId: DRIVER_ID,
    driverName: 'Carlos Mendez',
    postedAt: hoursAgo(48),
    brokerCreditScore: 92,
  },
  {
    id: 'load-002',
    loadNumber: 'FX-1043',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Nashville',
    originState: 'TN',
    destCity: 'Chicago',
    destState: 'IL',
    pickupDate: daysFromNow(1),
    deliveryDate: daysFromNow(2),
    equipment: 'reefer',
    commodity: 'Produce',
    weightLbs: 42000,
    rateUsd: 2850,
    ratePerMile: 3.12,
    totalMiles: 914,
    status: 'awarded',
    bidCount: 3,
    assignedDriverId: undefined,
    driverName: undefined,
    postedAt: hoursAgo(24),
    brokerCreditScore: 88,
  },
  {
    id: 'load-003',
    loadNumber: 'FX-1044',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Los Angeles',
    originState: 'CA',
    destCity: 'Phoenix',
    destState: 'AZ',
    pickupDate: daysFromNow(2),
    deliveryDate: daysFromNow(3),
    equipment: 'flatbed',
    commodity: 'Steel Coils',
    weightLbs: 44000,
    rateUsd: 1850,
    ratePerMile: 2.85,
    totalMiles: 649,
    status: 'posted',
    bidCount: 0,
    postedAt: hoursAgo(6),
    brokerCreditScore: 95,
  },
  {
    id: 'load-004',
    loadNumber: 'FX-1045',
    postedBy: SHIPPER_ID,
    companyId: 'demo-company-shipper',
    companyName: 'Park Manufacturing Co',
    originCity: 'Miami',
    originState: 'FL',
    destCity: 'Charlotte',
    destState: 'NC',
    pickupDate: daysFromNow(-1),
    deliveryDate: daysFromNow(0),
    equipment: 'van',
    commodity: 'Auto Parts',
    weightLbs: 35000,
    rateUsd: 2400,
    ratePerMile: 2.61,
    totalMiles: 920,
    status: 'delivered',
    bidCount: 5,
    assignedDriverId: DRIVER_ID,
    driverName: 'Carlos Mendez',
    postedAt: hoursAgo(72),
    brokerCreditScore: 90,
  },
  {
    id: 'load-005',
    loadNumber: 'FX-1046',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Houston',
    originState: 'TX',
    destCity: 'Memphis',
    destState: 'TN',
    pickupDate: daysFromNow(1),
    deliveryDate: daysFromNow(2),
    equipment: 'van',
    commodity: 'Consumer Goods',
    weightLbs: 40000,
    rateUsd: 1950,
    ratePerMile: 2.72,
    totalMiles: 717,
    status: 'bid_received',
    bidCount: 6,
    postedAt: hoursAgo(12),
    brokerCreditScore: 85,
  },
  {
    id: 'load-006',
    loadNumber: 'FX-1047',
    postedBy: SHIPPER_ID,
    companyId: 'demo-company-shipper',
    companyName: 'Park Manufacturing Co',
    originCity: 'Seattle',
    originState: 'WA',
    destCity: 'Portland',
    destState: 'OR',
    pickupDate: daysFromNow(3),
    deliveryDate: daysFromNow(4),
    equipment: 'step_deck',
    commodity: 'Machinery',
    weightLbs: 46000,
    rateUsd: 1200,
    ratePerMile: 3.45,
    totalMiles: 348,
    status: 'posted',
    bidCount: 0,
    postedAt: hoursAgo(3),
  },
  {
    id: 'load-007',
    loadNumber: 'FX-1048',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Denver',
    originState: 'CO',
    destCity: 'Kansas City',
    destState: 'MO',
    pickupDate: daysFromNow(0),
    deliveryDate: daysFromNow(1),
    equipment: 'reefer',
    commodity: 'Frozen Foods',
    weightLbs: 39000,
    rateUsd: 2100,
    ratePerMile: 2.95,
    totalMiles: 712,
    status: 'dispatched',
    bidCount: 2,
    assignedDriverId: DRIVER_2_ID,
    driverName: 'Mike Johnson',
    postedAt: hoursAgo(36),
    brokerCreditScore: 91,
  },
  {
    id: 'load-008',
    loadNumber: 'FX-1049',
    postedBy: SHIPPER_ID,
    companyId: 'demo-company-shipper',
    companyName: 'Park Manufacturing Co',
    originCity: 'Detroit',
    originState: 'MI',
    destCity: 'Indianapolis',
    destState: 'IN',
    pickupDate: daysFromNow(-3),
    deliveryDate: daysFromNow(-2),
    equipment: 'van',
    commodity: 'Automotive Parts',
    weightLbs: 32000,
    rateUsd: 1100,
    ratePerMile: 2.55,
    totalMiles: 431,
    status: 'completed',
    bidCount: 3,
    assignedDriverId: DRIVER_ID,
    driverName: 'Carlos Mendez',
    postedAt: hoursAgo(120),
  },
  {
    id: 'load-009',
    loadNumber: 'FX-1050',
    postedBy: BROKER_ID,
    companyId: 'demo-company-broker',
    companyName: 'Apex Freight Solutions',
    originCity: 'Jacksonville',
    originState: 'FL',
    destCity: 'Savannah',
    destState: 'GA',
    pickupDate: daysFromNow(2),
    deliveryDate: daysFromNow(3),
    equipment: 'flatbed',
    commodity: 'Lumber',
    weightLbs: 43000,
    rateUsd: 950,
    ratePerMile: 2.68,
    totalMiles: 355,
    status: 'bid_received',
    bidCount: 4,
    postedAt: hoursAgo(8),
    brokerCreditScore: 87,
  },
  {
    id: 'load-010',
    loadNumber: 'FX-1051',
    postedBy: SHIPPER_ID,
    companyId: 'demo-company-shipper',
    companyName: 'Park Manufacturing Co',
    originCity: 'San Antonio',
    originState: 'TX',
    destCity: 'New Orleans',
    destState: 'LA',
    pickupDate: daysFromNow(1),
    deliveryDate: daysFromNow(2),
    equipment: 'van',
    commodity: 'Textiles',
    weightLbs: 28000,
    rateUsd: 1650,
    ratePerMile: 2.78,
    totalMiles: 594,
    status: 'in_transit',
    bidCount: 2,
    assignedDriverId: DRIVER_2_ID,
    driverName: 'Mike Johnson',
    postedAt: hoursAgo(48),
  },
];

// ──────────────────────────────────────────
// Bids (carrier perspective)
// ──────────────────────────────────────────
export const DEMO_BIDS: BidWithLoad[] = [
  {
    id: 'bid-001',
    load_id: 'load-005',
    carrier_id: CARRIER_ID,
    company_id: COMPANY_ID,
    status: 'pending',
    amount_usd: 1900,
    note: 'Can pick up same day',
    created_at: hoursAgo(10),
    updated_at: hoursAgo(10),
    counter_amount_usd: null,
    counter_note: null,
    countered_at: null,
    carrier_eligibility_verified: true,
    carrier_insurance_verified: true,
    load: {
      load_number: 'FX-1046',
      origin_city: 'Houston',
      origin_state: 'TX',
      dest_city: 'Memphis',
      dest_state: 'TN',
      rate_usd: 1950,
      equipment: 'van',
      pickup_date: daysFromNow(1),
      status: 'bid_received',
    },
  } as unknown as BidWithLoad,
  {
    id: 'bid-002',
    load_id: 'load-009',
    carrier_id: CARRIER_ID,
    company_id: COMPANY_ID,
    status: 'countered',
    amount_usd: 900,
    note: 'Available for flatbed',
    created_at: hoursAgo(6),
    updated_at: hoursAgo(2),
    counter_amount_usd: 920,
    counter_note: 'Meet in the middle?',
    countered_at: hoursAgo(2),
    carrier_eligibility_verified: true,
    carrier_insurance_verified: true,
    load: {
      load_number: 'FX-1050',
      origin_city: 'Jacksonville',
      origin_state: 'FL',
      dest_city: 'Savannah',
      dest_state: 'GA',
      rate_usd: 950,
      equipment: 'flatbed',
      pickup_date: daysFromNow(2),
      status: 'bid_received',
    },
  } as unknown as BidWithLoad,
  {
    id: 'bid-003',
    load_id: 'load-003',
    carrier_id: CARRIER_ID,
    company_id: COMPANY_ID,
    status: 'pending',
    amount_usd: 1800,
    note: null,
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
    counter_amount_usd: null,
    counter_note: null,
    countered_at: null,
    carrier_eligibility_verified: true,
    carrier_insurance_verified: true,
    load: {
      load_number: 'FX-1044',
      origin_city: 'Los Angeles',
      origin_state: 'CA',
      dest_city: 'Phoenix',
      dest_state: 'AZ',
      rate_usd: 1850,
      equipment: 'flatbed',
      pickup_date: daysFromNow(2),
      status: 'posted',
    },
  } as unknown as BidWithLoad,
];

// ──────────────────────────────────────────
// BOL Status
// ──────────────────────────────────────────
export const DEMO_BOL_STATUS = [
  { loadId: 'load-001', hasBol: true, signed: false },
  { loadId: 'load-002', hasBol: false, signed: false },
  { loadId: 'load-004', hasBol: true, signed: true },
  { loadId: 'load-007', hasBol: true, signed: false },
  { loadId: 'load-008', hasBol: true, signed: true },
  { loadId: 'load-010', hasBol: true, signed: false },
];

// ──────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────
export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: 'n1',
    title: 'Bid Accepted',
    body: 'Your bid on FX-1042 ATL→DFW was accepted.',
    type: 'bid_accepted',
    read: false,
    created_at: hoursAgo(2),
  },
  {
    id: 'n2',
    title: 'New Counter Offer',
    body: 'Apex Freight countered your bid on FX-1050.',
    type: 'bid_countered',
    read: false,
    created_at: hoursAgo(3),
  },
  {
    id: 'n3',
    title: 'Load Delivered',
    body: 'FX-1045 MIA→CLT marked as delivered.',
    type: 'load_delivered',
    read: false,
    created_at: hoursAgo(5),
  },
  {
    id: 'n4',
    title: 'Driver Assigned',
    body: 'Carlos Mendez assigned to FX-1042.',
    type: 'driver_assigned',
    read: true,
    created_at: hoursAgo(12),
  },
  {
    id: 'n5',
    title: 'New Bid Received',
    body: 'Rivera Transport bid $1,900 on FX-1046.',
    type: 'bid_received',
    read: false,
    created_at: hoursAgo(10),
  },
  {
    id: 'n6',
    title: 'BOL Signed',
    body: 'BOL signed for FX-1045 MIA→CLT.',
    type: 'bol_signed',
    read: true,
    created_at: hoursAgo(24),
  },
];

// ──────────────────────────────────────────
// Trucks (carrier fleet)
// ──────────────────────────────────────────
export const DEMO_TRUCKS = [
  {
    id: 'truck-001',
    unitNumber: 'RT-101',
    type: 'van',
    year: 2022,
    make: 'Freightliner',
    model: 'Cascadia',
    vin: '1FUJGLDR8NSXF7392',
    licensePlate: 'TN-4829',
    status: 'in_transit',
    currentDriverId: DRIVER_ID,
    currentDriverName: 'Carlos Mendez',
    lastLocation: { lat: 32.7767, lng: -96.797 },
    lastLocationUpdate: hoursAgo(0.5),
  },
  {
    id: 'truck-002',
    unitNumber: 'RT-102',
    type: 'reefer',
    year: 2023,
    make: 'Kenworth',
    model: 'T680',
    vin: '2XKYD49X08M263849',
    licensePlate: 'TN-5130',
    status: 'dispatched',
    currentDriverId: DRIVER_2_ID,
    currentDriverName: 'Mike Johnson',
    lastLocation: { lat: 39.7392, lng: -104.9903 },
    lastLocationUpdate: hoursAgo(1),
  },
  {
    id: 'truck-003',
    unitNumber: 'RT-103',
    type: 'flatbed',
    year: 2021,
    make: 'Peterbilt',
    model: '579',
    vin: '1XPWD49X1FD256790',
    licensePlate: 'TN-3847',
    status: 'available',
    currentDriverId: null,
    currentDriverName: null,
    lastLocation: { lat: 36.1627, lng: -86.7816 },
    lastLocationUpdate: hoursAgo(12),
  },
  {
    id: 'truck-004',
    unitNumber: 'RT-104',
    type: 'van',
    year: 2024,
    make: 'Volvo',
    model: 'VNL 860',
    vin: '4V4NC9EH5RN123456',
    licensePlate: 'TN-6021',
    status: 'available',
    currentDriverId: null,
    currentDriverName: null,
    lastLocation: { lat: 36.1627, lng: -86.7816 },
    lastLocationUpdate: hoursAgo(6),
  },
];

// ──────────────────────────────────────────
// Messages
// ──────────────────────────────────────────
export const DEMO_MESSAGES = [
  {
    id: 'conv-001',
    participantName: 'Sarah Chen',
    participantRole: 'broker',
    lastMessage: 'Driver is 2 hours out from the pickup. ETA looks good.',
    lastMessageAt: hoursAgo(0.5),
    unread: 2,
    loadNumber: 'FX-1042',
  },
  {
    id: 'conv-002',
    participantName: 'James Park',
    participantRole: 'shipper',
    lastMessage: 'Dock appointment confirmed for 8AM tomorrow.',
    lastMessageAt: hoursAgo(3),
    unread: 0,
    loadNumber: 'FX-1045',
  },
  {
    id: 'conv-003',
    participantName: 'Carlos Mendez',
    participantRole: 'driver',
    lastMessage: 'Just passed the weigh station, all clear.',
    lastMessageAt: hoursAgo(1),
    unread: 1,
    loadNumber: 'FX-1042',
  },
];

// ──────────────────────────────────────────
// Helpers — filter loads by role context
// ──────────────────────────────────────────

/** Carrier: loads they've been awarded / are working on */
export function getCarrierLoads(): Load[] {
  return DEMO_LOADS.filter((l) =>
    ['awarded', 'dispatched', 'in_transit', 'delivered', 'completed'].includes(l.status),
  );
}

/** Broker: loads they posted */
export function getBrokerLoads(): Load[] {
  return DEMO_LOADS.filter((l) => l.postedBy === BROKER_ID);
}

/** Shipper: loads they posted */
export function getShipperLoads(): Load[] {
  return DEMO_LOADS.filter((l) => l.postedBy === SHIPPER_ID);
}

/** Driver: loads assigned to them */
export function getDriverLoadsDemo(): Load[] {
  return DEMO_LOADS.filter(
    (l) =>
      l.assignedDriverId === DRIVER_ID &&
      ['dispatched', 'in_transit', 'delivered', 'completed'].includes(l.status),
  );
}

/** All loads for the load board */
export function getAllLoads(): Load[] {
  return DEMO_LOADS;
}
