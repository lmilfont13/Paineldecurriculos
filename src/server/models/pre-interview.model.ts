import { z } from "zod";

/** Perguntas que o gestor pode pedir ao candidato aprovado (pré-entrevista). */
export const INFO_FIELDS = [
  "maritalStatus",
  "children",
  "professionalSummary",
  "rg",
  "cpf",
] as const;

export type InfoField = (typeof INFO_FIELDS)[number];

export const infoFieldLabels: Record<InfoField, string> = {
  maritalStatus: "Estado civil",
  children: "Filhos",
  professionalSummary: "Resumo profissional",
  rg: "RG",
  cpf: "CPF",
};

export const MARITAL_STATUSES = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Viúvo(a)",
] as const;

const digitsOf = (value: string) => value.replace(/\D/g, "");

/** CPF pelos dígitos verificadores; sequências repetidas (111.111.111-11) não valem. */
export function isValidCpf(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** "***.982.247-**": a ficha só mostra o miolo até o gestor pedir para ver. */
export function maskCpf(value: string): string {
  const d = digitsOf(value);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function maskRg(value: string): string {
  const v = value.trim();
  if (v.length <= 2) return "*".repeat(v.length);
  return `${"*".repeat(v.length - 2)}${v.slice(-2)}`;
}

export type KnownInfo = {
  maritalStatus: string | null;
  hasChildren: boolean | null;
  professionalSummary: string | null;
  rg: string | null;
  cpf: string | null;
  /** Currículo com texto extraído: já traz a vida profissional. */
  hasResumeText: boolean;
};

/** O que já se sabe da candidatura, na forma que as regras da pré-entrevista leem. */
export function knownInfoOf(application: {
  maritalStatus: string | null;
  hasChildren: boolean | null;
  professionalSummary: string | null;
  rg: string | null;
  cpf: string | null;
  resumeText: string | null;
}): KnownInfo {
  return {
    maritalStatus: application.maritalStatus,
    hasChildren: application.hasChildren,
    professionalSummary: application.professionalSummary,
    rg: application.rg,
    cpf: application.cpf,
    hasResumeText: Boolean(application.resumeText?.trim()),
  };
}

/** O que ainda vale pedir: o que a candidatura não tem. */
export function missingInfoFields(known: KnownInfo): InfoField[] {
  const missing: InfoField[] = [];
  if (!known.maritalStatus) missing.push("maritalStatus");
  if (known.hasChildren === null) missing.push("children");
  if (!known.professionalSummary?.trim() && !known.hasResumeText)
    missing.push("professionalSummary");
  if (!known.rg) missing.push("rg");
  if (!known.cpf) missing.push("cpf");
  return missing;
}

/** Dos campos que o gestor marcou, os que de fato faltam (os já sabidos não se pedem de novo). */
export function pendingRequestedFields(
  requested: InfoField[],
  known: KnownInfo
): InfoField[] {
  const missing = missingInfoFields(known);
  return requested.filter((f) => missing.includes(f));
}

/** Valida só as perguntas pedidas; o resto do que vier é descartado. */
export function buildInfoAnswerSchema(fields: InfoField[]) {
  const shape: Record<string, z.ZodType> = {};
  if (fields.includes("maritalStatus"))
    shape.maritalStatus = z.enum(MARITAL_STATUSES, {
      message: "Escolha o estado civil.",
    });
  if (fields.includes("children")) {
    shape.hasChildren = z.boolean({ message: "Diga se tem filhos." });
    shape.childrenCount = z.number().int().min(0).max(20).optional();
  }
  if (fields.includes("professionalSummary"))
    shape.professionalSummary = z
      .string()
      .trim()
      .min(20, "Conte um pouco mais (mínimo 20 caracteres).")
      .max(1500, "Resumo muito longo (máximo 1500 caracteres).");
  if (fields.includes("rg"))
    shape.rg = z
      .string()
      .trim()
      .min(5, "Informe o RG.")
      .max(20, "RG muito longo.");
  if (fields.includes("cpf"))
    shape.cpf = z
      .string()
      .refine(isValidCpf, "CPF inválido.")
      .transform(digitsOf);
  return z.object(shape);
}

/** Atalho de WhatsApp: abre a conversa com o texto e o link do formulário prontos. */
export function whatsappInfoLink(params: {
  phone: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  url: string;
}): string {
  const digits = digitsOf(params.phone);
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const first = params.candidateName.trim().split(/\s+/)[0] ?? "";
  const text =
    `Oi, ${first}! Aqui é da ${params.companyName}. ` +
    `Para seguir com a vaga de ${params.jobTitle}, preciso que você preencha ` +
    `algumas informações neste link: ${params.url}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
