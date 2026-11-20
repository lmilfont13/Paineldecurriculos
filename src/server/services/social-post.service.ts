import "server-only";

import { geminiGenerate } from "@/lib/gemini";
import { findJobById } from "@/server/repositories/job.repository";
import { contractLabels } from "@/server/models/job.model";
import { splitJobTitle } from "@/server/models/job-title.model";
import {
  DEFAULT_POST_DATA,
  SocialJobPostData,
  socialJobPostSchema,
} from "@/server/models/social-post.model";

/**
 * Prompt estruturado para extrair dados da vaga a partir do texto bruto colado
 * (ex.: mensagem de WhatsApp, e-mail de requisição ou descrição de vaga).
 */
const EXTRACT_PROMPT = `Você é um designer e redator sênior especialista em comunicação visual de recrutamento e seleção (RH).
Sua tarefa é analisar o texto de divulgação de vaga fornecido e convertê-lo em um JSON estrito para alimentar um template de post para Instagram (1080x1080).

Retorne APENAS um objeto JSON com as seguintes chaves (sem formatação markdown extra fora do json):
{
  "jobCode": "número da vaga ou código se houver (ex: '1129' ou ''), caso não haja deixe vazio",
  "opportunityTitle": "OPORTUNIDADE DE EMPREGO",
  "opportunitySubtitle": "Estamos contratando!",
  "roleTitle": "Título do cargo em CAIXA ALTA (ex: 'CONSULTOR(A) MERCHAN JR', 'PROMOTOR(A) DE MERCHANDISING')",
  "segmentSubtitle": "Segmento ou cliente em CAIXA ALTA (ex: 'SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS', 'CANAL FARMA', 'SUPERMERCADOS')",
  "location": "Cidade e estado (ex: 'Fortaleza - CE', 'Recife - PE', 'São Paulo - SP')",
  "route": "Roteiro de lojas resumido e conciso (ex: 'Cobertura de 2 Lojas, sendo 1 loja por dia | Bairros: Aldeota e Centro')",
  "startDate": "Previsão de início (ex: 'Em Novembro - data à confirmar', 'Início Imediato')",
  "contractType": "Tipo de contratação (ex: 'Regime CLT – EFETIVO', 'Temporário', 'CLT Intermitente')",
  "workSchedule": "Escala e jornada (ex: '44h semanais — Seg a Sex (11h às 20h) e Sáb (16h às 20h)')",
  "salary": "Valor do salário formatado (ex: 'R$ 1.839,41' ou 'A combinar')",
  "mealVoucher": "Valor do VR (ex: 'R$ 35,00/dia' ou 'Incluso')",
  "costAid": "Ajuda de custo de deslocamento (ex: 'De acordo com o roteiro' ou 'R$ 450,00/mês')",
  "healthInsurance": "Plano de saúde / odonto (ex: 'Médico e odontológico' ou 'Assistência Médica')",
  "corporatePhone": "Aparelho ou benefício extra (ex: 'Aparelho corporativo', 'Seguro de vida')",
  "benefitsList": [
    { "id": "b1", "type": "salary", "label": "Salário", "value": "R$ 1.839,41", "highlight": true },
    { "id": "b2", "type": "meal", "label": "VALE REFEIÇÃO", "value": "R$ 35,00/dia", "highlight": false },
    { "id": "b3", "type": "aid", "label": "AJUDA DE CUSTO", "value": "(de acordo com roteiro)", "highlight": false },
    { "id": "b4", "type": "health", "label": "CONVÊNIO MÉDICO", "value": "e odontológico", "highlight": false },
    { "id": "b5", "type": "phone", "label": "APARELHO", "value": "CORPORATIVO", "highlight": false }
  ],
  "ctaText": "Acesse o link na nossa bio do Instagram para se candidatar! 👆",
  "disclaimer": "⚠️ Inscrições abertas! Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal.",
  "caption": "Legenda completa pronta para o feed/reels do Instagram com introdução, destaques da vaga, requisitos, remuneração e chamada para ação com hashtags adequadas."
}

Regras:
1. Mantenha os textos dos campos do card objetivos para caber harmoniosamente no espaço visual de 1080x1080.
2. Formate moedas no padrão brasileiro (R$ X.XXX,XX).
3. Use só o que está no texto. Se um campo ou benefício não for mencionado, deixe "" (vazio) — nunca invente valor, benefício, data ou cidade, e nunca copie os exemplos acima.
4. "benefitsList" deve conter no máximo 5 itens principais ordenados para os cards inferiores.`;

/**
 * Fallback heurístico caso a IA esteja indisponível.
 */
function fallbackParse(text: string): SocialJobPostData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let role = "";
  let location = "";
  let salary = "";
  let meal = "";
  let code = "";

  const codeMatch = text.match(/(?:vaga|c[oó]digo|#)\s*(?:n[º°o]?)?\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
  if (codeMatch) code = codeMatch[1];

  const salaryMatch = text.match(/R\$\s*[\d\.\,]+/i);
  if (salaryMatch) salary = salaryMatch[0];

  const vrMatch = text.match(/(?:vr|refei[cç][aã]o|va|alimenta[cç][aã]o)\s*[:\-]?\s*(?:R\$\s*)?([\d\.\,]+(?:\s*\/\s*dia)?)/i);
  if (vrMatch) meal = vrMatch[0];

  const cityMatch = text.match(/(?:local|cidade|regi[aã]o)\s*[:\-]?\s*([^\n\r]+)/i);
  if (cityMatch) location = cityMatch[1].trim();

  const cargoMatch = text.match(/cargo\s*[:\-]\s*([^\n\r]+)/i);
  if (cargoMatch) role = cargoMatch[1].trim();
  else if (lines.length > 0) {
    const firstNonEmpty = lines.find((l) => !l.toLowerCase().startsWith("vaga") && l.length > 4);
    if (firstNonEmpty) role = firstNonEmpty.slice(0, 60);
  }

  // Só o que foi encontrado no texto: nada de valor de exemplo.
  return {
    ...emptyPostData(role || "Vaga"),
    jobCode: code,
    location,
    salary,
    mealVoucher: meal,
  };
}

/** Post em branco (sem nenhum dado de exemplo). */
function emptyPostData(roleTitle: string): SocialJobPostData {
  return socialJobPostSchema.parse({ roleTitle });
}

/**
 * Gera a legenda do Instagram otimizada para engajamento e conversão.
 */
export function generateInstagramCaption(data: SocialJobPostData, companyName = "Tarhget"): string {
  const codeStr = data.jobCode ? ` | VAGA Nº ${data.jobCode}` : "";
  return `🚀 ESTAMOS CONTRATANDO! ${data.opportunityTitle}${codeStr}

A ${companyName} está com processo seletivo aberto para a posição de:
👉 ${data.roleTitle} ${data.segmentSubtitle ? `(${data.segmentSubtitle})` : ""}

📍 Local: ${data.location}
🗺️ Roteiro: ${data.route || "Conforme demanda da operação"}
📅 Previsão de início: ${data.startDate}
📝 Regime: ${data.contractType}
⏰ Carga horária: ${data.workSchedule}

💰 REMUNERAÇÃO E BENEFÍCIOS:
• Salário: ${data.salary || "Compatível com a função"}
• Vale Refeição: ${data.mealVoucher || "Incluso"}
• Ajuda de Custo: ${data.costAid || "De acordo com roteiro"}
• Plano de Saúde/Odonto: ${data.healthInsurance || "Disponível"}
• Benefício adicional: ${data.corporatePhone || "Aparelho Corporativo"}

${data.disclaimer}

📲 COMO SE CANDIDATAR?
${data.ctaText}

Marque um amigo(a) nos comentários que está buscando essa oportunidade! 👇✨

#VagasDeEmprego #Vagas #Oportunidade #${data.roleTitle.replace(/[^A-Za-z0-9]/g, "")} #Recrutamento #Trabalho #Emprego #SelecaoRH #Varejo #Merchandising`;
}

/**
 * Processa o texto bruto da vaga usando IA e retorna o SocialJobPostData.
 */
export async function parseJobAnnouncementText(
  rawText: string,
  companyId?: string
): Promise<SocialJobPostData> {
  const cleaned = rawText.trim();
  if (!cleaned) {
    return DEFAULT_POST_DATA;
  }

  try {
    const rawResult = await geminiGenerate({
      system: EXTRACT_PROMPT,
      prompt: `Aqui está o texto bruto da oportunidade:\n\n"""\n${cleaned}\n"""`,
      json: true,
      maxTokens: 1200,
      companyId,
    });

    const parsedJson = JSON.parse(rawResult);

    // Garante defaults e tipos consistentes
    const validated = socialJobPostSchema.safeParse({
      ...parsedJson,
      modelImage: parsedJson.modelImage || DEFAULT_POST_DATA.modelImage,
    });

    if (validated.success) {
      const result = validated.data;
      if (!result.caption) {
        result.caption = generateInstagramCaption(result);
      }
      return result;
    }

    console.warn("[social-post] Validação parcial falhou, mesclando dados:", validated.error);
    // Junta com um post em branco: o que a IA não trouxe fica vazio, nunca
    // com os valores do exemplo.
    return {
      ...emptyPostData(String(parsedJson.roleTitle || "Vaga")),
      ...parsedJson,
      benefitsList: Array.isArray(parsedJson.benefitsList) ? parsedJson.benefitsList : [],
      modelImage: DEFAULT_POST_DATA.modelImage,
    };
  } catch (err) {
    console.error("[social-post] Falha ao processar com IA, usando fallback heurístico:", err);
    const fallback = fallbackParse(cleaned);
    fallback.caption = generateInstagramCaption(fallback);
    return fallback;
  }
}

/**
 * Busca uma vaga existente no banco de dados e gera o SocialJobPostData inicial.
 */
export async function getJobSocialPostData(
  jobId: string,
  companyId: string
): Promise<SocialJobPostData | null> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) {
    return null;
  }

  // Monta uma descrição sintetizada para enriquecer com o parser
  const combinedText = `
Vaga Nº ${job.code || job.id.slice(0, 6)}
Cargo: ${job.title}
Local: ${job.location || "Presencial"}
Contratação: Regime ${job.contract}
${job.description || ""}
${job.requirements || ""}
  `.trim();

  // Executa o parser da vaga
  const parsed = await parseJobAnnouncementText(combinedText, companyId);

  // Garante que o código e título da vaga do banco tenham precedência
  parsed.jobCode = job.code || parsed.jobCode || job.id.slice(0, 5);
  // Título sem a cidade repetida ("PROMOTOR(A) ... ( QUIXADÁ - CE )").
  parsed.roleTitle = splitJobTitle(job.title, job.location).toUpperCase();
  if (job.location) {
    parsed.location = job.location;
  }
  // O tipo de contrato vem do texto da vaga (a IA lê "temporário",
  // "determinado"...). Só sem isso usa o cadastro, sem inventar "Efetivo".
  if (!parsed.contractType.trim() && job.contract) {
    parsed.contractType = `Regime ${contractLabels[job.contract]}`;
  }

  parsed.caption = generateInstagramCaption(parsed);

  // Trava rigorosamente no modelo oficial original Tarhget (padrão mestre)
  parsed.modelImage = DEFAULT_POST_DATA.modelImage;

  return parsed;
}
