import "server-only";

import {
  findLiveDoubtsRaw,
  saveLiveDoubtsRaw,
} from "@/server/repositories/live-doubt.repository";
import { getPublicCompanyBySlug } from "@/server/services/company.service";
import type {
  LiveDoubt,
  SubmitLiveDoubtInput,
} from "@/server/models/live-doubt.model";

export async function listLiveDoubtsForCompany(
  companyId: string
): Promise<LiveDoubt[]> {
  try {
    const raw = await findLiveDoubtsRaw(companyId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function submitLiveDoubtService(
  input: SubmitLiveDoubtInput
): Promise<{ ok: boolean; doubt?: LiveDoubt; error?: string }> {
  try {
    const company = await getPublicCompanyBySlug(input.companySlug);
    if (!company) {
      return { ok: false, error: "Empresa não encontrada" };
    }

    const current = await listLiveDoubtsForCompany(company.id);

    const newDoubt: LiveDoubt = {
      id: `doubt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companySlug: company.slug,
      candidateName: input.candidateName.trim(),
      contact: input.contact?.trim() || null,
      question: input.question.trim(),
      path: input.path?.trim() || null,
      createdAt: new Date().toISOString(),
      status: "pending",
      answer: null,
      answeredAt: null,
      answeredBy: null,
    };

    // Mantém as 100 dúvidas mais recentes
    const updated = [newDoubt, ...current].slice(0, 100);
    await saveLiveDoubtsRaw(company.id, JSON.stringify(updated));

    return { ok: true, doubt: newDoubt };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao registrar dúvida" };
  }
}

export async function answerLiveDoubtService(params: {
  companyId: string;
  doubtId: string;
  answer: string;
  answeredBy: string;
}): Promise<{ ok: boolean; doubt?: LiveDoubt; error?: string }> {
  try {
    const current = await listLiveDoubtsForCompany(params.companyId);
    let targetDoubt: LiveDoubt | undefined;

    const updated = current.map((d) => {
      if (d.id === params.doubtId) {
        targetDoubt = {
          ...d,
          status: "answered",
          answer: params.answer.trim(),
          answeredAt: new Date().toISOString(),
          answeredBy: params.answeredBy.trim(),
        };
        return targetDoubt;
      }
      return d;
    });

    if (!targetDoubt) {
      return { ok: false, error: "Dúvida não encontrada" };
    }

    await saveLiveDoubtsRaw(params.companyId, JSON.stringify(updated));
    return { ok: true, doubt: targetDoubt };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao responder dúvida" };
  }
}

