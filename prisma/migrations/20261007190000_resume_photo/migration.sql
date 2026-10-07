-- Foto recortada do currículo (referência visual nas listagens do gestor).
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "photoPath" TEXT;
