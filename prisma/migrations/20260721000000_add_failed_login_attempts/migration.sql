-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "priceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pricingModel" TEXT NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "diff" JSONB,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "bhagwan_master" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Others';

-- AlterTable
ALTER TABLE "feed_posts" ADD COLUMN     "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "monk_groups" ADD COLUMN     "groupNumber" TEXT,
ADD COLUMN     "jainMembers" JSONB,
ADD COLUMN     "nonJainMembers" JSONB,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "monk_profiles" ADD COLUMN     "assignedAdminId" TEXT,
ADD COLUMN     "chaturmasHistory" JSONB,
ADD COLUMN     "health" JSONB,
ADD COLUMN     "languages" JSONB,
ADD COLUMN     "media" JSONB,
ADD COLUMN     "nirvanaDate" TIMESTAMP(3),
ADD COLUMN     "nirvanaPlace" TEXT,
ADD COLUMN     "preDikshaFather" JSONB,
ADD COLUMN     "preDikshaLocation" JSONB,
ADD COLUMN     "preDikshaMother" JSONB,
ADD COLUMN     "recognitions" JSONB,
ADD COLUMN     "routine" JSONB,
ADD COLUMN     "sanghContacts" JSONB,
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "siblings" JSONB,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "tapasya" JSONB,
ADD COLUMN     "timeline" JSONB,
ADD COLUMN     "tracking" JSONB,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "staffEarlyExitBefore" TEXT,
ADD COLUMN     "staffLateArrivalAfter" TEXT,
ADD COLUMN     "staffWorkingHoursEnd" TEXT,
ADD COLUMN     "staffWorkingHoursStart" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "category" TEXT,
ADD COLUMN     "categorySpecify" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "permanentAddress" JSONB,
ADD COLUMN     "reportingTo" TEXT;

-- AlterTable
ALTER TABLE "staff_attendance" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "workingHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockoutUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visitor_entries" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "lastModifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "numberOfVisitors" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "offlineTempId" TEXT,
ADD COLUMN     "passengerMemberIds" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "vehicleType" TEXT,
ADD COLUMN     "visitDuration" INTEGER,
ADD COLUMN     "visitType" TEXT,
ADD COLUMN     "visitorAddress" TEXT,
ADD COLUMN     "visitorArea" TEXT,
ADD COLUMN     "visitorCategory" TEXT,
ADD COLUMN     "visitorCity" TEXT,
ADD COLUMN     "visitorPincode" TEXT,
ADD COLUMN     "visitorState" TEXT;

-- CreateTable
CREATE TABLE "feed_post_saves" (
    "id" TEXT NOT NULL,
    "feedPostId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_post_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_faqs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "org_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chaturmas_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "monkId" TEXT,
    "monkName" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "contactPerson" TEXT,
    "contactMobile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chaturmas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Application',
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incorrect_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "reporterId" TEXT,
    "reporterName" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "flaggedField" TEXT NOT NULL,
    "currentValue" TEXT,
    "correctedValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incorrect_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "redirectUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deviceType" TEXT NOT NULL DEFAULT 'MOBILE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "app_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_home_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL DEFAULT 'Carousel',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "app_home_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "duration" TEXT NOT NULL DEFAULT 'Monthly',
    "features" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_tracking_entries" (
    "id" TEXT NOT NULL,
    "monkId" TEXT,
    "monkPublicId" TEXT,
    "monkName" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "notes" TEXT,
    "loggedById" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manual_tracking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feed_post_saves_feedPostId_memberId_key" ON "feed_post_saves"("feedPostId", "memberId");

-- CreateIndex
CREATE INDEX "org_faqs_organizationId_idx" ON "org_faqs"("organizationId");

-- CreateIndex
CREATE INDEX "chaturmas_plans_organizationId_idx" ON "chaturmas_plans"("organizationId");

-- CreateIndex
CREATE INDEX "user_feedback_organizationId_idx" ON "user_feedback"("organizationId");

-- CreateIndex
CREATE INDEX "incorrect_reports_organizationId_idx" ON "incorrect_reports"("organizationId");

-- CreateIndex
CREATE INDEX "manual_tracking_entries_monkId_idx" ON "manual_tracking_entries"("monkId");

-- CreateIndex
CREATE UNIQUE INDEX "monk_groups_groupNumber_key" ON "monk_groups"("groupNumber");

-- AddForeignKey
ALTER TABLE "feed_post_saves" ADD CONSTRAINT "feed_post_saves_feedPostId_fkey" FOREIGN KEY ("feedPostId") REFERENCES "feed_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_saves" ADD CONSTRAINT "feed_post_saves_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_faqs" ADD CONSTRAINT "org_faqs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chaturmas_plans" ADD CONSTRAINT "chaturmas_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chaturmas_plans" ADD CONSTRAINT "chaturmas_plans_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incorrect_reports" ADD CONSTRAINT "incorrect_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incorrect_reports" ADD CONSTRAINT "incorrect_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_tracking_entries" ADD CONSTRAINT "manual_tracking_entries_monkId_fkey" FOREIGN KEY ("monkId") REFERENCES "monk_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

