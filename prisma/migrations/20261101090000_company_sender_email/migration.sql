-- Remetente opcional dos e-mails da empresa (domínio verificado no Resend).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;
