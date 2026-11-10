-- Citizen incident lifecycle: additive schema only.
-- Existing incidents receive a non-guessable legacy reference before the
-- required/unique constraint is applied. No existing rows are deleted.

-- AlterTable
ALTER TABLE "EmergencyReport" ADD COLUMN     "accuracyM" DOUBLE PRECISION,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "locationCapturedAt" TIMESTAMP(3),
ADD COLUMN     "locationConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "originalDescription" TEXT,
ADD COLUMN     "reportSource" TEXT NOT NULL DEFAULT 'CITIZEN_FORM',
ADD COLUMN     "reportedByUserId" TEXT,
ADD COLUMN     "reporterType" TEXT NOT NULL DEFAULT 'GUEST',
ADD COLUMN     "vulnerablePersonsInfo" TEXT;

-- AlterTable
ALTER TABLE "FieldReport" ADD COLUMN     "actionTaken" TEXT,
ADD COLUMN     "arrivalAccuracyM" DOUBLE PRECISION,
ADD COLUMN     "checkInSource" TEXT,
ADD COLUMN     "distanceFromIncidentM" DOUBLE PRECISION,
ADD COLUMN     "peopleAssisted" INTEGER,
ADD COLUMN     "remainingProblems" TEXT,
ADD COLUMN     "reportType" TEXT NOT NULL DEFAULT 'SITUATION',
ADD COLUMN     "situationAfter" TEXT;

-- AlterTable: add nullable reference, backfill deterministically, then enforce.
ALTER TABLE "Incident" ADD COLUMN     "accuracyM" DOUBLE PRECISION,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignmentNotes" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "duplicateOfReference" TEXT,
ADD COLUMN     "duplicateSuspected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationCapturedAt" TIMESTAMP(3),
ADD COLUMN     "locationConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "referenceCode" TEXT,
ADD COLUMN     "reportSource" TEXT NOT NULL DEFAULT 'CITIZEN_FORM',
ADD COLUMN     "reporterType" TEXT NOT NULL DEFAULT 'GUEST',
ADD COLUMN     "resolutionDecision" TEXT,
ADD COLUMN     "resolutionReviewNotes" TEXT,
ADD COLUMN     "resolutionReviewedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionReviewedById" TEXT,
ADD COLUMN     "resolutionSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

UPDATE "Incident"
SET "referenceCode" = 'JG-LEGACY-' || UPPER(SUBSTRING(MD5("id"), 1, 12))
WHERE "referenceCode" IS NULL;

ALTER TABLE "Incident" ALTER COLUMN "referenceCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentEvent_eventType_createdAt_idx" ON "IncidentEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentEvent_actorUserId_idx" ON "IncidentEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "EmergencyReport_reportedByUserId_idx" ON "EmergencyReport"("reportedByUserId");

-- CreateIndex
CREATE INDEX "EmergencyReport_reportSource_createdAt_idx" ON "EmergencyReport"("reportSource", "createdAt");

-- CreateIndex
CREATE INDEX "FieldReport_incidentId_reportType_submittedAt_idx" ON "FieldReport"("incidentId", "reportType", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_referenceCode_key" ON "Incident"("referenceCode");

-- CreateIndex
CREATE INDEX "Incident_district_status_createdAt_idx" ON "Incident"("district", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_assignedToId_status_idx" ON "Incident"("assignedToId", "status");

-- AddForeignKey
ALTER TABLE "EmergencyReport" ADD CONSTRAINT "EmergencyReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolutionReviewedById_fkey" FOREIGN KEY ("resolutionReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
