"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/server/controllers/guards";
import {
  submitLiveDoubtSchema,
  answerLiveDoubtSchema,
  type SubmitLiveDoubtInput,
  type AnswerLiveDoubtInput,
  type LiveDoubt,
} from "@/server/models/live-doubt.model";
import {
  listLiveDoubtsForCompany,
  submitLiveDoubtService,
  answerLiveDoubtService,
} from "@/server/services/live-doubt.service";

/** Envia uma nova dúvida ao vivo pelo portal do candidato (público). */
export async function submitLiveDoubtAction(
  rawInput: SubmitLiveDoubtInput
): Promise<{ ok: boolean; doubt?: LiveDoubt; error?: string }> {
  const parsed = submitLiveDoubtSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" };
  }
  return submitLiveDoubtService(parsed.data);
}

/** Lê todas as dúvidas da empresa ativa do gestor. */
export async function getLiveDoubtsAction(): Promise<LiveDoubt[]> {
  const user = await requireManager();
  return listLiveDoubtsForCompany(user.companyId);
}

/** Responde uma dúvida ao vivo (somente gestor autenticado do tenant). */
export async function answerLiveDoubtAction(
  rawInput: AnswerLiveDoubtInput
): Promise<{ ok: boolean; doubt?: LiveDoubt; error?: string }> {
  const user = await requireManager();
  const parsed = answerLiveDoubtSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" };
  }

  const res = await answerLiveDoubtService({
    companyId: user.companyId,
    doubtId: parsed.data.doubtId,
    answer: parsed.data.answer,
    answeredBy: user.name || user.email || "Recrutador Tárguet",
  });

  if (res.ok) {
    revalidatePath("/", "layout");
  }
  return res;
}

