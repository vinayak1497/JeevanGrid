-- CreateTable
CREATE TABLE "ReportCorroboration" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCorroboration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCorroboration_reportId_createdAt_idx" ON "ReportCorroboration"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCorroboration_reportId_userId_key" ON "ReportCorroboration"("reportId", "userId");

-- AddForeignKey
ALTER TABLE "ReportCorroboration" ADD CONSTRAINT "ReportCorroboration_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EmergencyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
