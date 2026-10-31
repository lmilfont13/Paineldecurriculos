-- Pré-entrevista: dados pedidos pelo gestor e respondidos pelo candidato aprovado.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "maritalStatus"       TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "hasChildren"         BOOLEAN;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "childrenCount"       INTEGER;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "professionalSummary" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "rg"                  TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "cpf"                 TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "infoRequestedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "infoRequestedAt"     TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "infoAnsweredAt"      TIMESTAMP(3);

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED';
