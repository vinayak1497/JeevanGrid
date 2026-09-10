-- AlterTable: extend DisasterAlert with provenance / traceability columns
ALTER TABLE "DisasterAlert" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'OFFICIAL';
ALTER TABLE "DisasterAlert" ADD COLUMN "sourceAlertId" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "sourceReference" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "authority" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "sender" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "eventType" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "urgency" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "certainty" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "msgType" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "scope" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "category" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "language" TEXT DEFAULT 'en';
ALTER TABLE "DisasterAlert" ADD COLUMN "headline" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "instruction" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "effectiveAt" TIMESTAMP(3);
ALTER TABLE "DisasterAlert" ADD COLUMN "onsetAt" TIMESTAMP(3);
ALTER TABLE "DisasterAlert" ADD COLUMN "affectedAreas" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "geometry" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "rawPayload" TEXT;
ALTER TABLE "DisasterAlert" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DisasterAlert" ADD COLUMN "isLive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DisasterAlert" ADD COLUMN "isDemoData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DisasterAlert" ADD COLUMN "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DisasterAlert" ADD COLUMN "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DisasterAlert" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DisasterAlert" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing seeded rows are demo/unverified (fail closed — never official)
UPDATE "DisasterAlert" SET "isDemoData" = true, "isVerified" = false, "isLive" = false, "sourceType" = 'OFFICIAL' WHERE "sourceAlertId" IS NULL;

-- CreateTable: AlertSourceState
CREATE TABLE "AlertSourceState" (
    "name" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "feedUrl" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastDataAt" TIMESTAMP(3),
    "lastError" TEXT,
    "responseTimeMs" INTEGER,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsAccepted" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertSourceState_pkey" PRIMARY KEY ("name")
);

-- CreateTable: AlertFeedCache
CREATE TABLE "AlertFeedCache" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "etag" TEXT,
    "lastModified" TEXT,
    "body" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertFeedCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AlertFeedCache_sourceName_key" ON "AlertFeedCache"("sourceName");

-- CreateTable: AlertAuditLog
CREATE TABLE "AlertAuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceAlertId" TEXT,
    "alertId" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    CONSTRAINT "AlertAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AlertAuditLog_source_sourceAlertId_idx" ON "AlertAuditLog"("source", "sourceAlertId");
CREATE INDEX "AlertAuditLog_alertId_idx" ON "AlertAuditLog"("alertId");
CREATE INDEX "AlertAuditLog_timestamp_idx" ON "AlertAuditLog"("timestamp");

-- Indexes for DisasterAlert
CREATE INDEX "DisasterAlert_status_expiresAt_idx" ON "DisasterAlert"("status", "expiresAt");
CREATE INDEX "DisasterAlert_sourceType_isVerified_isDemoData_status_idx" ON "DisasterAlert"("sourceType", "isVerified", "isDemoData", "status");
CREATE INDEX "DisasterAlert_expiresAt_idx" ON "DisasterAlert"("expiresAt");
CREATE INDEX "DisasterAlert_source_idx" ON "DisasterAlert"("source");
CREATE INDEX "DisasterAlert_sourceAlertId_idx" ON "DisasterAlert"("sourceAlertId");

-- Deduplication: (source, sourceAlertId) unique — NULL sourceAlertId rows exempt (legacy/demo)
CREATE UNIQUE INDEX "DisasterAlert_source_sourceAlertId_key" ON "DisasterAlert"("source", "sourceAlertId");
