-- Banco de talentos: pastas por perfil + perfil resumido pela IA.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiProfile" TEXT;

CREATE TABLE IF NOT EXISTS "TalentFolder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TalentFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TalentFolderItem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TalentFolderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TalentFolder_companyId_name_key" ON "TalentFolder"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TalentFolderItem_folderId_applicationId_key" ON "TalentFolderItem"("folderId", "applicationId");
CREATE INDEX IF NOT EXISTS "TalentFolderItem_applicationId_idx" ON "TalentFolderItem"("applicationId");

DO $$ BEGIN
  ALTER TABLE "TalentFolder" ADD CONSTRAINT "TalentFolder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TalentFolderItem" ADD CONSTRAINT "TalentFolderItem_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "TalentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TalentFolderItem" ADD CONSTRAINT "TalentFolderItem_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Mesma proteção das outras tabelas (RLS ligado, acesso só pelo servidor).
ALTER TABLE "TalentFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TalentFolderItem" ENABLE ROW LEVEL SECURITY;
