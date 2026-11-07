-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SupportParticipantKind" AS ENUM ('GUEST', 'CANDIDATE', 'STAFF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SupportConversationKind" AS ENUM ('SERVICE', 'DM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SupportConversationStatus" AS ENUM ('WAITING', 'ACTIVE', 'CLOSED', 'DECLINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportParticipant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "SupportParticipantKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" JSONB NOT NULL DEFAULT '{}',
    "candidateId" TEXT,
    "userId" TEXT,
    "secretHash" TEXT,
    "inboxKey" TEXT NOT NULL,
    "mutedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "SupportConversationKind" NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'WAITING',
    "topic" TEXT,
    "queueNumber" INTEGER,
    "desk" INTEGER,
    "requesterId" TEXT NOT NULL,
    "responderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "excerpt" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SupportParticipant_inboxKey_key" ON "SupportParticipant"("inboxKey");
CREATE INDEX IF NOT EXISTS "SupportParticipant_companyId_idx" ON "SupportParticipant"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupportParticipant_companyId_candidateId_key" ON "SupportParticipant"("companyId", "candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupportParticipant_companyId_userId_key" ON "SupportParticipant"("companyId", "userId");

CREATE INDEX IF NOT EXISTS "SupportConversation_companyId_kind_status_idx" ON "SupportConversation"("companyId", "kind", "status");
CREATE INDEX IF NOT EXISTS "SupportConversation_requesterId_idx" ON "SupportConversation"("requesterId");
CREATE INDEX IF NOT EXISTS "SupportConversation_responderId_idx" ON "SupportConversation"("responderId");

CREATE INDEX IF NOT EXISTS "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportReport_companyId_resolvedAt_idx" ON "SupportReport"("companyId", "resolvedAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SupportParticipant" ADD CONSTRAINT "SupportParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "SupportParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "SupportParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "SupportParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportReport" ADD CONSTRAINT "SupportReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportReport" ADD CONSTRAINT "SupportReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "SupportParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SupportReport" ADD CONSTRAINT "SupportReport_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SupportParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Row Level Security (regra 1 — segunda camada de proteção multi-tenant)
ALTER TABLE "SupportParticipant"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportReport"       ENABLE ROW LEVEL SECURITY;

-- Realtime Authorization para canais privados do Espaço de Carreiras ao Vivo
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'realtime' AND c.relname = 'messages'
    ) THEN
        DROP POLICY IF EXISTS "support_private_inbox_read" ON "realtime"."messages";
        CREATE POLICY "support_private_inbox_read"
        ON "realtime"."messages"
        FOR SELECT
        TO anon, authenticated
        USING (
            realtime.messages.extension IN ('broadcast')
            AND EXISTS (
                SELECT 1
                FROM public."SupportParticipant" sp
                WHERE ('espaco-inbox:' || sp."inboxKey") = (SELECT realtime.topic())
                  AND sp."bannedAt" IS NULL
            )
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;
