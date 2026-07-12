import "server-only";

import { Resend } from "resend";

/** Null quando a chave não está configurada — e-mails viram no-op. */
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
