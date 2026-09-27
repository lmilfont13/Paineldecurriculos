-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "publishedAt" TIMESTAMP(3);


-- Vagas já no ar contam a partir da criação.
UPDATE "Job" SET "publishedAt" = "createdAt" WHERE "status" <> 'DRAFT';
