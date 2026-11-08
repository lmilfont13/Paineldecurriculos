"use server";

import { requireManager } from "@/server/controllers/guards";
import {
  generateBirthdayAiImage,
  type GenerateBirthdayImageResult,
} from "@/server/services/birthday-image.service";
import type { BirthdayAiStyle } from "@/server/models/birthday-image.model";

/**
 * Ação para gerar imagem profissional de aniversário com IA para um candidato/colaborador.
 */
export async function generateBirthdayAiImageAction(params: {
  name: string;
  age?: number;
  companyName?: string;
  style?: BirthdayAiStyle;
  customPrompt?: string;
  seed?: number;
}): Promise<GenerateBirthdayImageResult> {
  await requireManager();

  return generateBirthdayAiImage({
    name: params.name,
    age: params.age,
    company: params.companyName,
    style: params.style,
    customPrompt: params.customPrompt,
    seed: params.seed,
  });
}

