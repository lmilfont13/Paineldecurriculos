-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "authId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_authId_key" ON "Candidate"("authId");

