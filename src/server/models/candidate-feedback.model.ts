import { z } from "zod";

/**
 * Escala estratégica de emojis para avaliação da experiência do candidato
 */
export const CANDIDATE_EMOJI_KEYS = ["love", "happy", "neutral", "sad"] as const;
export type CandidateEmojiKey = (typeof CANDIDATE_EMOJI_KEYS)[number];

export interface CandidateEmojiDefinition {
  key: CandidateEmojiKey;
  emoji: string;
  label: string;
  weight: number; // 0 a 100 para cálculo de CSAT
  color: string;
  badgeBg: string;
}

export const CANDIDATE_EMOJI_DEFINITIONS: Record<CandidateEmojiKey, CandidateEmojiDefinition> = {
  love: {
    key: "love",
    emoji: "😍",
    label: "Amei / Incrível",
    weight: 100,
    color: "#10b981", // Emerald
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  happy: {
    key: "happy",
    emoji: "😊",
    label: "Muito Bom / Fácil",
    weight: 80,
    color: "#3b82f6", // Blue
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  neutral: {
    key: "neutral",
    emoji: "😐",
    label: "Razoável / Médio",
    weight: 40,
    color: "#f59e0b", // Amber
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
  },
  sad: {
    key: "sad",
    emoji: "😕",
    label: "Confuso / Difícil",
    weight: 0,
    color: "#ef4444", // Red
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export const candidateFeedbackInputSchema = z.object({
  slug: z.string().min(1, "Slug da empresa é obrigatório"),
  emoji: z.enum(CANDIDATE_EMOJI_KEYS),
  comment: z.string().max(500, "Comentário deve ter até 500 caracteres").optional(),
  path: z.string().max(200).optional(),
  candidateName: z.string().max(120).optional(),
});

export type CandidateFeedbackInput = z.infer<typeof candidateFeedbackInputSchema>;

export interface CandidateFeedbackRecord {
  id: string;
  emoji: CandidateEmojiKey;
  comment?: string;
  path?: string;
  candidateName?: string;
  createdAt: string; // ISO 8601
}

export interface CandidateSentimentCounts {
  love: number;
  happy: number;
  neutral: number;
  sad: number;
}

export interface CandidateSentimentPercentages {
  love: number;
  happy: number;
  neutral: number;
  sad: number;
}

export interface CandidateSentimentSummary {
  total: number;
  csatScore: number; // 0 a 100 (% de aprovação geral calculada)
  satisfactionRate: number; // % que votou positivo (love + happy)
  counts: CandidateSentimentCounts;
  percentages: CandidateSentimentPercentages;
  recentComments: Array<{
    id: string;
    emoji: CandidateEmojiKey;
    comment: string;
    candidateName?: string;
    path?: string;
    createdAt: string;
  }>;
}

/**
 * Calcula o resumo consolidado, percentuais e score de satisfação (CSAT)
 * a partir de uma lista de feedbacks.
 */
export function calculateSentimentSummary(
  records: CandidateFeedbackRecord[]
): CandidateSentimentSummary {
  const total = records.length;

  const counts: CandidateSentimentCounts = {
    love: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
  };

  let totalWeight = 0;

  for (const r of records) {
    if (counts[r.emoji] !== undefined) {
      counts[r.emoji]++;
      totalWeight += CANDIDATE_EMOJI_DEFINITIONS[r.emoji].weight;
    }
  }

  const percentages: CandidateSentimentPercentages = {
    love: total > 0 ? Math.round((counts.love / total) * 100) : 0,
    happy: total > 0 ? Math.round((counts.happy / total) * 100) : 0,
    neutral: total > 0 ? Math.round((counts.neutral / total) * 100) : 0,
    sad: total > 0 ? Math.round((counts.sad / total) * 100) : 0,
  };

  const csatScore = total > 0 ? Math.round(totalWeight / total) : 100;
  const satisfactionRate =
    total > 0 ? Math.round(((counts.love + counts.happy) / total) * 100) : 100;

  const recentComments = records
    .filter((r): r is CandidateFeedbackRecord & { comment: string } => Boolean(r.comment?.trim()))
    .slice(-10)
    .reverse()
    .map((r) => ({
      id: r.id,
      emoji: r.emoji,
      comment: r.comment.trim(),
      candidateName: r.candidateName,
      path: r.path,
      createdAt: r.createdAt,
    }));

  return {
    total,
    csatScore,
    satisfactionRate,
    counts,
    percentages,
    recentComments,
  };
}

