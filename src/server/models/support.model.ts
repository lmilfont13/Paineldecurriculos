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
    name: "Balcões de Atendimento RH",
    shortName: "Atendimento RH",
    description: "Converse 1 a 1 com recrutadores nos balcões privados.",
    icon: "🎧",
    bounds: { xMin: 4, xMax: 46, yMin: 6, yMax: 48 },
    spawn: { x: 26, y: 30 },
  },
  recepcao: {
    id: "recepcao",
    name: "Recepção & Sala de Espera",
    shortName: "Recepção",
    description: "Retire sua senha de atendimento e aguarde nos sofás.",
    icon: "🛋️",
    bounds: { xMin: 30, xMax: 70, yMin: 30, yMax: 72 },
    spawn: { x: 50, y: 52 },
  },
  cafe: {
    id: "cafe",
    name: "Café & Networking",
    shortName: "Café",
    description: "Troque ideias e experiências com outros candidatos.",
    icon: "☕",
    bounds: { xMin: 54, xMax: 96, yMin: 6, yMax: 48 },
    spawn: { x: 76, y: 28 },
  },
  jogos: {
    id: "jogos",
    name: "Sala de Jogos & Quiz",
    shortName: "Sala de Jogos",
    description: "Fliperamas, mesa de sinuca e quiz rápido de carreira.",
    icon: "🎮",
    bounds: { xMin: 4, xMax: 46, yMin: 52, yMax: 94 },
    spawn: { x: 24, y: 74 },
  },
  diretoria: {
    id: "diretoria",
    name: "Diretoria & Lounge VIP",
    shortName: "Diretoria",
    description: "Espaço executivo para bate-papos especiais e entrevistas.",
    icon: "🏛️",
    bounds: { xMin: 54, xMax: 96, yMin: 52, yMax: 94 },
    spawn: { x: 76, y: 74 },
  },
};

/** Posições fixas dos 3 balcões de atendimento no mapa */
export const SUPPORT_DESK_POSITIONS: Record<
  number,
  { staff: { x: number; y: number }; candidate: { x: number; y: number } }
> = {
  1: { staff: { x: 12, y: 18 }, candidate: { x: 18, y: 24 } },
  2: { staff: { x: 24, y: 14 }, candidate: { x: 30, y: 20 } },
  3: { staff: { x: 36, y: 18 }, candidate: { x: 38, y: 25 } },
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

export interface SupportSpaceStateDTO {
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
  /** Apenas preenchido se viewerRole === 'STAFF' */
  staffQueue: SupportConversationDTO[];
  staffActiveDesks: SupportConversationDTO[];
  staffOpenReports: SupportReportDTO[];
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
    question: "Qual atitude mais destaca um candidato em uma entrevista?",
    options: [
      "Decorar respostas prontas da internet",
      "Dar exemplos reais de problemas que resolveu em equipe",
      "Falar apenas sobre cargos anteriores sem citar resultados",
    ],
    correctIndex: 1,
    tip: "Exemplos práticos (situação, ação e resultado) mostram como você atua no dia a dia!",
  },
  {
    id: "q2",
    question: "No currículo em PDF, o que ajuda tanto o recrutador quanto a triagem?",
    options: [
      "Texto claro, experiências recentes primeiro e conquistas objetivas",
      "Usar apenas imagens escaneadas sem texto selecionável",
      "Incluir números de documentos sensíveis no topo da página",
    ],
    correctIndex: 0,
    tip: "Um PDF com texto claro e estruturado facilita a leitura humana e valoriza sua experiência!",
  },
  {
    id: "q3",
    question: "Ao conversar na sala de networking com outros candidatos, qual é a melhor prática?",
    options: [
      "Compartilhar dados pessoais como CPF no balão público",
      "Trocar dicas sobre a área com cordialidade e respeito",
      "Enviar várias mensagens seguidas em letras maiúsculas",
    ],
    correctIndex: 1,
    tip: "Gentileza e boas trocas criam conexões valiosas para sua carreira!",
  },
];
