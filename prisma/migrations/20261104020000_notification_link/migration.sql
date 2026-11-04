-- Notificação de vaga nova (banco de talentos ativo): guarda o link para o
-- candidato ir direto à vaga, já que ele não tem candidatura nessa vaga ainda.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "linkUrl" TEXT;
