import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { extractImages, extractText, getDocumentProxy } from "unpdf";

import { Prisma } from "@prisma/client";

import {
  geminiGenerate,
  generateWithModelInfo,
  type VisionAttachment,
} from "@/lib/gemini";
import { parseCareer, type CareerProfile } from "@/server/models/career.model";
import { parseContactJson } from "@/server/models/intake.model";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoResumePath, isImageResumePath } from "@/server/models/application.model";
import {
  buildAnswersText,
  hasMaterial,
  parseChecklist,
  parseSegment,
  parseTenureFromJson,
  type ProfileSegment,
  type ChecklistItem,
  parseScoreResponse,
} from "@/server/models/ai.model";
import {
  parseTenureAnalysis,
  type TenureAnalysis,
} from "@/server/models/tenure.model";
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

const MAX_OCR_SIDE = 1600;
const MAX_OCR_SLICES = 3;

const OCR_SYSTEM_PROMPT =
  "Você é um leitor óptico de documentos (OCR). Transcreva FIELMENTE todo o texto visível na imagem do currículo (se houver colunas lado a lado, leia da coluna da esquerda para a direita, de cima para baixo), preservando seções, cargos, empresas, datas, formação e cursos. PROIBIDO inventar, completar ou criar exemplos fictícios. Se não houver texto legível na imagem, responda apenas com a palavra VAZIO.";

function cleanOcrOutput(raw: string): string {
  const trimmed = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  if (!trimmed || /^vazio\.?$/i.test(trimmed)) return "";
  return trimmed;
}

/**
 * Normaliza uma imagem para leitura visual (OCR) e, quando ela é um print
 * vertical muito comprido (ex.: print de tela inteira da Catho de 720x5787),
 * monta as fatias lado a lado em 2 ou 3 colunas numa ÚNICA imagem quadrada
 * nítida. Isso mantém 100% da legibilidade das letras e envia apenas 1 imagem
 * por página, respeitando o limite de 8.000 tokens/minuto da Groq.
 */
async function sliceSharpImageForOcr(
  createInstance: () => sharp.Sharp,
  width: number,
  height: number
): Promise<VisionAttachment[]> {
  if (height > width * 2.1 && height > 1600) {
    try {
      const cols = Math.min(3, Math.max(2, Math.round(Math.sqrt(height / width))));
      const gap = 16;
      const overlap = Math.min(90, Math.round(height * 0.02));
      const colHeight = Math.ceil(height / cols) + overlap;
      const step = Math.max(1, Math.floor((height - overlap) / cols));
      const composites: sharp.OverlayOptions[] = [];

      for (let c = 0; c < cols; c++) {
        const top = Math.min(c * step, Math.max(0, height - 1));
        const h = Math.min(colHeight, height - top);
        if (h < 40) break;
        const part = await createInstance()
          .extract({ left: 0, top, width, height: h })
          .flatten({ background: "#ffffff" })
          .png()
          .toBuffer();
        composites.push({ input: part, left: c * (width + gap), top: 0 });
      }

      const totalW = cols * width + (cols - 1) * gap;
      const stitched = await sharp({
        create: {
          width: totalW,
          height: colHeight,
          channels: 3,
          background: { r: 242, g: 242, b: 242 },
        },
      })
        .composite(composites)
        .png()
        .toBuffer();

      const buf = await sharp(stitched)
        .resize(MAX_OCR_SIDE, MAX_OCR_SIDE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer();

      return [{ base64: buf.toString("base64"), mime: "image/jpeg" }];
    } catch (error) {
      console.error("[ia] Falha ao montar colunas de imagem longa para OCR:", error);
    }
  }

  const buf = await createInstance()
    .resize(MAX_OCR_SIDE, MAX_OCR_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return [{ base64: buf.toString("base64"), mime: "image/jpeg" }];
}

async function prepareImageAttachments(
  bytes: Uint8Array,
  mime: string
): Promise<VisionAttachment[]> {
  try {
    const buffer = Buffer.from(bytes);
    const meta = await sharp(buffer).metadata();
    if (meta.width && meta.height) {
      return await sliceSharpImageForOcr(() => sharp(buffer), meta.width, meta.height);
    }
  } catch {
    // Fallback se o buffer não puder ser processado pelo sharp
  }
  return [{ base64: Buffer.from(bytes).toString("base64"), mime }];
}

/**
 * Envia cada página/imagem individualmente com limite de tokens enxuto para
 * caber na cota de 8.000 tokens/minuto da Groq junto com a nota e o checklist.
 */
async function extractTextFromAttachments(
  attachments: VisionAttachment[],
  companyId?: string
): Promise<string> {
  if (attachments.length === 0) return "";

  const parts: string[] = [];

  for (const att of attachments.slice(0, MAX_OCR_SLICES)) {
    try {
      const raw = await geminiGenerate({
        system: OCR_SYSTEM_PROMPT,
        prompt: "Transcreva fielmente todo o texto visível neste currículo.",
        maxTokens: 1800,
        companyId,
        imageBase64: att.base64,
        imageMime: att.mime,
      });
      const cleaned = cleanOcrOutput(raw);
      if (cleaned) parts.push(cleaned);
    } catch (error) {
      console.error("[ia] Falha ao ler página em imagem no OCR:", error);
    }
  }

  return parts.join("\n\n");
}

/**
 * Extrai texto de um currículo em imagem usando a visão da IA. Manda a foto
 * (ou fatias, se for um print comprido) para o modelo com um prompt de OCR.
 */
async function extractTextFromImage(
  bytes: Uint8Array,
  mime: string,
  companyId?: string
): Promise<string> {
  const attachments = await prepareImageAttachments(bytes, mime);
  return extractTextFromAttachments(attachments, companyId);
}

/**
 * Procura streams JPEG brutos (FF D8 FF ... FF D9) diretamente nos bytes do
 * PDF como plano B caso o operador do PDF.js não exponha a imagem via unpdf.
 */
async function extractRawJpegsFromPdfBytes(bytes: Uint8Array): Promise<VisionAttachment[]> {
  const attachments: VisionAttachment[] = [];
  const len = bytes.length;
  let pos = 0;

  while (pos < len - 10 && attachments.length < MAX_OCR_SLICES) {
    // Procura assinatura JPEG: 0xFF 0xD8 0xFF
    if (bytes[pos] === 0xff && bytes[pos + 1] === 0xd8 && bytes[pos + 2] === 0xff) {
      // Procura fim do stream JPEG antes de "endstream"
      let end = -1;
      for (let j = pos + 4; j < len - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          end = j + 2;
          // Continua se for apenas thumbnail EXIF interno antes do fim real
          if (end - pos > 4096) break;
        }
      }
      if (end > pos + 2048) {
        try {
          const candidate = Buffer.from(bytes.subarray(pos, end));
          const meta = await sharp(candidate).metadata();
          if (meta.width && meta.height && meta.width >= 200 && meta.height >= 200) {
            const slices = await sliceSharpImageForOcr(
              () => sharp(candidate),
              meta.width,
              meta.height
            );
            for (const s of slices) {
              if (attachments.length < MAX_OCR_SLICES) attachments.push(s);
            }
            pos = end;
            continue;
          }
        } catch {
          // Não era um JPEG completo/válido
        }
      }
    }
    pos++;
  }

  return attachments;
}

/**
 * Extrai as imagens embutidas nas páginas de um PDF escaneado (ou print salvo
 * como PDF, como currículos exportados em imagem da Catho) e converte em
 * fatias JPEG nítidas para leitura por visão da IA.
 */
async function extractPdfImagesForOcr(
  bytes: Uint8Array,
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>
): Promise<VisionAttachment[]> {
  const attachments: VisionAttachment[] = [];
  const maxPages = Math.min(pdf.numPages ?? 1, 4);

  for (let pageNum = 1; pageNum <= maxPages && attachments.length < MAX_OCR_SLICES; pageNum++) {
    let images: {
      data: Uint8Array | Uint8ClampedArray;
      width: number;
      height: number;
      channels: number;
    }[] = [];
    try {
      images = await extractImages(pdf, pageNum);
    } catch {
      continue;
    }
    if (!images.length) continue;

    const valid = images.filter(
      (img) =>
        img.width >= 200 &&
        img.height >= 200 &&
        (img.channels === 1 || img.channels === 3 || img.channels === 4) &&
        img.data.length === img.width * img.height * img.channels
    );
    if (!valid.length) continue;

    const sorted = [...valid].sort((a, b) => b.width * b.height - a.width * a.height);
    const maxArea = sorted[0].width * sorted[0].height;
    const relevant = sorted.filter((img) => img.width * img.height >= maxArea * 0.2);

    for (const img of relevant) {
      if (attachments.length >= MAX_OCR_SLICES) break;
      try {
        const rawBuf = Buffer.from(img.data);
        const channels = img.channels as 1 | 3 | 4;
        const slices = await sliceSharpImageForOcr(
          () => sharp(rawBuf, { raw: { width: img.width, height: img.height, channels } }),
          img.width,
          img.height
        );
        for (const s of slices) {
          if (attachments.length < MAX_OCR_SLICES) attachments.push(s);
        }
      } catch (error) {
        console.error("[ia] Falha ao preparar imagem do PDF para OCR:", error);
      }
    }
  }

  if (attachments.length === 0) {
    return extractRawJpegsFromPdfBytes(bytes);
  }

  return attachments;
}

/**
 * Lê o texto de um PDF: usa a camada de texto nativa quando disponível e, se o
 * PDF for uma imagem escaneada / print sem texto selecionável (< 200 chars),
 * aciona automaticamente a leitura visual (OCR) com IA.
 */
async function extractPdfTextWithVision(
  bytes: Uint8Array,
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  companyId?: string,
  onStep?: TriageStepReporter
): Promise<string> {
  const nativeText = (await extractText(pdf, { mergePages: true })).text ?? "";
  if (nativeText.trim().length >= 200) {
    return nativeText;
  }

  await onStep?.("PDF em imagem detectado: lendo o texto com visão da IA");

  let ocrText = "";
  const imageAttachments = await extractPdfImagesForOcr(bytes, pdf);
  if (imageAttachments.length > 0) {
    try {
      ocrText = await extractTextFromAttachments(imageAttachments, companyId);
    } catch (error) {
      console.error("[ia] Falha no OCR das imagens do PDF:", error);
    }
  }

  if (ocrText.trim().length >= nativeText.trim().length) {
    return [nativeText.trim(), ocrText.trim()].filter(Boolean).join("\n\n");
  }
  return nativeText;
}

/** Regra 3: prompt da IA — NÃO ALTERAR. */
const AI_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Retorne JSON: { "score": 0-100, "reasoning": "máximo 2 frases" }`;

const MAX_RESUME_CHARS = 12000;

/** Etapa da triagem, mostrada ao vivo na tela de agentes. */
export type TriageStepReporter = (label: string) => Promise<void>;

/**
 * Prompt do checklist por critério e análise de permanência nas empresas.
 * Separado do AI_PROMPT (regra 3): o checklist e a durabilidade apenas explicam
 * a nota e o perfil ao gestor e não entram no cálculo dela.
 */
const CHECKLIST_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Para cada critério da vaga, diga se o material do candidato mostra evidência.
Classifique também o perfil profissional pelo que o material mostra, sem dados pessoais:
- area: UMA PALAVRA só, a área mais ampla (ex.: "Logística", "Administrativo", "Vendas", "Atendimento", "Saúde", "Beleza", "Indústria", "TI"). Nunca combine duas áreas com "e".
- role: função principal em até 4 palavras, sempre no MASCULINO SINGULAR (ex.: "Promotor de vendas", "Motorista e entregador", "Consultor comercial", "Vendedor"). Nunca use feminino (promotora, vendedora, consultora).
- level: um de "Operacional", "Júnior", "Pleno", "Sênior", "Liderança"
Analise também a durabilidade e o tempo de permanência em cada empresa onde houver histórico de TRABALHO ou EMPREGO anterior no material:
- empresas: lista de até 6 empresas onde o candidato trabalhou, cada uma com:
  - empresa: nome da EMPRESA onde trabalhou (REGRA CRÍTICA: NUNCA coloque o nome do candidato, data de nascimento, telefone, endereço, cabeçalho ou dados pessoais aqui. Apenas a empresa real)
  - cargo: função ou cargo desempenhado
  - periodo: texto do período de trabalho (ex.: "Jan/2021 a Mar/2023", "2019 - 2021", "2023 - Atual"). NUNCA use data de nascimento nem ano de formação escolar/faculdade como período de trabalho.
  - meses: duração estimada do emprego em meses inteiros (ex.: 26 para 2 anos e 2 meses). Se for nascimento ou formatura, NÃO inclua.
- tempoMedioMeses: média de meses nas empresas trabalhadas
- resumo: 1 frase concisa resumindo a estabilidade profissional do candidato (se costuma ter boa permanência ou se apresenta histórico de rotatividade rápida com passagens curtas). Se não houver histórico de empregos com datas, devolva "empresas": [] e tempoMedioMeses: 0.

Retorne JSON: {
  "criteria": [ { "criterion": "texto exato do critério", "met": "sim" | "parcial" | "não", "evidence": "trecho curto do material ou vazio" } ],
  "profile": { "area": "...", "role": "...", "level": "..." },
  "tenure": {
    "tempoMedioMeses": 18,
    "resumo": "...",
    "empresas": [
      { "empresa": "...", "cargo": "...", "periodo": "...", "meses": 14 }
    ]
  }
}`;

/**
 * Checklist por critério + perfil resumido + análise de permanência por empresa.
 * Uma chamada só, separada do AI_PROMPT (regra 3): explica a nota e orienta o gestor,
 * mas não entra no cálculo da nota.
 */
async function buildChecklist(
  criteria: string[],
  material: string,
  companyId?: string
): Promise<{
  checklist: ChecklistItem[] | null;
  segment: ProfileSegment;
  tenure: TenureAnalysis | null;
}> {
  try {
    const raw = await geminiGenerate({
      system: CHECKLIST_PROMPT,
      prompt: `Critérios da vaga:\n${criteria.length > 0 ? criteria.map((c) => `- ${c}`).join("\n") : "(sem critérios: devolva a lista vazia)"
        }\n\nMaterial do candidato:\n${material}`,
      maxTokens: 1100,
      json: true,
      companyId,
    });
    const parsedTenure = parseTenureAnalysis(parseTenureFromJson(raw));
    return {
      checklist: criteria.length > 0 ? parseChecklist(raw, criteria) : null,
      segment: parseSegment(raw),
      tenure: parsedTenure,
    };
  } catch (error) {
    // Complementar: se falhar, a nota continua valendo.
    console.error("[ia] Falha no checklist por critério e permanência:", error);
    return {
      checklist: null,
      segment: { area: null, role: null, level: null },
      tenure: null,
    };
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
  return extractPdfTextWithVision(bytes, pdf);
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
  let resumeText = application.resumeText ?? "";
  if (!resumeText.trim() && application.resumeUrl) {
    const bytes = await loadResumeBytes(application.resumeUrl);
    if (isImageResumePath(application.resumeUrl)) {
      resumeText = await extractTextFromImage(
        bytes,
        mimeFromPath(application.resumeUrl),
        application.company?.id
      );
    } else {
      const pdf = await getDocumentProxy(bytes);
      resumeText = await extractPdfTextWithVision(bytes, pdf, application.company?.id);
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
  onStep: TriageStepReporter = async () => { }
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
        resumeText = await extractPdfTextWithVision(
          bytes,
          pdf,
          application.company.id,
          onStep
        );

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
    const { checklist, segment, tenure } = await buildChecklist(criteriaList, material, application.company.id);

    await updateApplicationAi(applicationId, {
      aiScore: score,
      aiReasoning: reasoning,
      aiModel: modelUsed,
      aiChecklist: checklist ?? Prisma.DbNull,
      aiTenure: tenure ? (tenure as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
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
