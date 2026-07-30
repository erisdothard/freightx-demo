/**
 * Converts Supabase snake_case rows to camelCase shared types.
 * This keeps the LoadCard and existing UI components unchanged.
 */
import type {
  Load,
  Truck,
  TrackingMilestone,
  EquipmentType,
  LoadStatus,
  TruckStatus,
} from '@freightx/shared';
import type { LoadRow, TruckRow, TrackingMilestoneRow } from './database.types';
import { titleCase } from './utils';

export function rowToLoad(row: LoadRow): Load {
  return {
    id: row.id,
    loadNumber: row.load_number,
    postedBy: row.posted_by ?? '',
    companyName: row.company_name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    companyLogoUrl: ((row as any).company_logo_url as any)?.logo_url ?? undefined,
    originCity: titleCase(row.origin_city),
    originState: row.origin_state?.toUpperCase(),
    originAddress: row.origin_address ?? undefined,
    originZip: row.origin_zip ?? undefined,
    destCity: titleCase(row.dest_city),
    destState: row.dest_state?.toUpperCase(),
    destAddress: row.dest_address ?? undefined,
    destZip: row.dest_zip ?? undefined,
    pickupDate: row.pickup_date,
    deliveryDate: row.delivery_date,
    equipment: row.equipment as EquipmentType,
    commodity: titleCase(row.commodity),
    weightLbs: row.weight_lbs,
    rateUsd: row.rate_usd,
    ratePerMile: row.rate_per_mile ?? 0,
    totalMiles: row.total_miles ?? undefined,
    status: row.status as LoadStatus,
    bidCount: row.bid_count,
    hazmat: row.hazmat,
    tempControlled: row.temp_controlled,
    postedAt: row.posted_at,
    brokerCreditScore: row.broker_credit_score ?? undefined,
    assignedDriverId: row.assigned_driver_id ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    driverName: (row as any).driver_profile?.full_name ?? undefined,
    secondDriverId: row.second_driver_id ?? undefined,
    assigneeId: row.assignee_id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assigneeName: (row as any).assignee_profile?.full_name ?? null,
    freight_class: row.freight_class ?? undefined,
    packaging_type: row.packaging_type ?? undefined,
    po_number: row.po_number ?? undefined,
    shipper_reference: row.shipper_reference ?? undefined,

    // Contact Information
    shipperName: row.shipper_name ?? undefined,
    shipperContactName: row.shipper_contact_name ?? undefined,
    shipperContactPhone: row.shipper_contact_phone ?? undefined,
    shipperContactEmail: row.shipper_contact_email ?? undefined,
    receiverName: row.receiver_name ?? undefined,
    receiverContactName: row.receiver_contact_name ?? undefined,
    receiverContactPhone: row.receiver_contact_phone ?? undefined,
    receiverContactEmail: row.receiver_contact_email ?? undefined,

    // Appointment Times
    pickupApptStart: row.pickup_appt_start ?? undefined,
    pickupApptEnd: row.pickup_appt_end ?? undefined,
    deliveryApptStart: row.delivery_appt_start ?? undefined,
    deliveryApptEnd: row.delivery_appt_end ?? undefined,

    // Freight Details
    piecesCount: row.pieces_count ?? undefined,
    palletsCount: row.pallets_count ?? undefined,
    lengthIn: row.length_in ?? undefined,
    widthIn: row.width_in ?? undefined,
    heightIn: row.height_in ?? undefined,
    stackable: row.stackable ?? undefined,
    specialInstructions: row.special_instructions ?? undefined,
    loadingNotes: row.loading_notes ?? undefined,
    deliveryNotes: row.delivery_notes ?? undefined,
    fullPartial: (row.full_partial as 'full' | 'partial') ?? undefined,
  };
}

export function rowToTruck(row: TruckRow): Truck {
  return {
    id: row.id,
    postedBy: row.posted_by ?? '',
    companyName: row.company_name,
    originCity: titleCase(row.origin_city),
    originState: row.origin_state?.toUpperCase(),
    destCity: row.dest_city ? titleCase(row.dest_city) : undefined,
    destState: row.dest_state?.toUpperCase() ?? undefined,
    availableDate: row.available_date,
    equipment: row.equipment as EquipmentType,
    lengthFt: row.length_ft ?? undefined,
    weightCapacityLbs: row.weight_capacity_lbs ?? undefined,
    driverName: row.driver_name ?? undefined,
    driverPhone: row.driver_phone ?? undefined,
    driverId: row.driver_id ?? undefined,
    status: row.status as TruckStatus,
  };
}

export function rowToMilestone(row: TrackingMilestoneRow): TrackingMilestone {
  return {
    label: row.label,
    location: row.location,
    timestamp: row.milestone_timestamp ?? '',
    completed: row.completed,
    current: row.current,
  };
}
