export const PROPERTY_ID = "vfarms-estate" as const;
export const TIMEZONE = "Asia/Kolkata" as const;
export const CURRENCY = "INR" as const;

export type PropertyId = typeof PROPERTY_ID;
export type AdminRole = "owner" | "reservations" | "operations" | "content";

export type StayStatus =
  | "draft"
  | "held"
  | "awaiting_payment"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "expired";

export type EventStatus =
  | "enquiry"
  | "review"
  | "quote_sent"
  | "accepted"
  | "held"
  | "awaiting_deposit"
  | "confirmed"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled";

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refund_requested"
  | "partially_refunded"
  | "refunded";

export type HoldStatus = "active" | "released" | "converted" | "expired";
export type BlockKind = "stay" | "event" | "hold" | "maintenance" | "admin";
export type HoldPurpose = "stay" | "event";

export type PaymentExceptionKind =
  | "paid_unbooked"
  | "booking_unpaid"
  | "partial_refund"
  | "duplicate_callback"
  | "reconciliation_mismatch"
  | "late_payment_after_expiry"
  | "amount_mismatch";

export interface EventCategoryConfig {
  id: string;
  label: string;
  description: string;
  published: boolean;
  awaitingOwnerApproval: boolean;
}

export interface PropertySettings {
  id: PropertyId;
  name: string;
  timezone: typeof TIMEZONE;
  currency: typeof CURRENCY;
  locationLabel: string;
  maxAdults: number;
  maxChildren: number;
  maxGuests: number;
  maxEventAttendance: number;
  eventCapacityAwaitingOwnerApproval: boolean;
  minNights: number;
  maxNights: number;
  minAdvanceDays: number;
  advanceBookingDays: number;
  holdMinutes: number;
  turnoverSameDayAllowed: boolean;
  checkInTime: string;
  checkOutTime: string;
  eventDayExclusive: boolean;
  capacityAwaitingOwnerApproval: boolean;
  publishedRatesAwaitingOwnerApproval: boolean;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  supportHours: string | null;
  mapsUrl: string | null;
  postalAddress: string | null;
  coordinates: { lat: number; lng: number } | null;
}

export interface RoomProfile {
  id: string;
  sortOrder: number;
  name: string;
  slug: string;
  description: string;
  sizeLabel: string | null;
  bedConfiguration: string | null;
  view: string | null;
  amenities: string[];
  photoPaths: string[];
  awaitingOwnerApproval: boolean;
}

export interface InventoryBlock {
  id: string;
  propertyId: PropertyId;
  kind: BlockKind;
  holdPurpose?: HoldPurpose;
  status: "active" | "confirmed" | "held";
  startDate: string;
  endDate: string;
  stayHalfOpen: boolean;
  sourceType: "stay" | "event" | "hold" | "maintenance" | "admin";
  sourceId: string;
  expiresAt: string | null;
  reason?: string | null;
  internalNotes?: string | null;
  createdByActorId?: string | null;
  createdAt: string;
}

export interface RateRule {
  id: string;
  name: string;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  weekdays: number[] | null;
  nightlyPaise: number;
  label: string;
  awaitingOwnerApproval: boolean;
}

export interface TaxLine {
  id: string;
  name: string;
  percentBps: number;
  awaitingOwnerApproval: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  amountPaise: number;
  perNight: boolean;
  offered: boolean;
  awaitingOwnerApproval: boolean;
}

export interface PriceLine {
  code: string;
  label: string;
  amountPaise: number;
}

export interface PriceSnapshot {
  currency: typeof CURRENCY;
  nights: Array<{ date: string; nightlyPaise: number; rateLabel: string }>;
  subtotalPaise: number;
  addOns: PriceLine[];
  taxes: PriceLine[];
  depositPaise: number;
  securityDepositPaise: number;
  totalPaise: number;
  amountDueNowPaise: number;
  balanceDuePaise: number;
  notes: string[];
  generatedAt: string;
}

export interface GuestParty {
  adults: number;
  children: number;
}

export interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface StayBooking {
  id: string;
  reference: string;
  customerAccessToken: string;
  propertyId: PropertyId;
  status: StayStatus;
  checkIn: string;
  checkOut: string;
  party: GuestParty;
  guest: ContactRecord;
  holdId: string | null;
  holdExpiresAt: string | null;
  priceSnapshot: PriceSnapshot;
  policySnapshot: PolicySnapshot;
  paymentIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventEnquiry {
  id: string;
  reference: string;
  customerAccessToken: string;
  status: EventStatus;
  organizer: ContactRecord;
  eventType: string;
  startDate: string;
  endDate: string;
  expectedAttendance: number;
  preferredTiming: string;
  cateringNotes: string;
  decorationNotes: string;
  vendorNotes: string;
  setupNotes: string;
  accommodationRequested: boolean;
  additionalNotes: string;
  policyAccepted: boolean;
  privacyAccepted: boolean;
  preferredStartTime: string;
  preferredEndTime: string;
  internalNotes: string;
  quoteId: string | null;
  holdId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLine {
  id: string;
  label: string;
  amountPaise: number;
  inclusion: boolean;
}

export interface EventQuote {
  id: string;
  enquiryId: string;
  version: number;
  accessToken: string;
  supersedesQuoteId: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "withdrawn";
  overnightRoomsIncluded: boolean;
  overnightRoomsStatement: string;
  inclusions: string[];
  exclusions: string[];
  lines: QuoteLine[];
  depositPaise: number;
  balancePaise: number;
  securityDepositPaise: number;
  totalPaise: number;
  cancellationTerms: string;
  expiresAt: string;
  policySnapshot: PolicySnapshot;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export interface PolicySnapshot {
  version: string;
  cancellationSummary: string;
  stayTermsSummary: string;
  eventTermsSummary: string;
  acceptedAt: string;
}

export interface PaymentRecord {
  id: string;
  purpose: "stay" | "event";
  sourceId: string;
  holdId: string | null;
  status: PaymentStatus;
  amountPaise: number;
  currency: typeof CURRENCY;
  method: "razorpay" | "offline_upi" | "offline_bank" | "offline_cash" | "offline_other";
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  offlineReference: string | null;
  recordedByActorId: string | null;
  receivedAt: string | null;
  internalNotes: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface PaymentException {
  id: string;
  kind: PaymentExceptionKind;
  paymentId: string;
  sourceId: string | null;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: "razorpay";
  eventId: string;
  eventType: string;
  processedAt: string;
  payloadHash: string;
}

export interface NotificationRecord {
  id: string;
  type:
    | "enquiry_receipt"
    | "quotation"
    | "payment_request"
    | "booking_confirmed"
    | "event_confirmed"
    | "payment_failed"
    | "cancellation"
    | "refund"
    | "contact_receipt";
  toEmail: string;
  subject: string;
  body: string;
  html: string | null;
  idempotencyKey: string | null;
  status: "queued" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  published: boolean;
}

export interface GalleryItem {
  id: string;
  kind: "image" | "video";
  src: string;
  caption: string;
  alt: string;
  sortOrder: number;
  authentic: boolean;
  awaitingOwnerApproval: boolean;
}

export interface EstateHotspot {
  id: string;
  title: string;
  description: string;
  xPercent: number;
  yPercent: number;
  schematicOnly: boolean;
  awaitingOwnerApproval: boolean;
}

export interface ExperienceItem {
  id: string;
  title: string;
  description: string;
  offered: boolean;
  awaitingOwnerApproval: boolean;
}

export interface Testimonial {
  id: string;
  guestName: string;
  quote: string;
  approved: boolean;
}

export interface SiteContent {
  heroEyebrow: string;
  heroHeadline: string;
  heroLede: string;
  aboutExcerpt: string;
  farmStory: string;
  stayIntro: string;
  eventIntro: string;
  roomsNotice: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorRole: AdminRole | "system" | "guest";
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  createdAt: string;
}

export interface InventoryHold {
  id: string;
  propertyId: PropertyId;
  purpose: HoldPurpose;
  status: HoldStatus;
  startDate: string;
  endDate: string;
  stayHalfOpen: boolean;
  expiresAt: string;
  sourceId: string | null;
  createdAt: string;
}

export interface AppStore {
  settings: PropertySettings;
  eventCategories: EventCategoryConfig[];
  rooms: RoomProfile[];
  blocks: InventoryBlock[];
  holds: InventoryHold[];
  stays: StayBooking[];
  enquiries: EventEnquiry[];
  quotes: EventQuote[];
  payments: PaymentRecord[];
  exceptions: PaymentException[];
  webhooks: WebhookEvent[];
  notifications: NotificationRecord[];
  rateRules: RateRule[];
  taxes: TaxLine[];
  addOns: AddOn[];
  faqs: FaqItem[];
  gallery: GalleryItem[];
  hotspots: EstateHotspot[];
  experiences: ExperienceItem[];
  testimonials: Testimonial[];
  content: SiteContent;
  contacts: ContactRecord[];
  audit: AuditEntry[];
  admins: AdminUser[];
  refunds: Array<{
    id: string;
    paymentId: string;
    amountPaise: number;
    reason: string;
    actorId: string;
    status: "pending" | "succeeded" | "failed";
    createdAt: string;
    gatewayReference: string | null;
    customerNotified: boolean;
  }>;
}
