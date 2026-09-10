-- AlterTable
ALTER TABLE "DisasterAlert" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertNotificationLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceAlertId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertSubscription_district_idx" ON "AlertSubscription"("district");

-- CreateIndex
CREATE INDEX "AlertSubscription_userId_idx" ON "AlertSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscription_userId_district_key" ON "AlertSubscription"("userId", "district");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_district_idx" ON "PushSubscription"("district");

-- CreateIndex
CREATE INDEX "AlertNotificationLog_sourceAlertId_idx" ON "AlertNotificationLog"("sourceAlertId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertNotificationLog_source_sourceAlertId_endpointHash_acti_key" ON "AlertNotificationLog"("source", "sourceAlertId", "endpointHash", "action");
