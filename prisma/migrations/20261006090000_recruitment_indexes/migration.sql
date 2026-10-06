-- Performance indexes for the manager recruitment pipeline.
CREATE INDEX "Application_companyId_status_createdAt_idx"
  ON "Application" ("companyId", "status", "createdAt");

CREATE INDEX "Application_jobId_status_idx"
  ON "Application" ("jobId", "status");

CREATE INDEX "Application_companyId_aiScore_idx"
  ON "Application" ("companyId", "aiScore");

CREATE INDEX "StatusEvent_applicationId_createdAt_idx"
  ON "StatusEvent" ("applicationId", "createdAt");
