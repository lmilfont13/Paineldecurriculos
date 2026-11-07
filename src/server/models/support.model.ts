import { z } from "zod";

export const SUPPORT_ROOM_IDS = [
  "recepcao",
  "atendimento",
  "cafe",
  "jogos",
  "diretoria",
] as const;

export type SupportRoomId = (typeof SUPPORT_ROOM_IDS)[number];

export interface SupportRoomDef {
  id: SupportRoomId;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  /** Bounds in map percentage (0..100) for the isometric/top-down floor plan */
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Default spawn point when clicking the room tab */
  spawn: { x: number; y: number };
}

export const SUPPORT_ROOMS: Record<SupportRoomId, SupportRoomDef> = {
  atendimento: {
    id: "atendimento",
    name: "Ala de Atendimento RH (Mesas 1 a 3)",
    shortName: "Mesas RH",
    description: "Atendimento individual 1:1 com recrutadores sentados nas mesas.",
    icon: "🎧",
    bounds: { xMin: 4, xMax: 35, yMin: 10, yMax: 94 },
    spawn: { x: 26, y: 54 },
  },
  recepcao: {
    id: "recepcao",
    name: "Recepção Executiva & Mural de Vagas",
    shortName: "Recepção Central",
    description: "Consulte o mural de vagas abertas, retire senha e veja orientações.",
    icon: "🏢",
    bounds: { xMin: 36, xMax: 64, yMin: 10, yMax: 62 },
    spawn: { x: 50, y: 52 },
  },
  cafe: {
    id: "cafe",
    name: "Bancada de Assistentes IA",
    shortName: "Bancada Bots IA",
    description: "Converse via balão de fala com os Bots IA sentados nas mesas.",
    icon: "🤖",
    bounds: { xMin: 65, xMax: 96, yMin: 10, yMax: 94 },
    spawn: { x: 74, y: 54 },
  },
  jogos: {
    id: "jogos",
    name: "Espaço Preparação & Simulado",
    shortName: "Simulado",
    description: "Simulado rápido de entrevista e boas práticas para processos seletivos.",
    icon: "🎯",
    bounds: { xMin: 36, xMax: 49, yMin: 63, yMax: 94 },
    spawn: { x: 43, y: 82 },
  },
  diretoria: {
    id: "diretoria",
    name: "Lounge Executivo & Avisos",
    shortName: "Lounge Executivo",
    description: "Ambiente reservado para alinhamentos e consulta de avisos.",
    icon: "🏛️",
    bounds: { xMin: 50, xMax: 64, yMin: 63, yMax: 94 },
    spawn: { x: 57, y: 82 },
  },
};

/** Posições fixas das 3 Mesas Executivas de Atendimento RH na Bancada Sul (Lado a Lado, sem sobreposição) */
export const SUPPORT_DESK_POSITIONS: Record<
  number,
  { staff: { x: number; y: number }; candidate: { x: number; y: number } }
> = {
  1: { staff: { x: 20, y: 82 }, candidate: { x: 20, y: 60 } },
  2: { staff: { x: 50, y: 82 }, candidate: { x: 50, y: 60 } },
  3: { staff: { x: 80, y: 82 }, candidate: { x: 80, y: 60 } },
};

export const SKIN_TONES = [
  "#f9dcc4",
  "#f3c6a0",
  "#e0a370",
  "#c68642",
  "#8d5524",
  "#5c3818",
] as const;

export const HAIR_COLORS = [
  "#1c1917",
  "#4a2c11",
  "#9a3412",
  "#d97706",
  "#eab308",
  "#6b7280",
] as const;

export const SHIRT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#e11d48",
  "#7c3aed",
  "#0d9488",
  "#334155",
] as const;

export const PANTS_COLORS = [
  "#1e293b",
  "#1e3a8a",
  "#3f3f46",
  "#451a03",
  "#064e3b",
] as const;

export const HAIR_STYLES = ["curto", "topete", "longo", "cacheado", "coque"] as const;
export const ACCESSORIES = ["none", "headset", "glasses", "cap"] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type AvatarAccessory = (typeof ACCESSORIES)[number];

export const avatarConfigSchema = z.object({
  skin: z.string().default(SKIN_TONES[1]),
  hair: z.enum(HAIR_STYLES).default("curto"),
  hairColor: z.string().default(HAIR_COLORS[0]),
  shirt: z.string().default(SHIRT_COLORS[0]),
  pants: z.string().default(PANTS_COLORS[0]),
  accessory: z.enum(ACCESSORIES).default("none"),
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: SKIN_TONES[1],
  hair: "curto",
  hairColor: HAIR_COLORS[0],
  shirt: SHIRT_COLORS[0],
  pants: PANTS_COLORS[0],
  accessory: "none",
};

export function normalizeAvatar(raw: unknown): AvatarConfig {
  const parsed = avatarConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_AVATAR;
}

export const SUPPORT_TOPICS = [
  { id: "VAGA", label: "Dúvida sobre vaga aberta", icon: "💼" },
  { id: "CANDIDATURA", label: "Andamento da minha candidatura", icon: "📋" },
  { id: "CURRICULO", label: "Ajuda com currículo ou cadastro", icon: "📄" },
  { id: "OUTRO", label: "Outros assuntos com o RH", icon: "💬" },
] as const;

export type SupportTopicId = (typeof SUPPORT_TOPICS)[number]["id"];

export const QUICK_REACTIONS = ["👋", "❤️", "☕", "🎵", "💡", "👏", "🎯"] as const;

/** Regras de convivência exibidas antes de entrar no espaço */
export const HOUSE_RULES = [
  "Trate todas as pessoas com respeito, cordialidade e empatia.",
  "Balões públicos aparecem para toda a sala — evite expor CPF, RG ou telefone.",
  "Conversas privadas exibem um cadeado 🔒 sobre os bonecos, mas só os dois leem o texto.",
  "Ofensas, spam ou desrespeito geram silenciamento ou bloqueio imediato pela equipe.",
] as const;

/** Lista enxuta de termos ofensivos bloqueados automaticamente em pt-BR */
const BLOCKED_WORDS = [
  "idiota",
  "imbecil",
  "otario",
  "otário",
  "babaca",
  "vagabundo",
  "vagabunda",
  "puta",
  "puto",
  "caralho",
  "porra",
  "merda",
  "foda-se",
  "fodase",
  "vai se foder",
  "vsf",
  "fdp",
  "arrombado",
  "arrombada",
  "desgraçado",
  "desgracado",
  "lixo humano",
  "retardado",
  "retardada",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function containsProfanity(text: string): boolean {
  const normalized = stripAccents(text);
  return BLOCKED_WORDS.some((word) => {
    const cleanWord = stripAccents(word);
    const regex = new RegExp(`(^|[^a-z0-9])${cleanWord}([^a-z0-9]|$)`, "i");
    return regex.test(normalized);
  });
}

export function sanitizePublicBubble(text: string): {
  ok: boolean;
  clean: string;
  error?: string;
} {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { ok: false, clean: "", error: "Digite uma mensagem." };
  }
  if (trimmed.length > 140) {
    return {
      ok: false,
      clean: trimmed.slice(0, 140),
      error: "Balões públicos têm no máximo 140 caracteres.",
    };
  }
  if (containsProfanity(trimmed)) {
    return {
      ok: false,
      clean: "",
      error:
        "Por favor, mantenha a comunicação respeitosa e cordial no espaço.",
    };
  }
  return { ok: true, clean: trimmed };
}

/** Determina em qual sala uma coordenada (x, y) está */
export function resolveRoomFromCoords(x: number, y: number): SupportRoomId {
  for (const room of Object.values(SUPPORT_ROOMS)) {
    if (
      x >= room.bounds.xMin &&
      x <= room.bounds.xMax &&
      y >= room.bounds.yMin &&
      y <= room.bounds.yMax
    ) {
      return room.id;
    }
  }
  return "recepcao";
}

export const enterSpaceSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Escolha um nome ou apelido com pelo menos 2 letras.")
    .max(32, "Use no máximo 32 caracteres."),
  avatar: avatarConfigSchema,
  rulesAccepted: z.literal(true, {
    error: "Aceite as regras de convivência respeitosa para entrar.",
  }),
});

export const requestTicketSchema = z.object({
  topic: z.enum(["VAGA", "CANDIDATURA", "CURRICULO", "OUTRO"]),
});

export const sendSupportMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Digite uma mensagem.")
    .max(500, "Mensagem privada pode ter até 500 caracteres."),
});

export const reportParticipantSchema = z.object({
  targetParticipantId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Descreva brevemente o motivo.")
    .max(240, "Use no máximo 240 caracteres."),
  excerpt: z.string().max(200).optional(),
});

export const moderateParticipantSchema = z.object({
  targetParticipantId: z.string().min(1),
  action: z.enum(["mute", "unmute", "ban", "unban"]),
});

export interface SupportParticipantDTO {
  id: string;
  kind: "GUEST" | "CANDIDATE" | "STAFF";
  displayName: string;
  avatar: AvatarConfig;
  isMuted: boolean;
  isBanned: boolean;
}

export interface ActivePrivatePairDTO {
  conversationId: string;
  kind: "SERVICE" | "DM";
  desk: number | null;
  requesterId: string;
  requesterName: string;
  responderId: string | null;
  responderName: string | null;
}

export interface SupportConversationDTO {
  id: string;
  kind: "SERVICE" | "DM";
  status: "WAITING" | "ACTIVE" | "CLOSED" | "DECLINED";
  topic: string | null;
  queueNumber: number | null;
  desk: number | null;
  requester: {
    id: string;
    displayName: string;
    kind: "GUEST" | "CANDIDATE" | "STAFF";
    avatar: AvatarConfig;
  };
  responder: {
    id: string;
    displayName: string;
    kind: "GUEST" | "CANDIDATE" | "STAFF";
    avatar: AvatarConfig;
  } | null;
  createdAt: string;
  startedAt: string | null;
}

export interface SupportMessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderKind: "GUEST" | "CANDIDATE" | "STAFF";
  body: string;
  createdAt: string;
}

export interface SupportReportDTO {
  id: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  reason: string;
  excerpt: string | null;
  createdAt: string;
}

export interface SupportJobDTO {
  id: string;
  code: string | null;
  title: string;
  description: string;
  requirements: string | null;
  location: string | null;
  contract: "CLT" | "PJ" | "FREELANCE" | "INTERNSHIP";
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  isTalentPool: boolean;
  createdAt: string;
}

export interface SupportSpaceStateDTO {
  /** Se a sala está liberada para candidatos no portal público (false = Modo Teste Equipe) */
  isPublicEnabled: boolean;
  me: (SupportParticipantDTO & { inboxKey: string }) | null;
  viewerRole: "GUEST" | "CANDIDATE" | "STAFF";
  prefillName: string | null;
  queueCount: number;
  myWaitingTicket: SupportConversationDTO | null;
  myPositionInQueue: number | null;
  myActiveConversation: SupportConversationDTO | null;
  myIncomingDmRequests: SupportConversationDTO[];
  myOutgoingDmRequest: SupportConversationDTO | null;
  activeMessages: SupportMessageDTO[];
  /** Pares em conversa privada ativa — visível para todos como cadeado 🔒 (sem mensagens) */
  activePrivatePairs: ActivePrivatePairDTO[];
  /** Vagas abertas da empresa para o Mural de Vagas e Bots Assistentes */
  openJobs: SupportJobDTO[];
  /** Apenas preenchido se viewerRole === 'STAFF' */
  staffQueue: SupportConversationDTO[];
  staffActiveDesks: SupportConversationDTO[];
  staffOpenReports: SupportReportDTO[];
}

export type AssistantBotId = "vagas" | "avisos" | "curriculo";

export interface SupportAssistantBotDef {
  id: AssistantBotId;
  name: string;
  roleTitle: string;
  badge: string;
  shortSpecialty: string;
  greeting: string;
  x: number;
  y: number;
  visitorSpot: { x: number; y: number };
  room: SupportRoomId;
  avatar: AvatarConfig;
  quickPrompts: string[];
}

export const SUPPORT_ASSISTANT_BOTS: SupportAssistantBotDef[] = [
  {
    id: "vagas",
    name: "Clara · IA Vagas",
    roleTitle: "Especialista nas Vagas Abertas",
    badge: "Mesa IA 01 · Vagas",
    shortSpecialty: "Requisitos, modalidade, local e contrato de cada vaga.",
    greeting:
      "Olá! Sou a Clara, IA especialista em vagas.\n• Pergunte sobre vagas abertas, requisitos ou contrato.\n• Clique na minha mesa para enviar um balão público para toda a sala!",
    x: 20,
    y: 26,
    visitorSpot: { x: 13, y: 56 },
    room: "cafe",
    avatar: {
      skin: "#f3c6a0",
      hair: "coque",
      hairColor: "#1c1917",
      shirt: "#1e40af",
      pants: "#0f172a",
      accessory: "headset",
    },
    quickPrompts: [
      "Quais vagas estão abertas?",
      "Requisitos desta vaga",
      "Modalidade e contrato",
      "Banco de Talentos",
    ],
  },
  {
    id: "avisos",
    name: "Heitor · IA Sistema",
    roleTitle: "Especialista em Avisos & Etapas",
    badge: "Mesa IA 02 · Avisos",
    shortSpecialty: "Onde acompanhar avisos do RH, status e pré-entrevista.",
    greeting:
      "Olá! Sou o Heitor, IA do sistema.\n• Explico onde ver avisos no Sino de Notificações.\n• Ensino como consultar etapas em Minhas Candidaturas e usar a Senha RH.",
    x: 50,
    y: 26,
    visitorSpot: { x: 33, y: 56 },
    room: "cafe",
    avatar: {
      skin: "#e0a370",
      hair: "curto",
      hairColor: "#4a2c11",
      shirt: "#334155",
      pants: "#1e293b",
      accessory: "glasses",
    },
    quickPrompts: [
      "Onde vejo os avisos do RH?",
      "Status da minha candidatura",
      "O que é a Pré-Entrevista?",
      "Como funciona a Senha RH?",
    ],
  },
  {
    id: "curriculo",
    name: "Helena · IA Currículo",
    roleTitle: "Especialista em PDF & Cadastro",
    badge: "Mesa IA 03 · Currículo",
    shortSpecialty: "Formato PDF (até 5 MB), reaproveitamento e LGPD.",
    greeting:
      "Olá! Sou a Helena, IA de triagem e currículo.\n• Tire dúvidas sobre o formato PDF (máx. 5 MB).\n• Saiba como reaproveitar seu currículo salvo e como protegemos seus dados (LGPD).",
    x: 80,
    y: 26,
    visitorSpot: { x: 87, y: 56 },
    room: "cafe",
    avatar: {
      skin: "#8d5524",
      hair: "longo",
      hairColor: "#1c1917",
      shirt: "#0f766e",
      pants: "#1e293b",
      accessory: "headset",
    },
    quickPrompts: [
      "Formato e tamanho do PDF",
      "Reaproveitar currículo salvo",
      "Dicas para destacar o CV",
      "Segurança de dados (LGPD)",
    ],
  },
];

export interface SystemGuideCard {
  id: string;
  step: string;
  title: string;
  description: string;
  whereToFind: string;
  linkType: "candidaturas" | "notificacoes" | "vagas" | "fila";
  ctaLabel: string;
}

export const CANDIDATE_SYSTEM_GUIDES: SystemGuideCard[] = [
  {
    id: "sino-notificacoes",
    step: "Canal 1 · Avisos Oficiais",
    title: "Central de Notificações (Sino no Topo)",
    description:
      "Sempre que a equipe de RH avança sua candidatura de etapa, envia um comunicado ou atualiza seu processo, um alerta aparece na Central de Novidades.",
    whereToFind: "Ícone de Sino no cabeçalho superior ou menu 'Notificações'",
    linkType: "notificacoes",
    ctaLabel: "Abrir Meus Avisos",
  },
  {
    id: "minhas-candidaturas",
    step: "Canal 2 · Status em Tempo Real",
    title: "Painel Minhas Candidaturas",
    description:
      "Consulte todas as vagas em que você se inscreveu, veja a linha do tempo de etapas (Em Análise, Pré-selecionado, Entrevista) e revise suas respostas.",
    whereToFind: "Menu 'Minhas Candidaturas' no portal do candidato",
    linkType: "candidaturas",
    ctaLabel: "Ver Minhas Candidaturas",
  },
  {
    id: "pre-entrevista",
    step: "Canal 3 · Etapa Complementar",
    title: "Solicitação de Pré-Entrevista",
    description:
      "Quando você avança para entrevista, o gestor pode solicitar dados complementares pelo sistema. Um aviso destacado aparecerá na sua candidatura com link seguro.",
    whereToFind: "Dentro do card da vaga em 'Minhas Candidaturas'",
    linkType: "candidaturas",
    ctaLabel: "Verificar Pendências",
  },
  {
    id: "atendimento-balcao",
    step: "Canal 4 · Suporte Síncrono",
    title: "Senha nos Balcões de Atendimento RH",
    description:
      "Aqui na sala ao vivo, você retira uma senha na aba 'Atendimento RH'. Quando o recrutador chamar seu número, o chat privado (🔒) abrirá automaticamente.",
    whereToFind: "Aba 'Atendimento RH' → Retirar Senha",
    linkType: "fila",
    ctaLabel: "Ir para Fila do RH",
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Consulte o Mural de Vagas",
    summary:
      "Veja todas as posições abertas da empresa, requisitos e regime de trabalho sem sair da sala.",
    actionTab: "vagas" as const,
    actionLabel: "Ver Mural de Vagas",
  },
  {
    number: "02",
    title: "Tire Dúvidas com Bots 24h",
    summary:
      "Pergunte aos assistentes virtuais sobre qualquer vaga específica, envio de currículo PDF ou etapas.",
    actionTab: "bots" as const,
    actionLabel: "Falar com Assistente",
  },
  {
    number: "03",
    title: "Acompanhe Avisos no Sistema",
    summary:
      "Saiba exatamente onde chegam convites de entrevista, mudanças de status e pedidos do RH.",
    actionTab: "orientacoes" as const,
    actionLabel: "Ver Guia de Avisos",
  },
  {
    number: "04",
    title: "Atendimento Humano 1:1",
    summary:
      "Precisa falar com um recrutador? Retire uma senha e seja atendido com sigilo nos Balcões 1 a 3.",
    actionTab: "rh" as const,
    actionLabel: "Retirar Senha RH",
  },
];

const CONTRACT_LABELS: Record<SupportJobDTO["contract"], string> = {
  CLT: "CLT",
  PJ: "PJ",
  FREELANCE: "Freelance",
  INTERNSHIP: "Estágio",
};

const WORK_MODE_LABELS: Record<SupportJobDTO["workMode"], string> = {
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
  ONSITE: "Presencial",
};

export function formatSupportJobContract(contract: SupportJobDTO["contract"]): string {
  return CONTRACT_LABELS[contract] ?? contract;
}

export function formatSupportJobWorkMode(workMode: SupportJobDTO["workMode"]): string {
  return WORK_MODE_LABELS[workMode] ?? workMode;
}

/**
 * Gera resposta imediata e contextualizada dos Bots Assistentes Corporativos,
 * utilizando os dados reais das vagas abertas da empresa e as regras do sistema.
 */
export function generateAssistantBotReply(params: {
  botId: AssistantBotId;
  question: string;
  selectedJob: SupportJobDTO | null;
  openJobs: SupportJobDTO[];
  companyName: string;
}): string {
  const { botId, question, selectedJob, openJobs, companyName } = params;
  const q = stripAccents(question);
  const regularJobs = openJobs.filter((j) => !j.isTalentPool);
  const talentPoolJob = openJobs.find((j) => j.isTalentPool);

  // Se o candidato perguntou sobre listagem geral de vagas abertas
  if (
    q.includes("quais vagas") ||
    q.includes("vagas abertas") ||
    q.includes("oportunidades")
  ) {
    if (regularJobs.length === 0) {
      return `Vagas na ${companyName}:\n• Recebendo currículos pelo Banco de Talentos.\n• Acesse a aba Vagas ao lado para enviar seu PDF.`;
    }
    const listText = regularJobs
      .slice(0, 5)
      .map(
        (j) =>
          `• ${j.title} (${formatSupportJobWorkMode(j.workMode)} · ${formatSupportJobContract(j.contract)}${j.location ? ` · ${j.location}` : ""})`
      )
      .join("\n");
    return `Temos ${regularJobs.length} ${regularJobs.length === 1 ? "vaga aberta" : "vagas abertas"} na ${companyName}:\n${listText}\n👉 Clique na aba Vagas ao lado para ver requisitos e se candidatar.`;
  }

  // Bot de Vagas ou pergunta sobre vaga selecionada
  if (botId === "vagas") {
    if (q.includes("banco de talentos")) {
      return talentPoolJob
        ? `Banco de Talentos ${companyName}:\n• Ativo para todos os perfis profissionais.\n• Envie seu currículo em PDF na aba Vagas.\n• O RH entra em contato assim que abrir vaga compatível.`
        : `Cadastro de Perfil na ${companyName}:\n• Candidate-se diretamente às vagas abertas na aba Vagas.\n• Seu currículo em PDF fica salvo no seu perfil para novas oportunidades.`;
    }

    if (selectedJob) {
      const meta = `${formatSupportJobWorkMode(selectedJob.workMode)} · ${formatSupportJobContract(selectedJob.contract)}${selectedJob.location ? ` · ${selectedJob.location}` : ""}`;
      if (q.includes("requisito") || q.includes("exig") || q.includes("precisa")) {
        const reqs = selectedJob.requirements?.trim()
          ? selectedJob.requirements
              .split("\n")
              .map((l) => l.replace(/^[-•*]\s*/, "").trim())
              .filter(Boolean)
              .slice(0, 4)
              .map((l) => `• ${l}`)
              .join("\n")
          : "• Consulte a descrição detalhada na aba Vagas.\n• Anexe seu currículo em PDF atualizado (até 5 MB).";
        return `Requisitos — ${selectedJob.title} (${meta}):\n${reqs}\n👉 Clique em Candidatar-se na aba Vagas.`;
      }

      if (
        q.includes("modalidade") ||
        q.includes("contrato") ||
        q.includes("local") ||
        q.includes("remoto") ||
        q.includes("presencial") ||
        q.includes("hibrido")
      ) {
        return `Detalhes da vaga ${selectedJob.title}:\n• Modalidade: ${formatSupportJobWorkMode(selectedJob.workMode)}\n• Contrato: ${formatSupportJobContract(selectedJob.contract)}\n• Local: ${selectedJob.location || "Conforme descrição da vaga"}`;
      }

      const shortDesc =
        selectedJob.description.length > 140
          ? `${selectedJob.description.slice(0, 140).trim()}...`
          : selectedJob.description;
      return `Resumo — ${selectedJob.title}:\n• Regime: ${meta}\n• Sobre: ${shortDesc}\n👉 Veja todos os detalhes na aba Vagas ao lado.`;
    }

    return regularJobs.length > 0
      ? `Temos ${regularJobs.length} vagas abertas no momento:\n• Selecione uma vaga na aba Bots IA ou Vagas ao lado.\n• Posso detalhar requisitos, contrato e local de trabalho.`
      : `Consulte a aba Vagas ao lado para enviar seu currículo em PDF no Banco de Talentos.`;
  }

  // Bot de Avisos & Sistema
  if (botId === "avisos") {
    if (q.includes("pre-entrevista") || q.includes("pre entrevista") || q.includes("documento")) {
      return `Etapa de Pré-Entrevista:\n• Solicitada pelo RH quando seu perfil avança para entrevista.\n• O alerta chega no Sino de Notificações (topo da tela).\n• O formulário seguro abre dentro de Minhas Candidaturas.`;
    }
    if (q.includes("senha") || q.includes("balcao") || q.includes("fila") || q.includes("rh")) {
      return `Como falar 1:1 com um Recrutador RH:\n• 1. Abra a aba RH no painel à direita.\n• 2. Escolha o assunto e clique em Retirar Senha.\n• 3. Ao ser chamado para a Mesa 01, 02 ou 03, o chat privado (🔒) abre na hora.`;
    }
    if (q.includes("status") || q.includes("andamento") || q.includes("etapa")) {
      return `Como consultar o status da sua inscrição:\n• Acesse Minhas Candidaturas no menu superior.\n• Veja a etapa atual: Em Análise, Pré-selecionado ou Contratado.\n• Qualquer mudança gera alerta imediato no Sino de Notificações.`;
    }
    return `Onde acompanhar os avisos oficiais da ${companyName}:\n• Sino de Notificações (topo): alertas de avanço de etapa e recados do RH.\n• Minhas Candidaturas: linha do tempo de cada vaga e Pré-Entrevista.\n• E-mail cadastrado: cópia automática dos comunicados importantes.`;
  }

  // Bot de Currículo & Triagem
  if (q.includes("lgpd") || q.includes("dados") || q.includes("segur") || q.includes("cpf")) {
    return `Proteção de Dados e LGPD:\n• Nunca informe CPF ou RG no balão público da sala.\n• Dados complementares só são pedidos em Minhas Candidaturas com criptografia.\n• Seus documentos são visíveis apenas aos recrutadores autorizados.`;
  }
  if (q.includes("toda vaga") || q.includes("reaproveitar") || q.includes("salvo")) {
    return `Reaproveitamento de Currículo:\n• Seu PDF fica salvo automaticamente na sua conta de candidato.\n• Ao se inscrever em nova vaga, você reaproveita o PDF com 1 clique ou envia outro atualizado.`;
  }
  if (q.includes("destacar") || q.includes("dica") || q.includes("estrutura")) {
    return `Boas práticas para o seu Currículo PDF:\n• Use PDF com texto selecionável (evite foto escaneada).\n• Destaque experiências recentes, conquistas e habilidades técnicas.\n• Mantenha o arquivo enxuto (limite máximo de 5 MB).`;
  }
  return `Regras de envio de Currículo na ${companyName}:\n• Formato aceito: exclusivamente arquivo PDF.\n• Tamanho máximo: até 5 MB por arquivo.\n• Prefira PDF com texto selecionável para facilitar a leitura pelo RH.`;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  tip: string;
}

export const CAREER_ARCADE_QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    question: "Qual atitude mais destaca um candidato em uma entrevista corporativa?",
    options: [
      "Decorar respostas prontas da internet",
      "Apresentar exemplos reais de desafios que resolveu e resultados obtidos",
      "Falar apenas sobre cargos anteriores sem citar entregas práticas",
    ],
    correctIndex: 1,
    tip: "Exemplos estruturados (Situação, Ação e Resultado) demonstram clareza e maturidade profissional.",
  },
  {
    id: "q2",
    question: "No currículo em PDF (máx. 5 MB), o que facilita a avaliação do recrutador?",
    options: [
      "Texto selecionável e claro, experiências recentes primeiro e conquistas objetivas",
      "Usar apenas imagens escaneadas sem texto selecionável",
      "Incluir números de documentos sensíveis no topo da página",
    ],
    correctIndex: 0,
    tip: "Um PDF com texto claro e bem estruturado valoriza sua trajetória profissional!",
  },
  {
    id: "q3",
    question: "Onde o candidato acompanha avisos oficiais sobre suas inscrições no sistema?",
    options: [
      "Apenas perguntando no chat público da sala",
      "No Sino de Notificações, na página Minhas Candidaturas e no e-mail cadastrado",
      "Não há histórico de avisos no portal",
    ],
    correctIndex: 1,
    tip: "O sistema registra cada avanço de etapa em 'Minhas Candidaturas' e no ícone de 'Notificações'!",
  },
];


