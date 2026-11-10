-- AlterTable
ALTER TABLE "EmergencyReport" ADD COLUMN     "aiClassification" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "corroborationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "district" TEXT NOT NULL DEFAULT 'Mumbai Suburban',
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "requiredAssistance" TEXT,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'Maharashtra',
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "vulnerablePersons" TEXT;

-- AlterTable
ALTER TABLE "FieldReport" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "ReportVerificationAudit" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "note" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVerificationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAssessment" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "hazardType" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "areaKm2" DOUBLE PRECISION,
    "populationExposed" INTEGER,
    "populationDensity" DOUBLE PRECISION,
    "childrenExposed" INTEGER,
    "elderlyExposed" INTEGER,
    "hospitalsExposed" INTEGER,
    "schoolsExposed" INTEGER,
    "roadsExposed" INTEGER,
    "confidence" TEXT NOT NULL,
    "precision" TEXT NOT NULL,
    "isSimulation" BOOLEAN NOT NULL DEFAULT false,
    "populationSource" TEXT,
    "dataYear" INTEGER,
    "limitations" TEXT,
    "evidence" TEXT,
    "geometry" TEXT,
    "sourceAlertId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookActivation" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "hazardType" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerSummary" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activatedById" TEXT,
    "activatedByName" TEXT,
    "isSimulation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookTask" (
    "id" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "completedById" TEXT,
    "completedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookAudit" (
    "id" TEXT NOT NULL,
    "activationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAcknowledgement" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "sourceAlertId" TEXT,
    "userId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "response" TEXT NOT NULL,
    "note" TEXT,
    "incidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatelliteLayer" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sourceOrganisation" TEXT NOT NULL,
    "observationDate" TIMESTAMP(3) NOT NULL,
    "processedDate" TIMESTAMP(3) NOT NULL,
    "productReference" TEXT NOT NULL,
    "geometryPrecision" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_IMPORT',
    "geojson" TEXT NOT NULL,
    "featureCount" INTEGER NOT NULL,
    "bbox" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "isSimulation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatelliteLayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportVerificationAudit_reportId_createdAt_idx" ON "ReportVerificationAudit"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactAssessment_cacheKey_key" ON "ImpactAssessment"("cacheKey");

-- CreateIndex
CREATE INDEX "ImpactAssessment_district_createdAt_idx" ON "ImpactAssessment"("district", "createdAt");

-- CreateIndex
CREATE INDEX "ImpactAssessment_hazardType_createdAt_idx" ON "ImpactAssessment"("hazardType", "createdAt");

-- CreateIndex
CREATE INDEX "PlaybookActivation_district_status_createdAt_idx" ON "PlaybookActivation"("district", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PlaybookTask_activationId_role_status_idx" ON "PlaybookTask"("activationId", "role", "status");

-- CreateIndex
CREATE INDEX "PlaybookAudit_activationId_createdAt_idx" ON "PlaybookAudit"("activationId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertAcknowledgement_district_response_createdAt_idx" ON "AlertAcknowledgement"("district", "response", "createdAt");

-- CreateIndex
CREATE INDEX "AlertAcknowledgement_alertId_idx" ON "AlertAcknowledgement"("alertId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertAcknowledgement_userId_alertId_response_key" ON "AlertAcknowledgement"("userId", "alertId", "response");

-- CreateIndex
CREATE INDEX "SatelliteLayer_district_createdAt_idx" ON "SatelliteLayer"("district", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyReport_idempotencyKey_key" ON "EmergencyReport"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmergencyReport_verificationStatus_createdAt_idx" ON "EmergencyReport"("verificationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyReport_category_createdAt_idx" ON "EmergencyReport"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FieldReport_idempotencyKey_key" ON "FieldReport"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FieldReport_incidentId_submittedAt_idx" ON "FieldReport"("incidentId", "submittedAt");

-- AddForeignKey
ALTER TABLE "ReportVerificationAudit" ADD CONSTRAINT "ReportVerificationAudit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EmergencyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookTask" ADD CONSTRAINT "PlaybookTask_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PlaybookActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookAudit" ADD CONSTRAINT "PlaybookAudit_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "PlaybookActivation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

