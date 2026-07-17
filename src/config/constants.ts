/**
 * Single source of truth for platform-wide constants.
 * Per MASTER PROMPT §4.1: prefixes use the refined "JF*" scheme.
 * See DECISIONS.md (D-001) for the JT/JMS/JJM vs JF* conflict resolution.
 */

export const ID_PREFIXES = {
  TEMPLE: 'JFJT',
  MONK: 'JFMS',
  DHARAMSHALA: 'JFD',
  JAIN_CENTER: 'JFJC',
  JAIN_MEMBER: 'JFJM',
  NON_JAIN_MEMBER: 'JFNJM',
  STAFF: 'JFST',
  COMMUNITY_PAGE: 'JFCP',
  BOOKING: 'JFBK',
  DONATION: 'JFDN',
  RECEIPT: 'JFRC',
  EVENT: 'JFEV',
  TICKET: 'JFTK',
  VISITOR_ENTRY: 'JFVE',
  TOUR: 'JFTR',
  BHOJANSHALA: 'JFBJ',
  COMMUNITY_HALL: 'JFCH',
  TRUST_OFFICE: 'JFTO',
  SUPPORT_TICKET: 'JFSU',
  DEVICE: 'JFDV',
  OFFER: 'JFOF',
  NEWS: 'JFNW',
  MONK_GROUP: 'JFMSV',
} as const;

export type IdPrefixKey = keyof typeof ID_PREFIXES;

export const ID_SEQUENCE_START = 108;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TEMPLE_ADMIN: 'TEMPLE_ADMIN',
  DHARAMSHALA_ADMIN: 'DHARAMSHALA_ADMIN',
  JAIN_CENTER_ADMIN: 'JAIN_CENTER_ADMIN',
  MONK_ADMIN: 'MONK_ADMIN',
  STAFF: 'STAFF',
  SECURITY_GUARD: 'SECURITY_GUARD',
  EVENT_SCANNER: 'EVENT_SCANNER',
  PAGE_OWNER: 'PAGE_OWNER',
  MEMBER: 'MEMBER',
  NON_JAIN_MEMBER: 'NON_JAIN_MEMBER',
} as const;

export type RoleKey = keyof typeof ROLES;

export const PERMISSION_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT', 'DELETE'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * Module keys used by the permission engine. Kept flat/stringly-typed so
 * Super Admin can dynamically allocate modules without code changes.
 */
export const MODULES = {
  MEMBERS: 'MEMBERS',
  FAMILY: 'FAMILY',
  MONKS: 'MONKS',
  TEMPLES: 'TEMPLES',
  DHARAMSHALAS: 'DHARAMSHALAS',
  JAIN_CENTERS: 'JAIN_CENTERS',
  STAFF: 'STAFF',
  VISITORS: 'VISITORS',
  BOOKINGS: 'BOOKINGS',
  DONATIONS: 'DONATIONS',
  EVENTS: 'EVENTS',
  EVENTS_PAID: 'EVENTS_PAID',
  TICKETS: 'TICKETS',
  SEATING: 'SEATING',
  TOURS: 'TOURS',
  FEED: 'FEED',
  OFFERS: 'OFFERS',
  ADS: 'ADS',
  NEWS: 'NEWS',
  COMMUNITY_PAGES: 'COMMUNITY_PAGES',
  POLLS: 'POLLS',
  CALENDAR: 'CALENDAR',
  COUNTERS: 'COUNTERS',
  TRACKING: 'TRACKING',
  DEVICES: 'DEVICES',
  ALERTS: 'ALERTS',
  COMMUNICATION: 'COMMUNICATION',
  ANNOUNCEMENTS: 'ANNOUNCEMENTS',
  GALLERY: 'GALLERY',
  VOLUNTEERS: 'VOLUNTEERS',
  SUPPORT_TICKETS: 'SUPPORT_TICKETS',
  NOTIFICATIONS: 'NOTIFICATIONS',
  REPORTS: 'REPORTS',
  SETTINGS: 'SETTINGS',
  AUDIT_LOGS: 'AUDIT_LOGS',
  DASHBOARD: 'DASHBOARD',
  MASTER_DATA: 'MASTER_DATA',
} as const;

export type ModuleKey = keyof typeof MODULES;

/** Country -> default ISO currency code map (Currency Engine §4.6). Extend as needed. */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  India: 'INR',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  'United Arab Emirates': 'AED',
  Canada: 'CAD',
  Australia: 'AUD',
  Singapore: 'SGD',
  Kenya: 'KES',
  'South Africa': 'ZAR',
  Belgium: 'EUR',
  Germany: 'EUR',
  France: 'EUR',
  Nepal: 'NPR',
  Japan: 'JPY',
  'New Zealand': 'NZD',
};

export const DEFAULT_CURRENCY = 'INR';

export const SENIOR_CITIZEN_AGE_THRESHOLD = 59;

export const EVENT_PAID_TICKET_CONVENIENCE_FEE = 0; // spec: "NO convenience fee"

export const SCAN_WINDOW_HOURS_BEFORE_EVENT = 24;

export const NEWS_MAX_ACTIVE_DAYS = 7;

export const MAX_PREFERRED_TEMPLES = 5;
export const MAX_ADDITIONAL_TEMPLES_OR_MONKS = 10;
export const MAX_TRUSTEES = 20;
export const MAX_DHAJA_YEARS = 25;
export const MAX_EVENT_GALLERY_IMAGES = 25;
export const MAX_TEMPLE_GALLERY_IMAGES = 20;
export const MAX_DHARAMSHALA_GALLERY_IMAGES = 12;
