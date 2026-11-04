import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractText, getDocumentProxy } from "unpdf";

import { Prisma } from "@prisma/client";

import { geminiGenerate, generateWithModelInfo } from "@/lib/gemini";
import { parseCareer, type CareerProfile } from "@/server/models/career.model";
import { parseContactJson } from "@/server/models/intake.model";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoResumePath, isImageResumePath } from "@/server/models/application.model";
import {
  buildAnswersText,
  hasMaterial,
  parseChecklist,
  parseSegment,
  type ProfileSegment,
  type ChecklistItem,
  parseScoreResponse,
} from "@/server/models/ai.model";
import {
  createAgentRun,
  findApplicationById,
  updateAgentRun,
  updateApplicationAi,
} from "@/server/repositories/application.repository";
import { captureResumePhoto } from "@/server/services/resume-photo.service";
import { autoCategorizeTalent } from "@/server/services/talent.service";
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

export async function loadResumeBytes(resumePath: string): Promise<Uint8Array> {
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

/** MIME type inferido da extensão do caminho no Storage. */
function mimeFromPath(p: string): string {
  if (/\.png$/i.test(p)) return "image/png";
  if (/\.webp$/i.test(p)) return "image/webp";
  return "image/jpeg"; // .jpg / .jpeg
}

/**
 * Extrai texto de um currículo em imagem usando a visão da IA. Manda a foto
 * para o modelo com um prompt de OCR e recebe o texto de volta.
 */
async function extractTextFromImage(
  bytes: Uint8Array,
  mime: string,
  companyId?: string
): Promise<string> {
  const base64 = Buffer.from(bytes).toString("base64");
  return geminiGenerate({
    system:
      "Você é um leitor de documentos. Extraia TODO o texto visível na imagem, preservando a estrutura (seções, listas, datas). Não invente nada que não esteja escrito. Se a imagem não contiver texto legível, responda com uma string vazia.",
    prompt: "Extraia o texto completo deste currículo.",
    maxTokens: 4000,
    companyId,
    imageBase64: base64,
    imageMime: mime,
  });
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
Classifique também o perfil profissional pelo que o material mostra, sem dados pessoais:
- area: UMA PALAVRA só, a área mais ampla (ex.: "Logística", "Administrativo", "Vendas", "Atendimento", "Saúde", "Beleza", "Indústria", "TI"). Nunca combine duas áreas com "e".
- role: função principal em até 4 palavras, sempre no MASCULINO SINGULAR (ex.: "Promotor de vendas", "Motorista e entregador", "Consultor comercial", "Vendedor"). Nunca use feminino (promotora, vendedora, consultora).
- level: um de "Operacional", "Júnior", "Pleno", "Sênior", "Liderança"
Retorne JSON: { "criteria": [ { "criterion": "texto exato do critério", "met": "sim" | "parcial" | "não", "evidence": "trecho curto do material ou vazio" } ], "profile": { "area": "...", "role": "...", "level": "..." } }`;

/**
 * Checklist por critério + perfil resumido. Uma chamada só, separada do
 * AI_PROMPT (regra 3): explica a nota e sugere a pasta do banco de talentos,
 * mas não entra no cálculo da nota.
 */
async function buildChecklist(
  criteria: string[],
  material: string,
  companyId?: string
): Promise<{ checklist: ChecklistItem[] | null; segment: ProfileSegment }> {
  try {
    const raw = await geminiGenerate({
      system: CHECKLIST_PROMPT,
      prompt: `Critérios da vaga:\n${
        criteria.length > 0 ? criteria.map((c) => `- ${c}`).join("\n") : "(sem critérios: devolva a lista vazia)"
      }\n\nMaterial do candidato:\n${material}`,
      maxTokens: 700,
      json: true,
      companyId,
    });
    return {
      checklist: criteria.length > 0 ? parseChecklist(raw, criteria) : null,
      segment: parseSegment(raw),
    };
  } catch (error) {
    // Complementar: se falhar, a nota continua valendo.
    console.error("[ia] Falha no checklist por critério:", error);
    return { checklist: null, segment: { area: null, role: null, level: null } };
  }
}

type ScorableJob = { title: string; aiCriteria: string[]; requirements: string | null };

function composeMaterial(resumeText: string, answersText: string): string {
  return [
    resumeText.trim() && `Currículo do candidato:\n${resumeText.slice(0, MAX_RESUME_CHARS)}`,
    answersText && `Respostas do formulário de candidatura:\n${answersText.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Nota de aderência a uma vaga, sempre com o AI_PROMPT imutável (regra 3). */
async function scoreMaterial(
  job: ScorableJob,
  material: string,
  companyId?: string,
  model?: string
): Promise<{ score: number; reasoning: string; modelUsed: string }> {
  const criteria =
    job.aiCriteria.length > 0
      ? job.aiCriteria.map((c) => `- ${c}`).join("\n")
      : (job.requirements ?? "Sem critérios específicos.");
  const { text: raw, modelUsed } = await generateWithModelInfo({
    system: AI_PROMPT,
    prompt: `Vaga: ${job.title}\n\nCritérios de aderência:\n${criteria}\n\n${material}`,
    // Folga: alguns modelos escrevem justificativas longas e o JSON era cortado.
    maxTokens: 600,
    json: true,
    companyId,
    model,
  });
  const { score, reasoning } = parseScoreResponse(raw);
  return { score, reasoning, modelUsed };
}

/** Texto de um PDF ou imagem do Storage (ou da demonstração). */
export async function readResumeText(resumePath: string): Promise<string> {
  const bytes = await loadResumeBytes(resumePath);
  if (isImageResumePath(resumePath)) {
    return extractTextFromImage(bytes, mimeFromPath(resumePath));
  }
  const pdf = await getDocumentProxy(bytes);
  return (await extractText(pdf, { mergePages: true })).text;
}

/**
 * Lote de currículos: tira nome, e-mail e telefone do texto para o
 * pré-cadastro. Só contato — não avalia nada (a nota segue o AI_PROMPT).
 */
const CONTACT_PROMPT = `Extraia do currículo apenas os dados de contato do candidato.
Retorne JSON: { "name": "nome completo", "email": "e-mail ou vazio", "phone": "telefone ou vazio" }`;

export async function extractResumeContact(text: string) {
  const raw = await geminiGenerate({
    system: CONTACT_PROMPT,
    prompt: text.slice(0, 3000),
    maxTokens: 120,
    json: true,
  });
  return parseContactJson(raw);
}

/** Currículo (texto do PDF ou imagem) + respostas de uma candidatura, ou null sem material. */
export async function loadApplicationMaterial(applicationId: string): Promise<string | null> {
  const application = await findApplicationById(applicationId);
  if (!application) return null;
  const answersText = buildAnswersText(application.answers);
  let resumeText = "";
  if (application.resumeUrl) {
    const bytes = await loadResumeBytes(application.resumeUrl);
    if (isImageResumePath(application.resumeUrl)) {
      resumeText = await extractTextFromImage(
        bytes,
        mimeFromPath(application.resumeUrl),
        application.company?.id
      );
    } else {
      const pdf = await getDocumentProxy(bytes);
      resumeText = (await extractText(pdf, { mergePages: true })).text;
    }
  }
  if (!hasMaterial(resumeText, answersText)) return null;
  return composeMaterial(resumeText, answersText);
}

export type CandidateSummary = {
  applicationId: string;
  name: string;
  jobTitle: string;
  resumo: string;
  pontos_fortes: string[];
  justificativa: string;
  error?: string;
};

const SUMMARY_SYSTEM_PROMPT = `Você é um especialista em RH preparando um relatório conciso para a diretoria.
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Retorne JSON com exatamente estas 3 chaves:
{
  "resumo": "visão geral do perfil profissional em 2-3 linhas",
  "pontos_fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "justificativa": "1-2 frases explicando por que vale a pena entrevistar este candidato"
}`;

/** Resumo gerencial de uma candidatura para a diretoria. Prompt separado — não altera o AI_PROMPT (regra 3). */
export async function generateCandidateSummary(
  applicationId: string
): Promise<CandidateSummary> {
  const application = await findApplicationById(applicationId);
  if (!application) {
    return {
      applicationId,
      name: "Desconhecido",
      jobTitle: "",
      resumo: "",
      pontos_fortes: [],
      justificativa: "",
      error: "Candidatura não encontrada.",
    };
  }
  const material = await loadApplicationMaterial(applicationId);
  if (!material) {
    return {
      applicationId,
      name: application.name,
      jobTitle: application.job.title,
      resumo: "",
      pontos_fortes: [],
      justificativa: "",
      error: "Sem currículo ou respostas para analisar.",
    };
  }
  try {
    const raw = await geminiGenerate({
      system: SUMMARY_SYSTEM_PROMPT,
      prompt: `Vaga: ${application.job.title}\n\n${material}`,
      maxTokens: 500,
      json: true,
      companyId: application.company.id,
    });
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      resumo?: unknown;
      pontos_fortes?: unknown;
      justificativa?: unknown;
    };
    return {
      applicationId,
      name: application.name,
      jobTitle: application.job.title,
      resumo: String(parsed.resumo ?? "").slice(0, 600),
      pontos_fortes: Array.isArray(parsed.pontos_fortes)
        ? (parsed.pontos_fortes as unknown[]).map((p) => String(p).slice(0, 200)).slice(0, 5)
        : [],
      justificativa: String(parsed.justificativa ?? "").slice(0, 400),
    };
  } catch (error) {
    return {
      applicationId,
      name: application.name,
      jobTitle: application.job.title,
      resumo: "",
      pontos_fortes: [],
      justificativa: "",
      error: error instanceof Error ? error.message.slice(0, 200) : "Falha na IA.",
    };
  }
}

/**
 * Teste de modelos: a mesma nota da triagem (AI_PROMPT imutável, regra 3),
 * forçando um modelo. Não grava nada — só devolve a nota.
 */
export function scoreMaterialWithModel(
  job: ScorableJob,
  material: string,
  model: string
): Promise<{ score: number; reasoning: string }> {
  return scoreMaterial(job, material, undefined, model);
}

/**
 * Stand-by: nota do currículo de uma candidatura contra OUTRA vaga (banco de
 * talentos). Não grava nada na candidatura — quem chama guarda o resultado à
 * parte (TalentMatch). Sem material, devolve null.
 */
export async function scoreApplicationAgainstJob(
  applicationId: string,
  job: ScorableJob,
  companyId?: string
): Promise<{ score: number; reasoning: string } | null> {
  const material = await loadApplicationMaterial(applicationId);
  if (!material) return null;
  return scoreMaterial(job, material, companyId);
}

/**
 * Prompt da análise de perfil. Separado do AI_PROMPT (regra 3): não é a nota
 * de uma vaga, é uma leitura geral do currículo para orientar o gestor.
 */
const CAREER_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Você orienta um recrutador sobre onde este candidato seria mais bem aproveitado, sem pensar em uma vaga específica.
Escolha de 1 a 3 áreas em que ele seria um bom candidato e dê, para cada uma, uma nota estimada de 0 a 100 e o motivo em 1 frase, baseado só no material.
Sugira até 4 funções (cargos) e escreva um resumo de até 3 frases dizendo em que tipo de vaga ele seria bem aproveitado.
Retorne JSON: { "areas": [ { "area": "...", "score": 0-100, "why": "..." } ], "roles": ["..."], "summary": "..." }`;

/** Análise de perfil sob demanda. Sem material, devolve null. */
export async function analyzeCareerProfile(applicationId: string, companyId?: string): Promise<CareerProfile | null> {
  const material = await loadApplicationMaterial(applicationId);
  if (!material) return null;
  const raw = await geminiGenerate({
    system: CAREER_PROMPT,
    prompt: material,
    maxTokens: 700,
    json: true,
    companyId,
  });
  const career = parseCareer(raw);
  if (!career) throw new Error("A IA não devolveu uma análise de perfil válida.");
  return career;
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
      const isImage = isImageResumePath(application.resumeUrl);
      await onStep(isImage ? "Baixando o currículo (imagem)" : "Baixando o currículo em PDF");
      const bytes = await loadResumeBytes(application.resumeUrl);

      if (isImage) {
        // Currículo em foto: usa a visão da IA para extrair o texto.
        await onStep("Lendo o texto da imagem com IA");
        resumeText = await extractTextFromImage(
          bytes,
          mimeFromPath(application.resumeUrl),
          application.company.id
        );
        // Foto do candidato: para imagens, não faz sentido extrair retrato
        // (a imagem inteira É o currículo).
      } else {
        await onStep("Lendo o texto do PDF");
        const pdf = await getDocumentProxy(bytes);
        resumeText = (await extractText(pdf, { mergePages: true })).text;

        // Foto: referência visual para o gestor — sempre tentada, mesmo em PDFs
        // com pouco texto extraído. captureResumePhoto retorna false sem lançar
        // se não encontrar imagem com cara de foto. A IA não recebe a foto (regra 3).
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
      // Sem texto extraído e sem respostas úteis.
      await updateApplicationAi(applicationId, { aiState: "NO_RESUME" });
      return null;
    }

    const criteriaList = application.job.aiCriteria;
    const material = composeMaterial(resumeText, answersText);

    await onStep(
      `Comparando ${material.length.toLocaleString("pt-BR")} caracteres com os critérios da vaga`
    );
    // modelUsed: o modelo que DE FATO deu a nota (pode ser a reserva, se o escolhido falhou).
    const { score, reasoning, modelUsed } = await scoreMaterial(application.job, material, application.company.id);

    await onStep(
      criteriaList.length > 0 ? "Conferindo critério por critério" : "Resumindo o perfil"
    );
    const { checklist, segment } = await buildChecklist(criteriaList, material, application.company.id);

    await updateApplicationAi(applicationId, {
      aiScore: score,
      aiReasoning: reasoning,
      aiModel: modelUsed,
      aiChecklist: checklist ?? Prisma.DbNull,
      aiProfile: segment.role,
      aiArea: segment.area,
      aiLevel: segment.level,
      resumeText: resumeText.trim() ? resumeText.trim().slice(0, 100_000) : undefined,
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

      // Categorização automática: adiciona ao banco de talentos pela área/perfil
      // identificados pela IA. Roda em background para não atrasar o fluxo.
      if (result) {
        try {
          const fresh = await findApplicationById(applicationId);
          if (fresh) {
            await autoCategorizeTalent(fresh.company.id, applicationId, {
              area: fresh.aiArea,
              role: fresh.aiProfile,
            });
          }
        } catch (e) {
          // Falha na categorização não deve afetar o resultado da triagem.
          console.error("[triagem] Falha na categorização automática:", e);
        }
      }

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

/**
 * Prompt das perguntas do gestor sobre um candidato. Separado do AI_PROMPT
 * (regra 3): não gera nota, só esclarece o que o material mostra.
 */
const ASK_PROMPT = `Você ajuda um recrutador a entender melhor um candidato a partir do currículo e das respostas dele.
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Responda em português, de forma direta e curta (até 6 linhas), usando só o que está no material.
Se o material não permitir responder, diga isso com clareza; nunca invente.
Experiência e nível que o próprio candidato declarou no formulário não foram incluídos: se o recrutador perguntar sobre isso, use só o que o currículo mostra.
Você não decide nada: a decisão é do recrutador.`;

/** Pergunta livre do gestor sobre uma candidatura. Não grava nada nem mexe em nota ou etapa. */
export async function askAboutApplication(
  companyId: string,
  applicationId: string,
  question: string
): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  const application = await findApplicationById(applicationId);
  if (!application || application.company.id !== companyId) {
    return { ok: false, error: "Candidatura não encontrada." };
  }
  const q = question.trim().slice(0, 500);
  if (q.length < 3) return { ok: false, error: "Escreva a sua pergunta." };

  const answersText = buildAnswersText(application.answers);
  let resumeText = application.resumeText ?? "";
  if (!resumeText.trim() && application.resumeUrl) {
    try {
      resumeText = await readResumeText(application.resumeUrl);
    } catch {
      resumeText = "";
    }
  }
  if (!hasMaterial(resumeText, answersText)) {
    return { ok: false, error: "Não há currículo legível nem respostas para a IA consultar." };
  }

  const criteria =
    application.job.aiCriteria.length > 0
      ? application.job.aiCriteria.map((c) => `- ${c}`).join("\n")
      : "(sem critérios definidos)";
  try {
    const answer = await geminiGenerate({
      system: ASK_PROMPT,
      prompt: `Vaga: ${application.job.title}
Critérios da vaga:
${criteria}

${composeMaterial(resumeText, answersText)}

Pergunta do recrutador: ${q}`,
      maxTokens: 500,
      companyId,
    });
    const text = answer.trim();
    return text ? { ok: true, answer: text } : { ok: false, error: "A IA não devolveu resposta. Tente de novo." };
  } catch (error) {
    console.error("[ia] Falha ao responder pergunta do gestor:", error);
    return { ok: false, error: "Não consegui falar com a IA agora. Tente de novo em instantes." };
  }
}
