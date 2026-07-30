export type UserRole = 'carrier' | 'broker' | 'shipper' | 'admin' | 'driver';

export type EquipmentType =
  | 'van'
  | 'reefer'
  | 'flatbed'
  | 'step_deck'
  | 'lowboy'
  | 'tanker'
  | 'box_truck'
  | 'sprinter';

export type LoadStatus =
  | 'draft'
  | 'posted'
  | 'bid_received'
  | 'awarded'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type TruckStatus = 'available' | 'booked' | 'inactive';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  company: Company;
  avatarUrl?: string;
}

export interface Company {
  id: string;
  name: string;
  type: UserRole;
  mcNumber?: string;
  dotNumber?: string;
  verified: boolean;
  rating?: number;
  totalLoads?: number;
  onTimePercent?: number;
}

export interface Load {
  id: string;
  loadNumber: string;
  postedBy: string;
  companyId?: string;
  companyName: string;
  companyLogoUrl?: string;
  originCity: string;
  originState: string;
  originAddress?: string;
  originZip?: string;
  destCity: string;
  destState: string;
  destAddress?: string;
  destZip?: string;
  pickupDate: string;
  deliveryDate: string;
  equipment: EquipmentType;
  commodity: string;
  weightLbs: number;
  rateUsd: number;
  ratePerMile: number;
  totalMiles?: number;
  status: LoadStatus;
  bidCount?: number;
  hazmat?: boolean;
  tempControlled?: boolean;
  postedAt?: string; // ISO timestamp for load age
  brokerCreditScore?: number; // 0-100
  assignedDriverId?: string;
  driverName?: string;
  secondDriverId?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  freight_class?: string;
  packaging_type?: string;
  po_number?: string;
  shipper_reference?: string;

  // Contact Information
  shipperName?: string;
  shipperContactName?: string;
  shipperContactPhone?: string;
  shipperContactEmail?: string;
  receiverName?: string;
  receiverContactName?: string;
  receiverContactPhone?: string;
  receiverContactEmail?: string;

  // Appointment Times
  pickupApptStart?: string;
  pickupApptEnd?: string;
  deliveryApptStart?: string;
  deliveryApptEnd?: string;

  // Freight Details
  piecesCount?: number;
  palletsCount?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  stackable?: boolean;
  specialInstructions?: string;
  loadingNotes?: string;
  deliveryNotes?: string;
  fullPartial?: 'full' | 'partial';
}

export interface Truck {
  id: string;
  postedBy: string;
  companyName: string;
  originCity: string;
  originState: string;
  destCity?: string;
  destState?: string;
  availableDate: string;
  equipment: EquipmentType;
  lengthFt?: number;
  weightCapacityLbs?: number;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  status: TruckStatus;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  fromMe: boolean;
  time: string;
}

export interface Conversation {
  id: string;
  loadNumber: string;
  otherParty: string;
  otherPartyRole: UserRole;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages?: ChatMessage[];
}

export interface TrackingMilestone {
  label: string;
  location: string;
  timestamp: string;
  completed: boolean;
  current?: boolean;
}

// ── GPS & Tracking Types ──────────────────────────────────────────────────────

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  ts: number; // Unix ms
  speed_ms?: number;
}

export interface BreadcrumbSnapshot {
  id: string;
  loadNumber: string;
  driverId: string;
  polyline: BreadcrumbPoint[];
  totalPoints: number;
  startTime: string;
  endTime: string;
}

export interface TrackingToken {
  id: string;
  loadNumber: string;
  token: string;
  createdBy: string;
  expiresAt: string;
  revoked: boolean;
}

export interface Geofence {
  id: string;
  loadNumber: string;
  stopType: 'pickup' | 'delivery';
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface GeofenceEvent {
  id: string;
  geofenceId: string;
  loadNumber: string;
  driverId: string;
  eventType: 'enter' | 'exit';
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface DwellRecord {
  id: string;
  loadNumber: string;
  geofenceId: string;
  stopType: 'pickup' | 'delivery';
  label: string;
  enteredAt: string;
  exitedAt?: string;
  dwellMinutes?: number;
  detentionFlagged: boolean;
}

// ── Driver Portal Types ───────────────────────────────────────────────────────

export type TirePosition =
  | 'front_left'
  | 'front_right'
  | 'rear_outer_left'
  | 'rear_outer_right'
  | 'rear_inner_left'
  | 'rear_inner_right'
  | 'trailer_left_1'
  | 'trailer_right_1'
  | 'trailer_left_2'
  | 'trailer_right_2';

export type TireSeverity = 'flat' | 'blowout' | 'low_pressure' | 'damage';

export type TireResolution =
  | 'changed_spare'
  | 'roadside_service'
  | 'patched'
  | 'replaced'
  | 'other';

export interface TireIncident {
  id: string;
  driverId: string;
  loadNumber?: string;
  incidentDate: string;
  locationText: string;
  lat?: number;
  lng?: number;
  tirePosition: TirePosition;
  severity: TireSeverity;
  description?: string;
  resolution?: TireResolution;
  resolvedAt?: string;
  photos: string[];
  createdAt: string;
}

export type ReceiptCategory =
  | 'fuel'
  | 'maintenance'
  | 'tolls'
  | 'meals'
  | 'lodging'
  | 'parking'
  | 'supplies'
  | 'other';

export interface Receipt {
  id: string;
  driverId: string;
  loadNumber?: string;
  category: ReceiptCategory;
  amountUsd: number;
  vendorName: string;
  receiptDate: string;
  notes?: string;
  imageUrl: string;
  imageThumbnailUrl?: string;
  fileSizeBytes?: number;
  createdAt: string;
}

// ── Scoring & ETA Types ───────────────────────────────────────────────────────

export interface DriverScore {
  id: string;
  driverId: string;
  loadNumber: string;
  overallScore: number;
  speedScore: number;
  routeScore: number;
  dwellScore: number;
  details?: Record<string, unknown>;
}

export interface ETAResult {
  estimatedArrival: string; // ISO
  confidencePercent: number;
  remainingMiles: number;
  remainingMinutes: number;
}
