import type { Candidate } from "@prisma/client";
import { z } from "zod";

/** Perfil do candidato — reaproveitado entre candidaturas (CA2/CA3). */
export type CandidateProfile = Pick<
  Candidate,
  | "id"
  | "email"
  | "name"
  | "phone"
  | "resumeUrl"
  | "birthDate"
  | "city"
  | "state"
  | "neighborhood"
  | "desiredRole"
  | "salaryExpectation"
  | "workPreference"
  | "availability"
  | "hasCnh"
  | "isPcd"
  | "pcdDetails"
>;

export const WORK_PREFERENCE_LABELS: Record<string, string> = {
  ANY: "Qualquer modalidade",
  ONSITE: "Presencial",
  HYBRID: "Híbrido",
  REMOTE: "100% Remoto",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  IMMEDIATE: "Imediata",
  "15_DAYS": "Até 15 dias",
  "30_DAYS": "Até 30 dias",
  NEGOTIABLE: "A combinar",
};

export const CNH_LABELS: Record<string, string> = {
  NONE: "Não possui",
  A: "Categoria A (Moto)",
  B: "Categoria B (Carro)",
  AB: "Categoria AB (Carro e Moto)",
  C_D_E: "Categoria C / D / E (Pesados)",
};

export const SALARY_OPTIONS = [
  "A combinar",
  "Até R$ 2.000",
  "R$ 2.000 a R$ 3.500",
  "R$ 3.500 a R$ 5.000",
  "R$ 5.000 a R$ 8.000",
  "R$ 8.000 a R$ 12.000",
  "Acima de R$ 12.000",
] as const;


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
