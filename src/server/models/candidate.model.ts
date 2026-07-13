import type { Candidate } from "@prisma/client";
import { z } from "zod";

/** Perfil do candidato — reaproveitado entre candidaturas (CA2/CA3). */
export type CandidateProfile = Pick<
  Candidate,
  "id" | "email" | "name" | "phone" | "resumeUrl"
>;

export const candidateSignupSchema = z.object({
  name: z.string().min(2, "Informe seu nome completo."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export const candidateLoginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export type CandidateAuthResult =
  | { ok: true }
  | { ok: false; error: string };
