-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "committeeRole" TEXT NOT NULL DEFAULT 'SAC_SHC',
    "appointedById" TEXT,
    "recused" BOOLEAN NOT NULL DEFAULT false,
    "recusedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "documentId" TEXT,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "filedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvcVisitEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "visitDate" DATE,
    "mode" TEXT,
    "memberIds" JSONB NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvcVisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UndertakingEvidenceRound" (
    "id" TEXT NOT NULL,
    "undertakingId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    "verdict" TEXT,
    "remarks" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "UndertakingEvidenceRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommitteeMembership_userId_idx" ON "CommitteeMembership"("userId");

-- CreateIndex
CREATE INDEX "CommitteeMembership_applicationId_idx" ON "CommitteeMembership"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMembership_applicationId_userId_committeeRole_key" ON "CommitteeMembership"("applicationId", "userId", "committeeRole");

-- CreateIndex
CREATE INDEX "Appeal_applicationId_idx" ON "Appeal"("applicationId");

-- CreateIndex
CREATE INDEX "Appeal_institutionId_idx" ON "Appeal"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "EvcVisitEvent_applicationId_at_idx" ON "EvcVisitEvent"("applicationId", "at");

-- CreateIndex
CREATE INDEX "UndertakingEvidenceRound_undertakingId_idx" ON "UndertakingEvidenceRound"("undertakingId");

-- CreateIndex
CREATE UNIQUE INDEX "UndertakingEvidenceRound_undertakingId_roundNumber_key" ON "UndertakingEvidenceRound"("undertakingId", "roundNumber");

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvcVisitEvent" ADD CONSTRAINT "EvcVisitEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UndertakingEvidenceRound" ADD CONSTRAINT "UndertakingEvidenceRound_undertakingId_fkey" FOREIGN KEY ("undertakingId") REFERENCES "Undertaking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
