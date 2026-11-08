export type BirthdayAiStyle =
  | "luxury_gold"
  | "gourmet_cake"
  | "corporate_achievement"
  | "warm_botanical";

export interface BirthdayAiStyleConfig {
  id: BirthdayAiStyle;
  label: string;
  emoji: string;
  description: string;
  promptTemplate: (params: { name: string; age?: number; company: string }) => string;
}

export const BIRTHDAY_AI_STYLES: Record<BirthdayAiStyle, BirthdayAiStyleConfig> = {
  luxury_gold: {
    id: "luxury_gold",
    label: "Celebração Executiva (Ouro & Brilho)",
    emoji: "🏆",
    description: "Cenário sofisticado com taças de champanhe, confetes dourados e iluminação cinematográfica de gala.",
    promptTemplate: ({ name, age }) =>
      `Ultra-realistic professional luxury celebration photograph for a birthday celebration. Elegant crystal glasses, golden champagne sparkles, floating delicate gold and bronze bokeh confetti, warm cinematic rim lighting, minimalist dark marble and polished brass background, studio photography, Hasselblad medium format, award-winning lighting${
        age ? `, celebrating ${age} years of life and success` : ""
      }, 8k resolution, crisp detail, no cartoon, hyperrealistic masterpiece.`,
  },
  gourmet_cake: {
    id: "gourmet_cake",
    label: "Bolo Gourmet de Estúdio",
    emoji: "🎂",
    description: "Fotografia gastronômica de revista: bolo artesanal elegante com vela comemorativa e iluminação suave.",
    promptTemplate: ({ name, age }) =>
      `Exquisite artisanal birthday cake macro studio food photography. Decorated with delicate edible 24k gold leaf flakes, fresh ripe berries, single elegant sparkling celebration candle flame, soft warm golden hour light, blurred luxury kitchen studio background, Vogue lifestyle magazine editorial quality, shallow depth of field, appetizing and ultra high resolution${
        age ? `, celebrating ${age}th birthday` : ""
      }.`,
  },
  corporate_achievement: {
    id: "corporate_achievement",
    label: "Sucesso & Conquista Corporativa",
    emoji: "🌟",
    description: "Conceito inspirador de triunfo profissional, luz do amanhecer sobre arquitetura moderna de vidro.",
    promptTemplate: ({ name, company }) =>
      `Inspiring professional corporate achievement visual art celebrating excellence and success. Elegant glass architectural atrium bathed in a golden triumphant morning sunrise, subtle radiant light rays, refined minimal corporate trophy crystal aesthetic, modern professional workplace feeling, symbolizing career milestones for ${company}, high aesthetic, 8k cinematic realism.`,
  },
  warm_botanical: {
    id: "warm_botanical",
    label: "Acolhimento & Elegância Natural",
    emoji: "🌿",
    description: "Flores nobres, luz natural aconchegante e sensação calorosa de carinho e respeito da equipe.",
    promptTemplate: ({ name }) =>
      `Warm cozy high-end lifestyle celebration still-life photography. Beautiful bouquet of eucalyptus, white peonies and delicate gold ribbon, warm natural window sunlight casting soft shadows, elegant greeting card on natural oak wood table, heartwarming, peaceful, premium Scandinavian interior aesthetic, sharp focus, aesthetic composition.`,
  },
};

/**
 * Monta o prompt em inglês otimizado para o modelo de geração de imagem por IA.
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

