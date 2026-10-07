-- Índices nas chaves estrangeiras sem índice (Postgres não cria sozinho).
-- Sem eles, joins/includes e o ON DELETE CASCADE fazem varredura completa.
CREATE INDEX IF NOT EXISTS "Answer_applicationId_idx" ON "Answer"("applicationId");
CREATE INDEX IF NOT EXISTS "Answer_fieldId_idx" ON "Answer"("fieldId");
CREATE INDEX IF NOT EXISTS "FormField_companyId_order_idx" ON "FormField"("companyId", "order");
CREATE INDEX IF NOT EXISTS "Job_companyId_status_idx" ON "Job"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Notification_applicationId_idx" ON "Notification"("applicationId");
CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");
