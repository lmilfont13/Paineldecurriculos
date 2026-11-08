-- Vagas externas (agregadas do Google Vagas): só divulgação, sem candidatura no portal.
CREATE TABLE IF NOT EXISTS "ExternalJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "source" TEXT,
    "applyUrl" TEXT NOT NULL,
    "postedLabel" TEXT,
    "scheduleType" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalJob_companyId_externalId_key" ON "ExternalJob"("companyId", "externalId");
CREATE INDEX IF NOT EXISTS "ExternalJob_companyId_isPublished_idx" ON "ExternalJob"("companyId", "isPublished");

DO $$ BEGIN
  ALTER TABLE "ExternalJob" ADD CONSTRAINT "ExternalJob_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Mesma política das demais tabelas: acesso só via servidor (service role / Prisma).
ALTER TABLE "ExternalJob" ENABLE ROW LEVEL SECURITY;

