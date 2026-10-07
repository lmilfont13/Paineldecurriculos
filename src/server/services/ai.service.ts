import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractText, getDocumentProxy } from "unpdf";

import { geminiGenerate } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoResumePath } from "@/server/models/application.model";
import {
  createAgentRun,
  findApplicationById,
  updateAgentRun,
  updateApplicationAi,
} from "@/server/repositories/application.repository";
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
 * Análise de aderência em background. Só escreve aiScore/aiReasoning/aiState;
 * o AppStatus é decisão manual do gestor, sempre. `onStep` recebe cada etapa
 * (baixar, ler, consultar a IA) para a tela de agentes; retorna a nota.
 */
export async function analyzeApplication(
  applicationId: string,
  onStep: TriageStepReporter = async () => {}
): Promise<{ score: number } | null> {
  const application = await findApplicationById(applicationId);
  if (!application) return null;

  if (!application.resumeUrl) {
    await updateApplicationAi(applicationId, { aiState: "NO_RESUME" });
    return null;
  }

  await updateApplicationAi(applicationId, { aiState: "PROCESSING" });

  try {
    await onStep("Baixando o currículo em PDF");
    const bytes = await loadResumeBytes(application.resumeUrl);

    await onStep("Lendo o texto do PDF");
    const pdf = await getDocumentProxy(bytes);
    const { text: resumeText } = await extractText(pdf, { mergePages: true });

    const criteria =
      application.job.aiCriteria.length > 0
        ? application.job.aiCriteria.map((c) => `- ${c}`).join("\n")
        : (application.job.requirements ?? "Sem critérios específicos.");

    await onStep(
      `Comparando ${resumeText.length.toLocaleString("pt-BR")} caracteres com os critérios da vaga`
    );
    const raw = await geminiGenerate({
      system: AI_PROMPT,
      prompt: `Vaga: ${application.job.title}\n\nCritérios de aderência:\n${criteria}\n\nCurrículo do candidato:\n${resumeText.slice(0, MAX_RESUME_CHARS)}`,
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

    await updateApplicationAi(applicationId, {
      aiScore: score,
      aiReasoning: String(parsed.reasoning ?? "").slice(0, 500),
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

  try {
    const result = await analyzeApplication(applicationId, step);
    await updateAgentRun(runId, {
      status: "SUCCEEDED",
      summary: result
        ? `Nota ${result.score}/100 para ${application.name}`
        : "Candidatura analisada pela IA.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
  } catch (error) {
    await updateAgentRun(runId, {
      status: "FAILED",
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Falha desconhecida.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
    if (options.rethrow) throw error;
  }
}
