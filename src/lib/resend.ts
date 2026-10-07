import "server-only";

import { Resend } from "resend";

import { readEnv } from "@/lib/env";

/** Null quando a chave não está configurada — e-mails viram no-op. */
const apiKey = readEnv("RESEND_API_KEY");
export const resend = apiKey ? new Resend(apiKey) : null;
