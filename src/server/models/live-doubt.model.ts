import { z } from "zod";

export interface LiveDoubt {
  id: string;
  companySlug: string;
  candidateName: string;
  contact?: string | null;
  question: string;
  path?: string | null;
  createdAt: string;
  status: "pending" | "answered";
  answer?: string | null;
  answeredAt?: string | null;
  answeredBy?: string | null;
}

export const submitLiveDoubtSchema = z.object({
  companySlug: z.string().min(1, "Slug da empresa é obrigatório"),
  candidateName: z.string().trim().min(2, "Informe seu nome (mínimo 2 caracteres)").max(100),
  contact: z.string().trim().max(120).optional().nullable(),
  question: z.string().trim().min(3, "Digite sua dúvida (mínimo 3 caracteres)").max(1000),
  path: z.string().trim().max(200).optional().nullable(),
});

export type SubmitLiveDoubtInput = z.infer<typeof submitLiveDoubtSchema>;

export const answerLiveDoubtSchema = z.object({
  doubtId: z.string().min(1),
  answer: z.string().trim().min(1, "A resposta não pode ser vazia").max(2000),
});

export type AnswerLiveDoubtInput = z.infer<typeof answerLiveDoubtSchema>;
