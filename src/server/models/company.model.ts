import type { Company } from "@prisma/client";
import { z } from "zod";

/** Passo 1 — Dados (A2). */
export const companyDataSchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa."),
  slug: z
    .string()
    .min(2, "Informe o slug.")
    .regex(/^[a-z0-9-]+$/, "Slug: só letras minúsculas, números e hífens."),
  email: z.email("Informe um e-mail válido."),
  cnpj: z.string().optional().default(""),
  sector: z.string().optional().default(""),
  website: z.string().optional().default(""),
});

/** Passo 2 — Marca (A3). */
export const companyBrandSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor primária inválida (use #RRGGBB)."),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor secundária inválida (use #RRGGBB)."),
  logoUrl: z.string().optional().default(""),
});

/** Passo 3 — Página (A4). */
export const companyPageSchema = z.object({
  heroTitle: z.string().min(2, "Informe o título da página."),
  heroSubtitle: z.string().min(2, "Informe o subtítulo."),
  aboutText: z.string().optional().default(""),
});

/** Passo 5 — Gestor (A6). */
export const managerInputSchema = z.object({
  managerName: z.string().min(2, "Informe o nome do gestor."),
  managerEmail: z.email("Informe um e-mail válido para o gestor."),
  managerPassword: z
    .string()
    .min(8, "Senha temporária: mínimo de 8 caracteres."),
});

export const createCompanySchema = companyDataSchema
  .extend(companyBrandSchema.shape)
  .extend(companyPageSchema.shape)
  .extend(managerInputSchema.shape);

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = companyDataSchema
  .extend(companyBrandSchema.shape)
  .extend(companyPageSchema.shape)
  .partial();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

/** Projeção pública da empresa — o que o fluxo do candidato pode ver. */
export type PublicCompany = Pick<
  Company,
  | "id"
  | "name"
  | "slug"
  | "primaryColor"
  | "secondaryColor"
  | "logoUrl"
  | "heroTitle"
  | "heroSubtitle"
  | "aboutText"
>;

/**
 * Cor de texto legível sobre a cor da marca (branco em cores escuras,
 * quase-preto em cores claras) — luminância perceptual.
 */
export function brandForeground(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff";
}

/** CSS vars da marca — usadas no fluxo público e nos acentos do painel do gestor. */
export function brandCssVars(company: {
  primaryColor: string;
  secondaryColor: string;
}): Record<string, string> {
  return {
    "--brand-primary": company.primaryColor,
    "--brand-secondary": company.secondaryColor,
    "--brand-foreground": brandForeground(company.primaryColor),
  };
}

export function toPublicCompany(company: Company): PublicCompany {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    primaryColor: company.primaryColor,
    secondaryColor: company.secondaryColor,
    logoUrl: company.logoUrl,
    heroTitle: company.heroTitle,
    heroSubtitle: company.heroSubtitle,
    aboutText: company.aboutText,
  };
}
