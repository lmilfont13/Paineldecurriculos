-- Recados salvos pelo gestor (assunto + texto com marcadores), por empresa.
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id"         TEXT NOT NULL,
  "companyId"  TEXT NOT NULL,
  "subject"    TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "useCount"   INTEGER NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplate_companyId_subjectKey_key"
  ON "MessageTemplate"("companyId", "subjectKey");

DO $$ BEGIN
  ALTER TABLE "MessageTemplate"
    ADD CONSTRAINT "MessageTemplate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
