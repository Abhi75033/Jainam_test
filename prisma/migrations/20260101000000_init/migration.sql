-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('SUPER_ADMIN', 'TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN', 'STAFF', 'SECURITY_GUARD', 'EVENT_SCANNER', 'PAGE_OWNER', 'MEMBER', 'NON_JAIN_MEMBER');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'APPROVE', 'REJECT', 'DELETE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_OTP', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "TicketStatusGeneric" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('TEMPLE', 'JAIN_CENTER', 'DHARAMSHALA', 'BHOJANSHALA', 'COMMUNITY_HALL', 'TRUST_OFFICE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'UNDER_RENOVATION', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED');

-- CreateEnum
CREATE TYPE "TempleType" AS ENUM ('SHIKHAR_BADDHA', 'GHAR_DERASAR', 'JAIN_CENTRE');

-- CreateEnum
CREATE TYPE "OrgHistoryEventType" AS ENUM ('ESTABLISHMENT', 'RENOVATION');

-- CreateEnum
CREATE TYPE "DhajaStatus" AS ENUM ('FINALIZED', 'NOT_YET_FINALIZED', 'AVAILABLE', 'BOOKED', 'PENDING');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('ROOM', 'HALL', 'DORMITORY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MonkGender" AS ENUM ('SADHU', 'SADHVI');

-- CreateEnum
CREATE TYPE "MemberCategory" AS ENUM ('JAIN', 'NON_JAIN');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING_OTP', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "LinkTargetType" AS ENUM ('TEMPLE', 'MONK');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SERVICE', 'MARKETING');

-- CreateEnum
CREATE TYPE "MemberBadgeType" AS ENUM ('SENIOR_CITIZEN', 'VOLUNTEER', 'VERIFIED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "DurationType" AS ENUM ('HOURLY', 'HALF_DAY', 'FULL_DAY', 'MULTI_DAY', 'CUSTOM_SLOT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'PAYMENT_PENDING', 'PAYMENT_VERIFICATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('BOOKING', 'DONATION', 'TICKET');

-- CreateEnum
CREATE TYPE "DonationFlowType" AS ENUM ('ORG_MANUAL', 'PLATFORM_ONLINE', 'MUSIC_FESTIVAL');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RSVP_SALES_OPEN', 'LIVE', 'COMPLETED', 'GALLERY_UPLOADED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('CONFIRMED', 'WAITING_LIST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_SUCCESSFUL', 'TICKET_GENERATED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED_MANUAL', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SeatingMode" AS ENUM ('OPEN', 'RESERVED');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'BOOKED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('PAID_EVENT_REQUEST', 'EVENT_DELETE_REQUEST', 'CALENDAR_CORRECTION', 'INCORRECT_INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('DEPARTURE', 'ARRIVAL', 'DELAY', 'MANUAL_UPDATE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SOS', 'OFFLINE', 'ROUTE_DELAY', 'LOW_BATTERY');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING');

-- CreateEnum
CREATE TYPE "VisitorEntryType" AS ENUM ('MEMBER', 'NON_MEMBER', 'VEHICLE');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ONGOING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TourParticipantStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "TourAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'NOT_WELL');

-- CreateEnum
CREATE TYPE "VolunteerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeedPostType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AdSlot" AS ENUM ('TOP_BANNER', 'IN_FEED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PageMemberStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "id_sequences" (
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 107,

    CONSTRAINT "id_sequences_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "publicId" TEXT,
    "mobile" TEXT NOT NULL,
    "mobileVerifiedAt" TIMESTAMP(3),
    "whatsapp" TEXT,
    "whatsappVerifiedAt" TIMESTAMP(3),
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "photoUrl" TEXT,
    "primaryRoleKey" "RoleKey" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_OTP',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "lastLoginAt" TIMESTAMP(3),
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleKey" "RoleKey" NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "os" TEXT,
    "appVersion" TEXT,
    "ip" TEXT,
    "refreshTokenHash" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "mobile" TEXT NOT NULL,
    "deviceId" TEXT,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "flaggedSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "publicId" TEXT,
    "roleKey" "RoleKey",
    "organizationId" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "deviceInfo" JSONB,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_communities" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sub_communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gacchas" (
    "id" TEXT NOT NULL,
    "subCommunityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gacchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tithi_calendar_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tithi_calendar_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tithi_calendar_entries" (
    "id" TEXT NOT NULL,
    "calendarTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "gregorianDate" TIMESTAMP(3) NOT NULL,
    "tithiName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tithi_calendar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tithi_correction_tickets" (
    "id" TEXT NOT NULL,
    "raisedByOrgId" TEXT,
    "calendarTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "issue" TEXT NOT NULL,
    "status" "TicketStatusGeneric" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tithi_correction_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bhagwan_master" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bhagwan_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "feed_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "offer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_page_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "community_page_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sponsor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "staff_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_designations" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "staff_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "volunteer_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "donation_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "relationship_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_master" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "facility_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "counter_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_sub_types" (
    "id" TEXT NOT NULL,
    "counterTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "counter_sub_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tour_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "trustName" TEXT,
    "trustRegistrationNumber" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "communityId" TEXT,
    "subCommunityId" TEXT,
    "gacchaId" TEXT,
    "mulNayakBhagwanId" TEXT,
    "mulNayakImageUrl" TEXT,
    "muritCount" INTEGER,
    "templeType" "TempleType",
    "tithiCalendarTypeId" TEXT,
    "history" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "googleMapsLink" TEXT,
    "facilities" JSONB,
    "hasUpashray" BOOLEAN NOT NULL DEFAULT false,
    "hasEventHall" BOOLEAN NOT NULL DEFAULT false,
    "eventHallBookable" BOOLEAN NOT NULL DEFAULT false,
    "hasBhojanshala" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountEncrypted" TEXT,
    "bankIfsc" TEXT,
    "upiId" TEXT,
    "is80gEligible" BOOLEAN NOT NULL DEFAULT false,
    "csrEligible" BOOLEAN NOT NULL DEFAULT false,
    "donationQrUrl" TEXT,
    "disclaimerText" TEXT,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_gallery_images" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "organization_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT,
    "otpVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "organization_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_trustees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,

    CONSTRAINT "organization_trustees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_volunteers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "area" TEXT,

    CONSTRAINT "organization_volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_history_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "OrgHistoryEventType" NOT NULL,
    "eventDate" TIMESTAMP(3),
    "description" TEXT,
    "linkedMemberIds" JSONB,

    CONSTRAINT "organization_history_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dhaja_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "dhajaDate" TIMESTAMP(3),
    "descriptionEn" TEXT,
    "descriptionHi" TEXT,
    "linkedMemberIds" JSONB,
    "status" "DhajaStatus" NOT NULL DEFAULT 'NOT_YET_FINALIZED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dhaja_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "adminReply" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "organization_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_notices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organization_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_follows" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_social_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "organization_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathshala_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "contactMemberId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pathshala_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wings" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms_and_halls" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pricePerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amenities" JSONB,
    "images" JSONB,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rooms_and_halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monk_profiles" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "dikshaName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "gender" "MonkGender" NOT NULL,
    "dob" TIMESTAMP(3),
    "dobPlace" TEXT,
    "nameBeforeDiksha" TEXT,
    "bio" TEXT,
    "dikshaDate" TIMESTAMP(3),
    "dikshaPlace" TEXT,
    "dikshaGuruId" TEXT,
    "communityId" TEXT,
    "subCommunityId" TEXT,
    "gacchaId" TEXT,
    "currentTempleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "emergencyContact" JSONB,
    "groupId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "monk_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monk_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderMonkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "monk_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monk_follows" (
    "id" TEXT NOT NULL,
    "monkId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monk_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "category" "MemberCategory" NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "surname" TEXT,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(3),
    "nationality" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "panEncrypted" TEXT,
    "aadhaarEncrypted" TEXT,
    "aadhaarHash" TEXT,
    "maritalStatus" TEXT,
    "motherTongue" TEXT,
    "communityId" TEXT,
    "subCommunityId" TEXT,
    "gacchaId" TEXT,
    "tithiCalendarTypeId" TEXT,
    "mobile" TEXT NOT NULL,
    "mobileVerifiedAt" TIMESTAMP(3),
    "whatsapp" TEXT,
    "whatsappVerifiedAt" TIMESTAMP(3),
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "preferredCommunicationMethod" TEXT,
    "alternateContact" TEXT,
    "currentAddress" JSONB,
    "permanentAddress" JSONB,
    "sameAsPermanent" BOOLEAN NOT NULL DEFAULT false,
    "nativeVillage" TEXT,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "visitFrequency" TEXT,
    "favouriteOrganizationId" TEXT,
    "bloodGroup" TEXT,
    "disability" TEXT,
    "medicalNotes" TEXT,
    "emergencyContact" JSONB,
    "profession" TEXT,
    "isVolunteer" BOOLEAN NOT NULL DEFAULT false,
    "volunteerAreas" JSONB,
    "volunteerAvailability" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING_OTP',
    "isAutoCreated" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "profileCompletionPct" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_preferred_temples" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isFavourite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_preferred_temples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_additional_links" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "targetType" "LinkTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_additional_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_govt_documents" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumberEncrypted" TEXT NOT NULL,
    "imageUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_govt_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_interests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "interest" TEXT NOT NULL,

    CONSTRAINT "member_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "primaryMemberId" TEXT NOT NULL,
    "relatedMemberId" TEXT NOT NULL,
    "relationshipTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_notification_preferences" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "member_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_privacy_settings" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "showMobile" BOOLEAN NOT NULL DEFAULT false,
    "showAddress" BOOLEAN NOT NULL DEFAULT false,
    "allowContact" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "member_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_consents" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardianName" TEXT,

    CONSTRAINT "member_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_badges" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "badge" "MemberBadgeType" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_activity_aggregates" (
    "memberId" TEXT NOT NULL,
    "eventsAttended" INTEGER NOT NULL DEFAULT 0,
    "donationsCount" INTEGER NOT NULL DEFAULT 0,
    "bookingsCount" INTEGER NOT NULL DEFAULT 0,
    "sevaCount" INTEGER NOT NULL DEFAULT 0,
    "toursCount" INTEGER NOT NULL DEFAULT 0,
    "certificatesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_activity_aggregates_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "bulk_import_batches" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bulk_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "joiningDate" TIMESTAMP(3),
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "aadhaarEncrypted" TEXT,
    "panEncrypted" TEXT,
    "addresses" JSONB,
    "emergencyMedicalInfo" JSONB,
    "qrToken" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_documents" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumberEncrypted" TEXT NOT NULL,
    "imageUrl" TEXT,
    "expiryDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "replacesDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_module_permissions" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "actions" JSONB NOT NULL,

    CONSTRAINT "staff_module_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "location" JSONB,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_activity_logs" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "device" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB,
    "termsAndConditions" TEXT,
    "guidelines" TEXT,
    "cancellationPolicy" TEXT,
    "type" "BookingType" NOT NULL,
    "durationType" "DurationType" NOT NULL,
    "capacityMaxBookings" INTEGER,
    "capacityMaxPeople" INTEGER,
    "availabilityConfig" JSONB,
    "chargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentType" TEXT,
    "bankDetails" JSONB,
    "paymentWindowHours" INTEGER NOT NULL DEFAULT 24,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_blackout_dates" (
    "id" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "booking_blackout_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_internal_reservations" (
    "id" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_internal_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bookingItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3),
    "slot" TEXT,
    "peopleCount" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "BookingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "paymentWindowExpiresAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentProofUrl" TEXT,
    "paymentNotes" TEXT,
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "organizationId" TEXT,
    "memberId" TEXT,
    "bookingId" TEXT,
    "donationId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_campaign_configs" (
    "id" TEXT NOT NULL,
    "type" "DonationFlowType" NOT NULL,
    "message" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_campaign_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "flowType" "DonationFlowType" NOT NULL,
    "organizationId" TEXT,
    "memberId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "transactionReference" TEXT,
    "proofUrl" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paymentGatewayRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_category_splits" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "donationCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "donation_category_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "venue" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB,
    "visibilityConfig" JSONB,
    "rsvpCapacity" INTEGER,
    "waitingListEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attendeeCount" INTEGER NOT NULL DEFAULT 1,
    "status" "RsvpStatus" NOT NULL DEFAULT 'CONFIRMED',
    "waitingListPosition" INTEGER,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "saleStartAt" TIMESTAMP(3),
    "saleEndAt" TIMESTAMP(3),
    "visibilityConfig" JSONB,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "ticketCategoryId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bookingGroupId" TEXT,
    "buyerMemberId" TEXT NOT NULL,
    "attendeeMemberId" TEXT,
    "attendeeName" TEXT,
    "attendeeGender" TEXT,
    "attendeeAge" INTEGER,
    "seatId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "qrToken" TEXT NOT NULL,
    "paymentRef" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "scanHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seating_sections" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "SeatingMode" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "seating_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seating_rows" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "seating_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lockToken" TEXT,
    "lockExpiresAt" TIMESTAMP(3),

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_gallery_images" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_video_links" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "event_video_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_feedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "SupportTicketType" NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" "TicketStatusGeneric" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "monkId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GPS_TRACKER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_records" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "operator" TEXT,
    "msisdn" TEXT,
    "validityStart" TIMESTAMP(3),
    "validityExpiry" TIMESTAMP(3),

    CONSTRAINT "sim_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monkId" TEXT NOT NULL,
    "journeyDate" TIMESTAMP(3) NOT NULL,
    "stops" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journeys" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "monkId" TEXT NOT NULL,
    "currentStopIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_events" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "type" "JourneyEventType" NOT NULL,
    "templeId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,

    CONSTRAINT "journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "battery" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "monkId" TEXT,
    "deviceId" TEXT,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_entries" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryType" "VisitorEntryType" NOT NULL,
    "memberId" TEXT,
    "visitorName" TEXT,
    "visitorMobile" TEXT,
    "purpose" TEXT,
    "photoUrl" TEXT,
    "vehicleNumber" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',

    CONSTRAINT "visitor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "jatraTarget" INTEGER NOT NULL,
    "targetLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryMonkId" TEXT NOT NULL,
    "monkGroupId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_sponsors" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberId" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "amount" DECIMAL(12,2),
    "contact" TEXT,

    CONSTRAINT "tour_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_participants" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "parentMemberId" TEXT,
    "status" "TourParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_medical_forms" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "conditions" TEXT,
    "medications" TEXT,
    "emergencyContact" JSONB,
    "doctorContact" JSONB,
    "specialInstructions" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_medical_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_accommodation_locations" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tour_accommodation_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_rooms" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "tour_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_room_assignments" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "tourRoomId" TEXT,
    "roomOrHallId" TEXT,
    "checkInDate" TIMESTAMP(3),
    "checkOutDate" TIMESTAMP(3),

    CONSTRAINT "tour_room_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_room_change_logs" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "toRoomId" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_room_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_daily_jatra_counts" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "cumulativeCount" INTEGER NOT NULL,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_daily_jatra_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_milestones" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "milestonePct" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certificateUrl" TEXT,

    CONSTRAINT "tour_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_attendance" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "TourAttendanceStatus" NOT NULL,

    CONSTRAINT "tour_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_communications" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_daily_schedules" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scheduleText" TEXT NOT NULL,

    CONSTRAINT "tour_daily_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "details" TEXT,
    "areaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "volunteer_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_applications" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "VolunteerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "communityPageId" TEXT,
    "authorUserId" TEXT,
    "type" "FeedPostType" NOT NULL DEFAULT 'MANUAL',
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "images" JSONB,
    "videoUrl" TEXT,
    "pdfUrl" TEXT,
    "externalLink" TEXT,
    "categoryId" TEXT,
    "visibilityConfig" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "feedPostId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "bannerUrl" TEXT NOT NULL,
    "targetLink" TEXT,
    "slot" "AdSlot" NOT NULL,
    "targeting" JSONB,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLogoUrl" TEXT,
    "bannerUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "contact" JSONB,
    "links" JSONB,
    "visibilityConfig" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_saves" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "bottomImageUrl" TEXT,
    "links" JSONB,
    "categoryId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_bookmarks" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_pages" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "about" TEXT,
    "categoryId" TEXT,
    "contacts" JSONB,
    "socialLinks" JSONB,
    "visibilityConfig" JSONB,
    "joinApprovalMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "subscriptionPlan" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "community_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_page_owners" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "community_page_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_page_members" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "PageMemberStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_page_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_communications" (
    "id" TEXT NOT NULL,
    "fromOrgId" TEXT NOT NULL,
    "toOrgId" TEXT,
    "message" TEXT NOT NULL,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibilityConfig" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_albums" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gallery_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_images" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_counters" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "counterTypeId" TEXT NOT NULL,
    "subTypeId" TEXT,
    "count" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_reset_logs" (
    "id" TEXT NOT NULL,
    "memberCounterId" TEXT NOT NULL,
    "previousCount" BIGINT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counter_reset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "alert_thresholds" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "alert_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_rating_prompts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasRated" BOOLEAN NOT NULL DEFAULT false,
    "lastPromptAt" TIMESTAMP(3),

    CONSTRAINT "app_rating_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_content" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,

    CONSTRAINT "help_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_module_action_key" ON "role_permissions"("roleId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_organizationId_module_acti_key" ON "user_permission_overrides"("userId", "organizationId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_userId_organizationId_key" ON "user_organizations"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_deviceId_key" ON "user_devices"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "login_history_mobile_idx" ON "login_history"("mobile");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_module_action_idx" ON "audit_logs"("module", "action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "communities_name_key" ON "communities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sub_communities_communityId_name_key" ON "sub_communities"("communityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "gacchas_subCommunityId_name_key" ON "gacchas"("subCommunityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tithi_calendar_types_name_key" ON "tithi_calendar_types"("name");

-- CreateIndex
CREATE INDEX "tithi_calendar_entries_calendarTypeId_year_idx" ON "tithi_calendar_entries"("calendarTypeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "tithi_calendar_entries_calendarTypeId_gregorianDate_key" ON "tithi_calendar_entries"("calendarTypeId", "gregorianDate");

-- CreateIndex
CREATE UNIQUE INDEX "bhagwan_master_name_key" ON "bhagwan_master"("name");

-- CreateIndex
CREATE UNIQUE INDEX "booking_categories_name_key" ON "booking_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_name_key" ON "event_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "feed_categories_name_key" ON "feed_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "offer_categories_name_key" ON "offer_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_name_key" ON "news_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "community_page_categories_name_key" ON "community_page_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_categories_name_key" ON "sponsor_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_departments_name_key" ON "staff_departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_designations_departmentId_name_key" ON "staff_designations"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_areas_name_key" ON "volunteer_areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "donation_categories_name_key" ON "donation_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_types_name_key" ON "relationship_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "facility_master_name_key" ON "facility_master"("name");

-- CreateIndex
CREATE UNIQUE INDEX "counter_types_name_key" ON "counter_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "counter_sub_types_counterTypeId_name_key" ON "counter_sub_types"("counterTypeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_name_key" ON "tour_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_publicId_key" ON "organizations"("publicId");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_lat_lng_idx" ON "organizations"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "dhaja_records_organizationId_year_key" ON "dhaja_records"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "organization_reviews_organizationId_memberId_key" ON "organization_reviews"("organizationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_follows_organizationId_memberId_key" ON "organization_follows"("organizationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "monk_profiles_publicId_key" ON "monk_profiles"("publicId");

-- CreateIndex
CREATE INDEX "monk_profiles_groupId_idx" ON "monk_profiles"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "monk_follows_monkId_memberId_key" ON "monk_follows"("monkId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_key" ON "members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "members_publicId_key" ON "members"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "members_aadhaarHash_key" ON "members"("aadhaarHash");

-- CreateIndex
CREATE UNIQUE INDEX "members_mobile_key" ON "members"("mobile");

-- CreateIndex
CREATE INDEX "members_category_idx" ON "members"("category");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "members_currentLat_currentLng_idx" ON "members"("currentLat", "currentLng");

-- CreateIndex
CREATE UNIQUE INDEX "member_preferred_temples_memberId_organizationId_key" ON "member_preferred_temples"("memberId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "member_additional_links_memberId_targetType_targetId_key" ON "member_additional_links"("memberId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "member_interests_memberId_interest_key" ON "member_interests"("memberId", "interest");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_primaryMemberId_relatedMemberId_key" ON "family_members"("primaryMemberId", "relatedMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "member_notification_preferences_memberId_channel_category_key" ON "member_notification_preferences"("memberId", "channel", "category");

-- CreateIndex
CREATE UNIQUE INDEX "member_privacy_settings_memberId_key" ON "member_privacy_settings"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "member_badges_memberId_badge_key" ON "member_badges"("memberId", "badge");

-- CreateIndex
CREATE UNIQUE INDEX "staff_publicId_key" ON "staff"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_memberId_key" ON "staff"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_qrToken_key" ON "staff"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "staff_module_permissions_staffId_module_key" ON "staff_module_permissions"("staffId", "module");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_checkInAt_idx" ON "staff_attendance"("staffId", "checkInAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_blackout_dates_bookingItemId_date_key" ON "booking_blackout_dates"("bookingItemId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_publicId_key" ON "bookings"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");

-- CreateIndex
CREATE INDEX "bookings_organizationId_status_idx" ON "bookings"("organizationId", "status");

-- CreateIndex
CREATE INDEX "bookings_memberId_idx" ON "bookings"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_publicId_key" ON "receipts"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_bookingId_key" ON "receipts"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_donationId_key" ON "receipts"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "donation_campaign_configs_type_key" ON "donation_campaign_configs"("type");

-- CreateIndex
CREATE UNIQUE INDEX "donations_publicId_key" ON "donations"("publicId");

-- CreateIndex
CREATE INDEX "donations_organizationId_status_idx" ON "donations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "donations_memberId_idx" ON "donations"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "events_publicId_key" ON "events"("publicId");

-- CreateIndex
CREATE INDEX "events_organizationId_status_idx" ON "events"("organizationId", "status");

-- CreateIndex
CREATE INDEX "events_lat_lng_idx" ON "events"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_eventId_memberId_key" ON "event_rsvps"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_publicId_key" ON "tickets"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_seatId_key" ON "tickets"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qrToken_key" ON "tickets"("qrToken");

-- CreateIndex
CREATE INDEX "tickets_eventId_status_idx" ON "tickets"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seats_rowId_label_key" ON "seats"("rowId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "event_feedback_eventId_memberId_key" ON "event_feedback"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_publicId_key" ON "support_tickets"("publicId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_publicId_key" ON "devices"("publicId");

-- CreateIndex
CREATE INDEX "location_pings_deviceId_timestamp_idx" ON "location_pings"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_isResolved_severity_idx" ON "alerts"("isResolved", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_entries_publicId_key" ON "visitor_entries"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_entries_idempotencyKey_key" ON "visitor_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "visitor_entries_organizationId_checkInAt_idx" ON "visitor_entries"("organizationId", "checkInAt");

-- CreateIndex
CREATE INDEX "visitor_entries_vehicleNumber_idx" ON "visitor_entries"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tours_publicId_key" ON "tours"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_participants_tourId_memberId_key" ON "tour_participants"("tourId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_medical_forms_participantId_key" ON "tour_medical_forms"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_daily_jatra_counts_participantId_date_key" ON "tour_daily_jatra_counts"("participantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tour_milestones_participantId_milestonePct_key" ON "tour_milestones"("participantId", "milestonePct");

-- CreateIndex
CREATE UNIQUE INDEX "tour_attendance_participantId_date_key" ON "tour_attendance"("participantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tour_daily_schedules_tourId_date_key" ON "tour_daily_schedules"("tourId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_applications_opportunityId_memberId_key" ON "volunteer_applications"("opportunityId", "memberId");

-- CreateIndex
CREATE INDEX "feed_posts_organizationId_isActive_idx" ON "feed_posts"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "polls_feedPostId_key" ON "polls"("feedPostId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_memberId_key" ON "poll_votes"("pollId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_publicId_key" ON "offers"("publicId");

-- CreateIndex
CREATE INDEX "offers_startAt_endAt_idx" ON "offers"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "offer_saves_offerId_memberId_key" ON "offer_saves"("offerId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "news_publicId_key" ON "news"("publicId");

-- CreateIndex
CREATE INDEX "news_isArchived_publishedAt_idx" ON "news"("isArchived", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "news_bookmarks_newsId_memberId_key" ON "news_bookmarks"("newsId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "community_pages_publicId_key" ON "community_pages"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "community_page_owners_pageId_userId_key" ON "community_page_owners"("pageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_page_members_pageId_memberId_key" ON "community_page_members"("pageId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "member_counters_memberId_counterTypeId_subTypeId_key" ON "member_counters"("memberId", "counterTypeId", "subTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_key" ON "notification_templates"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "notification_logs_recipientUserId_createdAt_idx" ON "notification_logs"("recipientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "alert_thresholds_type_key" ON "alert_thresholds"("type");

-- CreateIndex
CREATE UNIQUE INDEX "app_rating_prompts_userId_key" ON "app_rating_prompts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "help_content_section_key" ON "help_content"("section");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_communities" ADD CONSTRAINT "sub_communities_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gacchas" ADD CONSTRAINT "gacchas_subCommunityId_fkey" FOREIGN KEY ("subCommunityId") REFERENCES "sub_communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tithi_calendar_entries" ADD CONSTRAINT "tithi_calendar_entries_calendarTypeId_fkey" FOREIGN KEY ("calendarTypeId") REFERENCES "tithi_calendar_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tithi_correction_tickets" ADD CONSTRAINT "tithi_correction_tickets_raisedByOrgId_fkey" FOREIGN KEY ("raisedByOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tithi_correction_tickets" ADD CONSTRAINT "tithi_correction_tickets_calendarTypeId_fkey" FOREIGN KEY ("calendarTypeId") REFERENCES "tithi_calendar_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_designations" ADD CONSTRAINT "staff_designations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "staff_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sub_types" ADD CONSTRAINT "counter_sub_types_counterTypeId_fkey" FOREIGN KEY ("counterTypeId") REFERENCES "counter_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_subCommunityId_fkey" FOREIGN KEY ("subCommunityId") REFERENCES "sub_communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_gacchaId_fkey" FOREIGN KEY ("gacchaId") REFERENCES "gacchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_mulNayakBhagwanId_fkey" FOREIGN KEY ("mulNayakBhagwanId") REFERENCES "bhagwan_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tithiCalendarTypeId_fkey" FOREIGN KEY ("tithiCalendarTypeId") REFERENCES "tithi_calendar_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_gallery_images" ADD CONSTRAINT "organization_gallery_images_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_contacts" ADD CONSTRAINT "organization_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_contacts" ADD CONSTRAINT "organization_contacts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_trustees" ADD CONSTRAINT "organization_trustees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_trustees" ADD CONSTRAINT "organization_trustees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_volunteers" ADD CONSTRAINT "organization_volunteers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_volunteers" ADD CONSTRAINT "organization_volunteers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_history_events" ADD CONSTRAINT "organization_history_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dhaja_records" ADD CONSTRAINT "dhaja_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_reviews" ADD CONSTRAINT "organization_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_reviews" ADD CONSTRAINT "organization_reviews_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_notices" ADD CONSTRAINT "organization_notices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_follows" ADD CONSTRAINT "organization_follows_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_social_links" ADD CONSTRAINT "organization_social_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathshala_centers" ADD CONSTRAINT "pathshala_centers_contactMemberId_fkey" FOREIGN KEY ("contactMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wings" ADD CONSTRAINT "wings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms_and_halls" ADD CONSTRAINT "rooms_and_halls_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "wings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_dikshaGuruId_fkey" FOREIGN KEY ("dikshaGuruId") REFERENCES "monk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_subCommunityId_fkey" FOREIGN KEY ("subCommunityId") REFERENCES "sub_communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_gacchaId_fkey" FOREIGN KEY ("gacchaId") REFERENCES "gacchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_currentTempleId_fkey" FOREIGN KEY ("currentTempleId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_profiles" ADD CONSTRAINT "monk_profiles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "monk_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_follows" ADD CONSTRAINT "monk_follows_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monk_follows" ADD CONSTRAINT "monk_follows_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_subCommunityId_fkey" FOREIGN KEY ("subCommunityId") REFERENCES "sub_communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_gacchaId_fkey" FOREIGN KEY ("gacchaId") REFERENCES "gacchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_tithiCalendarTypeId_fkey" FOREIGN KEY ("tithiCalendarTypeId") REFERENCES "tithi_calendar_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_preferred_temples" ADD CONSTRAINT "member_preferred_temples_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_additional_links" ADD CONSTRAINT "member_additional_links_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_govt_documents" ADD CONSTRAINT "member_govt_documents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_interests" ADD CONSTRAINT "member_interests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_primaryMemberId_fkey" FOREIGN KEY ("primaryMemberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_relatedMemberId_fkey" FOREIGN KEY ("relatedMemberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES "relationship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notification_preferences" ADD CONSTRAINT "member_notification_preferences_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_privacy_settings" ADD CONSTRAINT "member_privacy_settings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_consents" ADD CONSTRAINT "member_consents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_badges" ADD CONSTRAINT "member_badges_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_activity_aggregates" ADD CONSTRAINT "member_activity_aggregates_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "staff_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "staff_designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_module_permissions" ADD CONSTRAINT "staff_module_permissions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_activity_logs" ADD CONSTRAINT "staff_activity_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "booking_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_blackout_dates" ADD CONSTRAINT "booking_blackout_dates_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_internal_reservations" ADD CONSTRAINT "booking_internal_reservations_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "booking_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_category_splits" ADD CONSTRAINT "donation_category_splits_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_category_splits" ADD CONSTRAINT "donation_category_splits_donationCategoryId_fkey" FOREIGN KEY ("donationCategoryId") REFERENCES "donation_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticketCategoryId_fkey" FOREIGN KEY ("ticketCategoryId") REFERENCES "ticket_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_buyerMemberId_fkey" FOREIGN KEY ("buyerMemberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_attendeeMemberId_fkey" FOREIGN KEY ("attendeeMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seating_sections" ADD CONSTRAINT "seating_sections_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seating_rows" ADD CONSTRAINT "seating_rows_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "seating_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "seating_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_gallery_images" ADD CONSTRAINT "event_gallery_images_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_video_links" ADD CONSTRAINT "event_video_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_records" ADD CONSTRAINT "sim_records_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_entries" ADD CONSTRAINT "visitor_entries_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "tour_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_primaryMonkId_fkey" FOREIGN KEY ("primaryMonkId") REFERENCES "monk_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_monkGroupId_fkey" FOREIGN KEY ("monkGroupId") REFERENCES "monk_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_sponsors" ADD CONSTRAINT "tour_sponsors_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_sponsors" ADD CONSTRAINT "tour_sponsors_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "sponsor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_participants" ADD CONSTRAINT "tour_participants_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_participants" ADD CONSTRAINT "tour_participants_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_participants" ADD CONSTRAINT "tour_participants_parentMemberId_fkey" FOREIGN KEY ("parentMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_medical_forms" ADD CONSTRAINT "tour_medical_forms_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_accommodation_locations" ADD CONSTRAINT "tour_accommodation_locations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_rooms" ADD CONSTRAINT "tour_rooms_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "tour_accommodation_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_room_assignments" ADD CONSTRAINT "tour_room_assignments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_room_assignments" ADD CONSTRAINT "tour_room_assignments_tourRoomId_fkey" FOREIGN KEY ("tourRoomId") REFERENCES "tour_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_room_assignments" ADD CONSTRAINT "tour_room_assignments_roomOrHallId_fkey" FOREIGN KEY ("roomOrHallId") REFERENCES "rooms_and_halls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_room_change_logs" ADD CONSTRAINT "tour_room_change_logs_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_daily_jatra_counts" ADD CONSTRAINT "tour_daily_jatra_counts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_milestones" ADD CONSTRAINT "tour_milestones_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_attendance" ADD CONSTRAINT "tour_attendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tour_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_communications" ADD CONSTRAINT "tour_communications_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_daily_schedules" ADD CONSTRAINT "tour_daily_schedules_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_opportunities" ADD CONSTRAINT "volunteer_opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_opportunities" ADD CONSTRAINT "volunteer_opportunities_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "volunteer_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "volunteer_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_communityPageId_fkey" FOREIGN KEY ("communityPageId") REFERENCES "community_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "feed_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_feedPostId_fkey" FOREIGN KEY ("feedPostId") REFERENCES "feed_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "offer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_saves" ADD CONSTRAINT "offer_saves_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_saves" ADD CONSTRAINT "offer_saves_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_bookmarks" ADD CONSTRAINT "news_bookmarks_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_bookmarks" ADD CONSTRAINT "news_bookmarks_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_pages" ADD CONSTRAINT "community_pages_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "community_page_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_page_owners" ADD CONSTRAINT "community_page_owners_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "community_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_page_members" ADD CONSTRAINT "community_page_members_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "community_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_page_members" ADD CONSTRAINT "community_page_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_communications" ADD CONSTRAINT "org_communications_fromOrgId_fkey" FOREIGN KEY ("fromOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_communications" ADD CONSTRAINT "org_communications_toOrgId_fkey" FOREIGN KEY ("toOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "gallery_albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_counters" ADD CONSTRAINT "member_counters_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_counters" ADD CONSTRAINT "member_counters_counterTypeId_fkey" FOREIGN KEY ("counterTypeId") REFERENCES "counter_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_counters" ADD CONSTRAINT "member_counters_subTypeId_fkey" FOREIGN KEY ("subTypeId") REFERENCES "counter_sub_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_reset_logs" ADD CONSTRAINT "counter_reset_logs_memberCounterId_fkey" FOREIGN KEY ("memberCounterId") REFERENCES "member_counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

