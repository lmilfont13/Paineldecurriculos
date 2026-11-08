export type BirthdayAiStyle =
  | "luxury_gold"
  | "corporate_modern"
  | "festive_warm"
  | "botanical_prestige";

export interface BirthdayAiStyleConfig {
  id: BirthdayAiStyle;
  label: string;
  emoji: string;
  badge: string;
  description: string;
  promptTemplate: (params: { name: string; age?: number; company: string }) => string;
}

export const BIRTHDAY_AI_STYLES: Record<BirthdayAiStyle, BirthdayAiStyleConfig> = {
  luxury_gold: {
    id: "luxury_gold",
    label: "Cartão Executivo Ouro & Prestígio",
    emoji: "🏆",
    badge: "Mais Usado",
    description: "Design luxuoso de papelaria fina com moldura dourada e estilo cartão de celebração.",
    promptTemplate: ({ name, age, company }) =>
      `A magnificent high-end luxury birthday greeting card design celebrating ${name}${
        age ? ` completing ${age} years of life` : ""
      }. Premium corporate greeting card presentation with embossed polished gold borders, tasteful golden glitter and bokeh confetti framing the edges, centered greeting card layout with celebratory elegance from ${company}, festive yet deeply professional, award-winning stationery design, 8k resolution, crisp clean presentation.`,
  },
  corporate_modern: {
    id: "corporate_modern",
    label: "Cartão Corporativo Contemporâneo",
    emoji: "💼",
    badge: "Minimalista",
    description: "Visual executivo moderno em tons de azul marinho, prata e linhas geométricas limpas.",
    promptTemplate: ({ name, company }) =>
      `A sophisticated contemporary corporate birthday greeting card dedicated to ${name} by ${company}. Clean minimalist graphic card design, deep navy blue background with polished platinum and gold accents, stylish festive geometric elements, celebrating career milestones, success and happiness, premium agency greeting card layout, high aesthetic 8k digital art.`,
  },
  festive_warm: {
    id: "festive_warm",
    label: "Cartão Festivo & Caloroso",
    emoji: "🎉",
    badge: "Festivo",
    description: "Cartão vibrante e acolhedor, com balões elegantes e clima de festa alegre.",
    promptTemplate: ({ name }) =>
      `An uplifting, joyful and tasteful birthday greeting card design celebrating ${name}. Elegant floating festive balloons in pastel and champagne tones, delicate celebration ribbons, warm inviting lighting, clean greeting card composition conveying joy, appreciation and happiness, premium commercial greeting card illustration, 8k ultra sharp quality.`,
  },
  botanical_prestige: {
    id: "botanical_prestige",
    label: "Cartão Floral & Botânico Nobre",
    emoji: "🌿",
    badge: "Elegante",
    description: "Ilustração nobre com folhagens delicadas, flores brancas e toque de carinho da equipe.",
    promptTemplate: ({ name }) =>
      `A graceful luxury botanical birthday greeting card celebrating ${name}. Refined watercolor and fine-line illustration of eucalyptus leaves and white blossoms framing an elegant celebration card, warm sunlit background, heartfelt and peaceful aesthetic, premium bespoke stationery greeting card, 8k resolution.`,
  },
};

/**
 * Monta o prompt otimizado para o modelo Google Imagen 3 / IA gerar o cartão de aniversário.
 */
export function buildBirthdayImagePrompt(params: {
  name: string;
  age?: number;
  company?: string;
  style?: BirthdayAiStyle;
  customPrompt?: string;
}): string {
  if (params.customPrompt?.trim()) {
    return params.customPrompt.trim();
  }

  const selectedStyle = params.style && BIRTHDAY_AI_STYLES[params.style]
    ? BIRTHDAY_AI_STYLES[params.style]
    : BIRTHDAY_AI_STYLES.luxury_gold;

  return selectedStyle.promptTemplate({
    name: params.name,
    age: params.age,
    company: params.company || "nossa empresa",
  });
}
