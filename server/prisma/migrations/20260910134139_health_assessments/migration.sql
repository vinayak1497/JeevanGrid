-- CreateTable
CREATE TABLE "HealthAssessment" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "riskScores" TEXT NOT NULL,
    "interpretation" TEXT,
    "nugenModel" TEXT,
    "confidence" TEXT NOT NULL,
    "isScenario" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthAssessment_district_createdAt_idx" ON "HealthAssessment"("district", "createdAt");

-- CreateIndex
CREATE INDEX "HealthAssessment_createdAt_idx" ON "HealthAssessment"("createdAt");
