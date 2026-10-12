import { hashPassword } from "@/lib/crypto";
import { PROPERTY_ID, TIMEZONE, CURRENCY, type AppStore } from "@/lib/types";

const now = "2026-10-12T08:30:00.000Z";

export function createDevSeed(adminEmail?: string, adminPassword?: string): AppStore {
  return {
    settings: {
      id: PROPERTY_ID,
      name: "V-Farms",
      timezone: TIMEZONE,
      currency: CURRENCY,
      locationLabel: "Near Hyderabad, Telangana, India",
      maxAdults: 10,
      maxChildren: 6,
      maxGuests: 10,
      maxEventAttendance: 120,
      eventCapacityAwaitingOwnerApproval: true,
      minNights: 1,
      maxNights: 14,
      minAdvanceDays: 0,
      advanceBookingDays: 365,
      holdMinutes: 15,
      turnoverSameDayAllowed: true,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      eventDayExclusive: true,
      capacityAwaitingOwnerApproval: true,
      publishedRatesAwaitingOwnerApproval: true,
      contactPhone: null,
      contactWhatsapp: null,
      contactEmail: null,
      supportHours: null,
      mapsUrl: null,
      postalAddress: null,
      coordinates: null,
    },
    eventCategories: [
      {
        id: "evt-intimate",
        label: "Intimate celebration",
        description: "Small private gatherings — capacity and permitted formats awaiting owner approval.",
        published: false,
        awaitingOwnerApproval: true,
      },
      {
        id: "evt-corporate",
        label: "Corporate retreat",
        description: "Off-site meetings and team gatherings — policies unpublished.",
        published: false,
        awaitingOwnerApproval: true,
      },
      {
        id: "evt-wedding",
        label: "Wedding or reception",
        description: "Ceremony and reception use of the estate — requires owner-approved terms.",
        published: false,
        awaitingOwnerApproval: true,
      },
    ],
    rooms: [1, 2, 3, 4, 5].map((index) => ({
      id: `room-${index}`,
      sortOrder: index,
      name: `Guest room ${index}`,
      slug: `guest-room-${index}`,
      description:
        "A distinct room inside the single guest building. Size, bed configuration, view, photographs and amenities will appear here after the owner supplies and approves them.",
      sizeLabel: null,
      bedConfiguration: null,
      view: null,
      amenities: [],
      photoPaths: [],
      awaitingOwnerApproval: true,
    })),
    blocks: [],
    holds: [],
    stays: [],
    enquiries: [],
    quotes: [],
    payments: [],
    exceptions: [],
    webhooks: [],
    notifications: [],
    rateRules: [
      {
        id: "rate-base",
        name: "Placeholder weekday rate",
        priority: 1,
        startDate: null,
        endDate: null,
        weekdays: [1, 2, 3, 4],
        nightlyPaise: 45_000_00,
        label: "Placeholder weekday — awaiting owner approval",
        awaitingOwnerApproval: true,
      },
      {
        id: "rate-weekend",
        name: "Placeholder weekend rate",
        priority: 2,
        startDate: null,
        endDate: null,
        weekdays: [0, 5, 6],
        nightlyPaise: 55_000_00,
        label: "Placeholder weekend — awaiting owner approval",
        awaitingOwnerApproval: true,
      },
      {
        id: "rate-peak-sample",
        name: "Sample seasonal exception",
        priority: 10,
        startDate: "2026-12-20",
        endDate: "2027-01-02",
        weekdays: null,
        nightlyPaise: 70_000_00,
        label: "Placeholder peak season — awaiting owner approval",
        awaitingOwnerApproval: true,
      },
    ],
    taxes: [
      {
        id: "tax-pending",
        name: "Applicable tax (unpublished)",
        percentBps: 0,
        awaitingOwnerApproval: true,
      },
    ],
    addOns: [],
    faqs: [
      {
        id: "faq-exclusive",
        question: "Can I book a single room?",
        answer:
          "No. V-Farms is one exclusive property. Every overnight stay reserves the entire five-acre estate and all five rooms in the guest building.",
        category: "Stays",
        sortOrder: 1,
        published: true,
      },
      {
        id: "faq-events",
        question: "Can I book an event instantly online?",
        answer:
          "No. Private events follow enquiry, owner review, quotation, acceptance, inventory hold and deposit payment. A request does not reserve the dates.",
        category: "Events",
        sortOrder: 2,
        published: true,
      },
      {
        id: "faq-capacity",
        question: "How many guests can stay overnight?",
        answer:
          "Overnight capacity is configurable and currently marked as awaiting owner approval. The booking form will refuse counts above the published limit.",
        category: "Stays",
        sortOrder: 3,
        published: true,
      },
      {
        id: "faq-location",
        question: "Where is V-Farms?",
        answer:
          "V-Farms is a five-acre dragon fruit farm near Hyderabad, Telangana. The exact postal address, map pin and directions will be published after the owner verifies them.",
        category: "Visit",
        sortOrder: 4,
        published: true,
      },
    ],
    gallery: [
      {
        id: "gallery-farm-h1",
        kind: "video",
        src: "/videos/farm-h1.mp4",
        caption: "Dragon fruit plantation at V-Farms",
        alt: "Moving footage of the V-Farms dragon fruit plantation",
        sortOrder: 1,
        authentic: true,
        awaitingOwnerApproval: false,
      },
      {
        id: "gallery-farmhouse",
        kind: "video",
        src: "/videos/farmhouse-v1.mp4",
        caption: "Guest building exterior, owner-supplied footage",
        alt: "Owner-supplied video of the V-Farms guest building",
        sortOrder: 2,
        authentic: true,
        awaitingOwnerApproval: false,
      },
    ],
    hotspots: [
      {
        id: "spot-building",
        title: "Guest building",
        description:
          "One building contains all five rooms. Exact placement is schematic until a surveyed plan or drone image is supplied.",
        xPercent: 48,
        yPercent: 42,
        schematicOnly: true,
        awaitingOwnerApproval: true,
      },
      {
        id: "spot-plantation",
        title: "Dragon fruit plantation",
        description:
          "Five acres of dragon fruit cultivation. Zone boundaries are illustrative only.",
        xPercent: 68,
        yPercent: 58,
        schematicOnly: true,
        awaitingOwnerApproval: true,
      },
      {
        id: "spot-arrival",
        title: "Arrival",
        description: "Arrival and parking details will be published after the owner verifies them.",
        xPercent: 28,
        yPercent: 70,
        schematicOnly: true,
        awaitingOwnerApproval: true,
      },
    ],
    experiences: [
      {
        id: "exp-plantation-walk",
        title: "Plantation walk",
        description:
          "A guided walk through the dragon fruit plantation may be offered. This experience is listed only as a pending owner-approved item.",
        offered: false,
        awaitingOwnerApproval: true,
      },
    ],
    testimonials: [],
    content: {
      heroEyebrow: "V-Farms · Hyderabad",
      heroHeadline: "A Private Escape Into Nature.",
      heroLede:
        "A five-acre dragon fruit farm and exclusive five-room retreat near Hyderabad. One booking. The entire estate.",
      aboutExcerpt:
        "V-Farms is a private agricultural estate, not a conventional hotel. Guests reserve the whole property — the guest building, the plantation, and the quiet that comes with exclusivity.",
      farmStory:
        "Dragon fruit grows across these five acres. The guest building holds five distinct rooms, reserved together. The farm story, cultivation details and founder notes will be expanded here with owner-approved copy.",
      stayIntro:
        "An overnight stay is an exclusive occupation of V-Farms. All five rooms are included. Individual rooms are never sold separately.",
      eventIntro:
        "Private events occupy the entire estate. There is no public instant checkout. Every event begins as an enquiry and proceeds only after the owner issues and you accept a written quotation.",
      roomsNotice: "Five distinct rooms. One exclusive booking.",
    },
    contacts: [],
    audit: [],
    admins: [
      {
        id: "admin-owner",
        email: (adminEmail ?? "owner@v-farms.example").toLowerCase(),
        name: "Property owner",
        role: "owner",
        passwordHash: hashPassword(adminPassword ?? "change-me-now"),
        createdAt: now,
      },
    ],
    refunds: [],
  };
}
