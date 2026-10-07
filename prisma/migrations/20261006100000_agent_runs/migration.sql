CREATE TYPE "AgentType" AS ENUM ('TRIAGE', 'COMMUNICATION');
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT,
  "agent" "AgentType" NOT NULL,
  "eventName" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "summary" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentRun_companyId_createdAt_idx" ON "AgentRun" ("companyId", "createdAt");
CREATE INDEX "AgentRun_companyId_agent_status_createdAt_idx" ON "AgentRun" ("companyId", "agent", "status", "createdAt");
CREATE INDEX "AgentRun_applicationId_createdAt_idx" ON "AgentRun" ("applicationId", "createdAt");
