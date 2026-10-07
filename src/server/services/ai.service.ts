import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractText, getDocumentProxy } from "unpdf";

import { Prisma } from "@prisma/client";

import { AI_MODEL_ID, geminiGenerate } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoResumePath } from "@/server/models/application.model";
import {
  buildAnswersText,
  hasMaterial,
  parseChecklist,
  type ChecklistItem,
} from "@/server/models/ai.model";
import {
  createAgentRun,
  findApplicationById,
  updateAgentRun,
  updateApplicationAi,
} from "@/server/repositories/application.repository";
import { captureResumePhoto } from "@/server/services/resume-photo.service";
import { RESUMES_BUCKET } from "@/server/services/resume-storage.service";

/**
 * Currículo de demonstração: fica em /public/demo e é empacotado junto com a
 * função (outputFileTracingIncludes no next.config). Ler do disco evita o
 * fetch para NEXT_PUBLIC_APP_URL, que falhava ("fetch failed") quando a URL
 * estava errada ou o deploy tinha proteção de acesso.
 */
export async function readDemoResume(resumePath: string): Promise<Uint8Array> {
  const publicDir = path.join(process.cwd(), "public");
  const file = path.normalize(path.join(publicDir, resumePath));
  if (!file.startsWith(publicDir + path.sep)) {
    throw new Error("Caminho de currículo demo inválido.");
  }
  return new Uint8Array(await readFile(file));
}

async function loadResumeBytes(resumePath: string): Promise<Uint8Array> {
  if (isDemoResumePath(resumePath)) return readDemoResume(resumePath);

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .download(resumePath);
  if (error || !data) {
    throw new Error(`Falha ao baixar currículo: ${error?.message}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Regra 3: prompt da IA — NÃO ALTERAR. */
const AI_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Retorne JSON: { "score": 0-100, "reasoning": "máximo 2 frases" }`;

const MAX_RESUME_CHARS = 12000;

/** Etapa da triagem, mostrada ao vivo na tela de agentes. */
export type TriageStepReporter = (label: string) => Promise<void>;

/**
 * Prompt do checklist por critério. Separado do AI_PROMPT (regra 3): o
 * checklist só explica a nota ao gestor e não entra no cálculo dela.
 */
const CHECKLIST_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Para cada critério da vaga, diga se o material do candidato mostra evidência.
Retorne JSON: { "criteria": [ { "criterion": "texto exato do critério", "met": "sim" | "parcial" | "não", "evidence": "trecho curto do material ou vazio" } ] }`;

async function buildChecklist(
  criteria: string[],
  material: string
): Promise<ChecklistItem[] | null> {
  if (criteria.length === 0) return null;
  try {
    const raw = await geminiGenerate({
      system: CHECKLIST_PROMPT,
      prompt: `Critérios da vaga:\n${criteria.map((c) => `- ${c}`).join("\n")}\n\nMaterial do candidato:\n${material}`,
      maxTokens: 600,
      json: true,
    });
    return parseChecklist(raw, criteria);
  } catch (error) {
    // O checklist é complementar: se falhar, a nota continua valendo.
    console.error("[ia] Falha no checklist por critério:", error);
    return null;
  }
}

/**
 * Análise de aderência em background. Só escreve aiScore/aiReasoning/aiState
 * (e o modelo/checklist que explicam a nota); o AppStatus é decisão manual do
 * gestor, sempre. Usa o currículo em PDF e as respostas do formulário — toda
 * candidatura com material é analisada, com ou sem PDF.
 */
export async function analyzeApplication(
  applicationId: string,
  onStep: TriageStepReporter = async () => {}
): Promise<{ score: number } | null> {
  const application = await findApplicationById(applicationId);
  if (!application) return null;

  const answersText = buildAnswersText(application.answers);
  if (!application.resumeUrl && !hasMaterial("", answersText)) {
    await updateApplicationAi(applicationId, { aiState: "NO_RESUME" });
    return null;
  }

  await updateApplicationAi(applicationId, { aiState: "PROCESSING" });

  try {
    let resumeText = "";
    if (application.resumeUrl) {
      await onStep("Baixando o currículo em PDF");
      const bytes = await loadResumeBytes(application.resumeUrl);

      await onStep("Lendo o texto do PDF");
      const pdf = await getDocumentProxy(bytes);
      resumeText = (await extractText(pdf, { mergePages: true })).text;

      // Foto: só referência visual para o gestor. Fica fora do material da
      // IA (regra 3). PDF sem texto é página escaneada, não tem foto à parte.
      if (resumeText.trim().length >= 40) {
        await captureResumePhoto(pdf, {
          companyId: application.company.id,
          applicationId,
          currentPath: application.photoPath ?? null,
        });
      }
    } else {
      await onStep("Sem PDF: lendo as respostas do formulário");
    }

    if (!hasMaterial(resumeText, answersText)) {
      // PDF escaneado (imagem) sem texto e sem respostas úteis.
      await updateApplicationAi(applicationId, { aiState: "NO_RESUME" });
      return null;
    }

    const criteriaList = application.job.aiCriteria;
    const criteria =
      criteriaList.length > 0
        ? criteriaList.map((c) => `- ${c}`).join("\n")
        : (application.job.requirements ?? "Sem critérios específicos.");

    const material = [
      resumeText.trim() && `Currículo do candidato:\n${resumeText.slice(0, MAX_RESUME_CHARS)}`,
      answersText && `Respostas do formulário de candidatura:\n${answersText.slice(0, 4000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await onStep(
      `Comparando ${material.length.toLocaleString("pt-BR")} caracteres com os critérios da vaga`
    );
    const raw = await geminiGenerate({
      system: AI_PROMPT,
      prompt: `Vaga: ${application.job.title}\n\nCritérios de aderência:\n${criteria}\n\n${material}`,
      maxTokens: 300,
      json: true,
    });

    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      score?: unknown;
      reasoning?: unknown;
    };
    const score = Math.round(Number(parsed.score));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Score inválido retornado pela IA: ${raw}`);
    }

    if (criteriaList.length > 0) await onStep("Conferindo critério por critério");
    const checklist = await buildChecklist(criteriaList, material);

    await updateApplicationAi(applicationId, {
      aiScore: score,
      aiReasoning: String(parsed.reasoning ?? "").slice(0, 500),
      aiModel: AI_MODEL_ID,
      aiChecklist: checklist ?? Prisma.DbNull,
      aiState: "DONE",
    });
    return { score };
  } catch (error) {
    await updateApplicationAi(applicationId, { aiState: "FAILED" });
    throw error;
  }
}

/**
 * Triagem com rastro no AgentRun (tela /agentes). Usada pelo job do Inngest,
 * pelo fallback em `after()` quando o Inngest não está disponível e pela
 * demonstração. Se `runId` vier, reaproveita o registro já criado (QUEUED).
 *
 * Se a função for congelada no meio, o registro fica RUNNING — o watchdog
 * (agent-watchdog.service) o marca como FAILED depois de 5 minutos.
 */
export async function runTriageWithTracking(
  applicationId: string,
  options: {
    eventName: string;
    runId?: string;
    rethrow?: boolean;
    /** Pausa após cada etapa (só na simulação, para dar tempo de ver). */
    stepPauseMs?: number;
    /**
     * Tentativas em caso de erro (IA fora do ar, limite de uso). O Inngest já
     * tenta de novo sozinho, então lá fica 1; no plano B em after(), 3.
     */
    maxAttempts?: number;
  }
): Promise<void> {
  const application = await findApplicationById(applicationId);
  if (!application) return;

  const runId =
    options.runId ??
    (
      await createAgentRun({
        companyId: application.company.id,
        applicationId,
        agent: "TRIAGE",
        eventName: options.eventName,
      })
    ).id;

  const startedAt = new Date();
  const pause = options.stepPauseMs ?? 0;
  const step: TriageStepReporter = async (label) => {
    await updateAgentRun(runId, { summary: label });
    if (pause > 0) await new Promise((r) => setTimeout(r, pause));
  };

  await updateAgentRun(runId, {
    status: "RUNNING",
    attempts: 1,
    startedAt,
    summary: `Iniciando a análise de ${application.name}`,
  });

  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const waitMs = attempt === 2 ? 2000 : 6000;
      await updateAgentRun(runId, {
        attempts: attempt,
        summary: `Tentando de novo (${attempt}/${maxAttempts})`,
      });
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      const result = await analyzeApplication(applicationId, step);
      await updateAgentRun(runId, {
        status: "SUCCEEDED",
        attempts: attempt,
        summary: result
          ? `Nota ${result.score}/100 para ${application.name}`
          : `${application.name} sem material para analisar (sem PDF legível nem respostas)`,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      return;
    } catch (error) {
      lastError = error;
      console.error(`[triagem] Tentativa ${attempt}/${maxAttempts} falhou:`, error);
    }
  }

  await updateAgentRun(runId, {
    status: "FAILED",
    attempts: maxAttempts,
    error:
      lastError instanceof Error
        ? lastError.message.slice(0, 500)
        : "Falha desconhecida.",
    durationMs: Date.now() - startedAt.getTime(),
    finishedAt: new Date(),
  });
  if (options.rethrow) throw lastError;
}
