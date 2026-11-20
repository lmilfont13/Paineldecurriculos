-- Vitrine de contratados: o candidato aprovado autoriza mostrar nome e vaga
-- na página pública. Colunas novas herdam o bloqueio de RLS da tabela.
ALTER TABLE "Application" ADD COLUMN "showcaseConsent" BOOLEAN;
ALTER TABLE "Application" ADD COLUMN "showcaseConsentAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "showcaseHidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Application_companyId_showcaseConsent_idx" ON "Application"("companyId", "showcaseConsent");
