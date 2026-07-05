export type GeoLevel = 'AREA' | 'CITY' | 'DISTRICT' | 'STATE' | 'COUNTRY' | 'GLOBAL';

export interface GeoTarget {
  levels?: GeoLevel[]; // e.g. ['CITY','STATE'] — explicit level match on member profile address
  gpsRadiusKm?: number; // progressive expansion radius from a center point
  centerLat?: number;
  centerLng?: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface CommunityTarget {
  communityIds?: string[];
  subCommunityIds?: string[];
  gacchaIds?: string[];
}

export interface VisibilityConfig {
  isPublic?: boolean; // Public content bypasses community/geo restrictions entirely
  followedEntityIds?: { organizationIds?: string[]; monkIds?: string[] }; // Priority 1
  community?: CommunityTarget; // Priority 2
  geo?: GeoTarget; // Priority 3
  linkedMemberIds?: string[]; // explicit allow-list (e.g. tour participants)
}

/** Progressive expansion rings used by the Community Feed (§5.13) and general geo eligibility (§4.2). */
export const GEO_EXPANSION_RINGS_KM = [5, 10, 20] as const;
