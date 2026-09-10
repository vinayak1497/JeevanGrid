-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "district" TEXT NOT NULL DEFAULT 'Mumbai Suburban',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisasterAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hazardType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'IMD / NDMA',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "DisasterAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyReport" (
    "id" TEXT NOT NULL,
    "citizenName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "emergencyType" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "peopleAffected" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emergencyType" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'Moderate',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "district" TEXT NOT NULL DEFAULT 'Mumbai Suburban',
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "locationName" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "responderName" TEXT NOT NULL,
    "situationReport" TEXT NOT NULL,
    "casualtiesRescued" INTEGER NOT NULL DEFAULT 0,
    "medicalRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "photoUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "totalBeds" INTEGER NOT NULL,
    "availableBeds" INTEGER NOT NULL,
    "icuBeds" INTEGER NOT NULL,
    "availableIcuBeds" INTEGER NOT NULL,
    "oxygenStockDays" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "contactPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Shelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "contactPhone" TEXT NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyGuide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hazardType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "guidelineCount" INTEGER NOT NULL DEFAULT 12,
    "imageUrl" TEXT,
    "beforeSteps" TEXT NOT NULL,
    "duringSteps" TEXT NOT NULL,
    "afterSteps" TEXT NOT NULL,
    "dos" TEXT NOT NULL,
    "donts" TEXT NOT NULL,
    "kitItems" TEXT NOT NULL,
    "evacuationTriggers" TEXT NOT NULL,

    CONSTRAINT "SafetyGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL,
    "humidity" INTEGER NOT NULL,
    "windSpeed" DOUBLE PRECISION NOT NULL,
    "rainProbability" INTEGER NOT NULL,
    "aqi" INTEGER NOT NULL,
    "aqiStatus" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_reportId_key" ON "Incident"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyGuide_slug_key" ON "SafetyGuide"("slug");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EmergencyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
