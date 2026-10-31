import "server-only";

import { readChecklist } from "@/server/models/ai.model";
import { profileChoiceLabel } from "@/server/models/application.model";
import {
  buildReportData,
  type ReportCandidate,
  type ReportData,
} from "@/server/models/report.model";
import { titleCasePt, toPdfSafeText } from "@/server/models/text.model";
import { findApplicationsForReport } from "@/server/repositories/application.repository";
import { getCompanyById } from "@/server/services/company.service";
import { getCompanyJob } from "@/server/services/job.service";
import { analyzeJobShortlist } from "@/server/services/shortlist.service";

const safe = (v: string | null): string | null => (v === null ? null : toPdfSafeText(v));

/** Tempo máximo esperando o comparativo da IA: o PDF sai sempre, com ou sem ele. */
export const REPORT_AI_TIMEOUT_MS = 25_000;

export type FinalistNotes = Record<string, { reason: string; strengths: string[]; concerns: string[] }>;

export type JobReport = {
  data: ReportData;
  company: { name: string; brand: string };
  /** Comparativo da IA para os melhores (null se não pedido ou se a IA falhou). */
  notes: FinalistNotes | null;
};

/**
 * Reúne o que o relatório da diretoria precisa. A avaliação de cada candidato
 * entra como está gravada (leitura da IA e checklist); nada é recalculado nem
 * reescrito. Só a posição e o índice vêm de contas sobre essas notas.
 */
export async function loadJobReportData(
  companyId: string,
  jobId: string,
  withAiComparison: boolean
): Promise<JobReport | null> {
  const job = await getCompanyJob(companyId, jobId);
  if (!job) return null;
  const company = await getCompanyById(companyId);
  if (!company) return null;

  const rows = await findApplicationsForReport(companyId, jobId);
  const candidates: ReportCandidate[] = rows.map((r) => ({
    id: r.id,
    name: toPdfSafeText(titleCasePt(r.name)),
    status: r.status,
    aiScore: r.aiScore,
    aiReasoning: safe(r.aiReasoning),
    criteria: readChecklist(r.aiChecklist).map((k) => ({
      criterion: toPdfSafeText(k.criterion),
      met: k.met,
      evidence: toPdfSafeText(k.evidence),
    })),
    aiProfile: safe(r.aiProfile),
    aiArea: safe(r.aiArea),
    aiLevel: safe(r.aiLevel),
    salaryExpectation: safe(r.salaryExpectation),
    availability: r.availability ? profileChoiceLabel("availability", r.availability) || r.availability : null,
    city: safe(r.city),
    neighborhood: safe(r.neighborhood),
    createdAt: r.createdAt,
  }));

  const data = buildReportData(
    { title: job.title, code: job.code, aiMinScore: job.aiMinScore, criteria: job.aiCriteria },
    candidates,
    new Date()
  );

  let notes: FinalistNotes | null = null;
  if (withAiComparison) {
    try {
      const result = await Promise.race([
        analyzeJobShortlist(companyId, jobId, 5),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), REPORT_AI_TIMEOUT_MS)),
      ]);
      if (result?.ok) {
        notes = Object.fromEntries(
          result.picks.map((p) => [
            p.applicationId,
            {
              reason: toPdfSafeText(p.reason),
              strengths: p.strengths.map(toPdfSafeText),
              concerns: p.concerns.map(toPdfSafeText),
            },
          ])
        );
      }
    } catch {
      notes = null; // o relatório sai sem o comparativo da IA
    }
  }

  return { data, company: { name: company.name, brand: company.primaryColor }, notes };
}
