-- Quando o gestor pediu a autorização da vitrine (para não pedir duas vezes).
ALTER TABLE "Application" ADD COLUMN "showcaseAskedAt" TIMESTAMP(3);
