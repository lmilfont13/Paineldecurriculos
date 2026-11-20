import { z } from "zod";

export const benefitItemSchema = z.object({
  id: z.string(),
  type: z.enum(["salary", "meal", "aid", "health", "phone", "transport", "custom"]),
  label: z.string(),
  value: z.string(),
  highlight: z.boolean().default(false),
});

export type BenefitItem = z.infer<typeof benefitItemSchema>;

export const socialJobPostSchema = z.object({
  jobCode: z.string().default(""),
  opportunityTitle: z.string().default("OPORTUNIDADE DE EMPREGO"),
  opportunitySubtitle: z.string().default("Estamos contratando!"),
  roleTitle: z.string().min(1, "Cargo é obrigatório"),
  segmentSubtitle: z.string().default(""),
  location: z.string().default(""),
  route: z.string().default(""),
  startDate: z.string().default("Início imediato"),
  contractType: z.string().default("Regime CLT – Efetivo"),
  workSchedule: z.string().default("44h semanais"),
  salary: z.string().default(""),
  mealVoucher: z.string().default(""),
  costAid: z.string().default(""),
  healthInsurance: z.string().default(""),
  corporatePhone: z.string().default(""),
  benefitsList: z.array(benefitItemSchema).default([]),
  ctaText: z.string().default("Acesse o link na nossa bio do Instagram para se candidatar! 👆"),
  disclaimer: z.string().default("Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal."),
  modelImage: z.string().default("/images/templates/master-template-1080.png"),
  caption: z.string().default(""),
});

export type SocialJobPostData = z.infer<typeof socialJobPostSchema>;

export const DEFAULT_POST_DATA: SocialJobPostData = {
  jobCode: "1129",
  opportunityTitle: "OPORTUNIDADE DE EMPREGO",
  opportunitySubtitle: "Estamos contratando!",
  roleTitle: "CONSULTOR(A) MERCHAN JR",
  segmentSubtitle: "SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS",
  location: "Fortaleza - CE",
  route: "Cobertura de 2 Lojas, sendo 1 loja por dia | Bairros: Papicu e Edson Queiroz",
  startDate: "Em Novembro - data à confirmar",
  contractType: "Regime CLT – EFETIVO",
  workSchedule: "44h semanais — Seg a Sex (11h às 20h) e Sáb (16h às 20h)",
  salary: "R$ 1.839,41",
  mealVoucher: "R$ 35,00/dia",
  costAid: "(de acordo com o roteiro)",
  healthInsurance: "e odontológico",
  corporatePhone: "CORPORATIVO",
  benefitsList: [
    { id: "b1", type: "salary", label: "Salário", value: "R$ 1.839,41", highlight: true },
    { id: "b2", type: "meal", label: "VALE REFEIÇÃO", value: "R$ 35,00/dia", highlight: false },
    { id: "b3", type: "aid", label: "AJUDA DE CUSTO", value: "(de acordo com o roteiro)", highlight: false },
    { id: "b4", type: "health", label: "CONVÊNIO MÉDICO", value: "e odontológico", highlight: false },
    { id: "b5", type: "phone", label: "APARELHO", value: "CORPORATIVO", highlight: false },
  ],
  ctaText: "Acesse o link na nossa bio do Instagram para se candidatar! 👆",
  disclaimer: "⚠️ Inscrições abertas! Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal.",
  modelImage: "/images/templates/official-model-clean.png",
  caption: "",
};

export const STOCK_MODELS = [
  {
    id: "model-official",
    label: "Modelo Oficial Tarhget (Padrão Oficial)",
    src: "/images/templates/official-model-clean.png",
    gender: "female",
    tag: "Oficial Tarhget",
  },
  {
    id: "model-man-1",
    label: "Homem · Promotor / Supermercado",
    src: "/images/templates/model-man-retail-1.jpg",
    gender: "male",
    tag: "Varejo & Supermercado",
  },
  {
    id: "model-woman-2",
    label: "Mulher · Promotora / Supermercado",
    src: "/images/templates/model-woman-retail-2.jpg",
    gender: "female",
    tag: "Supermercado & Merchandising",
  },
] as const;
