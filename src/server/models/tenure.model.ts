/**
 * Análise de tempo de permanência e estabilidade do candidato nas empresas.
 * Avalia o tempo em cada empresa (duração em anos/meses), a média aritmética
 * e a mediana estatística para uma avaliação precisa de rotatividade e durabilidade.
 */

export type TenureCompany = {
  empresa: string;
  cargo: string;
  periodo: string;
  meses: number;
  duracaoFormatada: string;
  atual?: boolean;
};

export type TenureStability = "ALTA" | "MEDIA" | "BAIXA" | "INSUFICIENTE";
export type TenureRisk = "BAIXO" | "MEDIO" | "ALTO" | "NEUTRO";

export type TenureAnalysis = {
  tempoMedioMeses: number;
  tempoMedioFormatado: string;
  tempoMedianoMeses: number;
  tempoMedianoFormatado: string;
  totalExperiencias: number;
  estabilidade: TenureStability;
  estabilidadeLabel: string;
  classificacaoRisco: TenureRisk;
  riscoLabel: string;
  resumo: string;
  empresas: TenureCompany[];
  temPassagemCurta: boolean; // alguma experiência inferior a 6 meses
  temHistorico: boolean;
};

/** Formata quantidade de meses em texto legível (ex: "1 ano e 3 meses"). */
export function formatDurationMonths(meses: number): string {
  const m = Math.max(0, Math.round(meses));
  if (m === 0) return "Menos de 1 mês";
  if (m < 12) return m === 1 ? "1 mês" : `${m} meses`;
  const anos = Math.floor(m / 12);
  const resto = m % 12;
  const anosTexto = anos === 1 ? "1 ano" : `${anos} anos`;
  if (resto === 0) return anosTexto;
  const restoTexto = resto === 1 ? "1 mês" : `${resto} meses`;
  return `${anosTexto} e ${restoTexto}`;
}

/** Calcula a mediana estatística de um conjunto de durações em meses. */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Classifica a estabilidade com base no tempo médio em meses. */
export function classifyStability(
  tempoMedioMeses: number,
  totalExperiencias: number
): {
  estabilidade: TenureStability;
  estabilidadeLabel: string;
  classificacaoRisco: TenureRisk;
  riscoLabel: string;
} {
  if (totalExperiencias === 0 || tempoMedioMeses <= 0) {
    return {
      estabilidade: "INSUFICIENTE",
      estabilidadeLabel: "Sem datas suficientes no currículo",
      classificacaoRisco: "NEUTRO",
      riscoLabel: "Histórico sem datas",
    };
  }

  if (tempoMedioMeses >= 24) {
    return {
      estabilidade: "ALTA",
      estabilidadeLabel: "Alta estabilidade",
      classificacaoRisco: "BAIXO",
      riscoLabel: "Baixo risco de rotatividade",
    };
  }

  if (tempoMedioMeses >= 12) {
    return {
      estabilidade: "MEDIA",
      estabilidadeLabel: "Estabilidade moderada",
      classificacaoRisco: "MEDIO",
      riscoLabel: "Risco moderado",
    };
  }

  return {
    estabilidade: "BAIXA",
    estabilidadeLabel: "Alta rotatividade",
    classificacaoRisco: "ALTO",
    riscoLabel: "Alto risco (permanência curta)",
  };
}

const INVALID_COMPANY_PATTERNS = [
  /telefone/i,
  /celular/i,
  /whatsapp/i,
  /nascimento/i,
  /data\s+de\s+nascimento/i,
  /e-?mail/i,
  /@/,
  /\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/, // telefones (85) 9 87530785
  /curr[íi]culo/i,
  /dados\s+pessoais/i,
  /contato/i,
  /endereço|endereco/i,
  /cpf/i,
  /rg\b/i,
  /brasileir[oa]/i,
  /solteir[oa]|casad[oa]/i,
  /ensino\s+(m[eé]dio|fundamental|superior)/i,
  /gradua[cç][aã]o/i,
  /escolaridade/i,
];

function isLikelyPersonalData(text: string): boolean {
  if (!text) return true;
  return INVALID_COMPANY_PATTERNS.some((pat) => pat.test(text));
}

const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3, março: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
};

/**
 * Calcula a quantidade de meses a partir de uma string de período ou duração.
 * Exemplos aceitos:
 * - "01/2020 a 06/2022" -> 29 meses
 * - "Jan/2021 a Mar/2023" -> 26 meses
 * - "2019 a 2021" -> 24 meses
 * - "2022 - Atual" -> meses até a data atual
 * - "1 ano e 4 meses" -> 16 meses
 * - "18 meses" -> 18 meses
 */
export function computeMonthsFromPeriodString(periodo: string): number {
  if (!periodo) return 0;
  const clean = periodo.toLowerCase().replace(/\s+/g, " ").trim();

  // Caso 1: string já com indicação textual de duração ("1 ano e 3 meses", "18 meses")
  const anosMatch = clean.match(/(\d{1,2})\s*anos?/);
  const mesesMatch = clean.match(/(\d{1,2})\s*m[eê]s(?:es)?/);
  if (anosMatch || mesesMatch) {
    const anos = anosMatch ? parseInt(anosMatch[1], 10) : 0;
    const meses = mesesMatch ? parseInt(mesesMatch[1], 10) : 0;
    const total = anos * 12 + meses;
    if (total > 0 && total <= 480) return total;
  }

  // Se for apenas um número isolado ("24")
  const directNum = parseInt(clean, 10);
  if (/^\d{1,3}$/.test(clean) && directNum > 0 && directNum <= 480) {
    return directNum;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Caso 2: Período com mês e ano ("01/2020 a 05/2022" ou "Jan/2020 a Mar/2022" ou "02/2021 a Atual")
  const monthYearPattern =
    /(?:(\d{1,2})|[a-zçã]{3,9})[\/.\s-]+(20\d{2}|19\d{2})\s*(?:a|à|-|–|ate|até|to)\s*(?:(?:(\d{1,2})|[a-zçã]{3,9})[\/.\s-]+(20\d{2}|19\d{2})|atual|presente|momento)/i;

  const myMatch = clean.match(monthYearPattern);
  if (myMatch) {
    const startRaw = clean.match(/([a-zçã]{3,9}|\d{1,2})[\/.\s-]+(20\d{2}|19\d{2})/i);
    if (startRaw) {
      let startM = parseInt(startRaw[1], 10);
      if (isNaN(startM)) {
        startM = MONTH_NAMES_MAP[startRaw[1].toLowerCase().slice(0, 3)] ?? 1;
      }
      const startY = parseInt(startRaw[2], 10);

      const isCurrent = /atual|presente|momento/i.test(clean);
      let endM = currentMonth;
      let endY = currentYear;

      if (!isCurrent) {
        const afterSep = clean.split(/(?:a|à|-|–|ate|até|to)/i)[1];
        if (afterSep) {
          const endRaw = afterSep.match(/([a-zçã]{3,9}|\d{1,2})[\/.\s-]+(20\d{2}|19\d{2})/i);
          if (endRaw) {
            endM = parseInt(endRaw[1], 10);
            if (isNaN(endM)) {
              endM = MONTH_NAMES_MAP[endRaw[1].toLowerCase().slice(0, 3)] ?? 12;
            }
            endY = parseInt(endRaw[2], 10);
          }
        }
      }

      const totalMonths = (endY - startY) * 12 + (endM - startM) + 1;
      if (totalMonths > 0 && totalMonths <= 480) {
        return totalMonths;
      }
    }
  }

  // Caso 3: Apenas anos ("2019 a 2022" ou "2021 a Atual")
  const yearPattern = /\b(20\d{2}|19\d{2})\s*(?:a|à|-|–|ate|até|to)\s*(?:(20\d{2}|19\d{2})|atual|presente|momento)\b/i;
  const yMatch = clean.match(yearPattern);
  if (yMatch) {
    const startY = parseInt(yMatch[1], 10);
    const isCurrent = /atual|presente|momento/i.test(yMatch[0]);
    const endY = isCurrent ? currentYear : parseInt(yMatch[2], 10);
    if (endY >= startY) {
      const totalMonths = Math.max(1, (endY - startY) * 12);
      if (totalMonths > 0 && totalMonths <= 480) {
        return totalMonths;
      }
    }
  }

  return 0;
}

/** Valida e normaliza o objeto de análise de permanência retornado pela IA ou salvo no banco. */
export function parseTenureAnalysis(raw: unknown): TenureAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const empresasRaw = Array.isArray(obj.empresas) ? obj.empresas : [];
  const empresas: TenureCompany[] = [];

  for (const item of empresasRaw) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const empresa = String(it.empresa ?? "").trim();
    const cargo = String(it.cargo ?? "").trim();
    const periodo = String(it.periodo ?? "").trim();

    // Aceita número ou converte string (ex: "18 meses", ou calcula do período)
    let meses = Number(it.meses);
    if (!Number.isFinite(meses) || meses <= 0) {
      meses = computeMonthsFromPeriodString(String(it.duracaoFormatada || periodo));
    }

    if (!empresa && !cargo && !periodo) continue;

    // Descarta se for nome do candidato, telefone, nascimento ou dados pessoais
    if (isLikelyPersonalData(empresa) || (periodo && isLikelyPersonalData(periodo))) {
      continue;
    }

    // Descarta durações irreais (ex: mais de 35 anos em uma única função)
    const validMonths = Number.isFinite(meses) && meses > 0 && meses <= 420 ? Math.round(meses) : 0;
    if (validMonths === 0 && !periodo) continue;

    const isCurrent = Boolean(it.atual) || /atual|presente|momento/i.test(periodo);

    empresas.push({
      empresa: empresa || "Empresa não informada",
      cargo: cargo || "Função não informada",
      periodo: periodo || (validMonths > 0 ? formatDurationMonths(validMonths) : "Período não informado"),
      meses: validMonths,
      duracaoFormatada: String(
        it.duracaoFormatada || (validMonths > 0 ? formatDurationMonths(validMonths) : "Duração não informada")
      ),
      atual: isCurrent,
    });
  }

  const experienciasComMeses = empresas.filter((e) => e.meses > 0);
  const duracoesMeses = experienciasComMeses.map((e) => e.meses);

  const mediaCalculada =
    experienciasComMeses.length > 0
      ? Math.round(duracoesMeses.reduce((acc, m) => acc + m, 0) / duracoesMeses.length)
      : Number(obj.tempoMedioMeses) || 0;

  const medianaCalculada =
    experienciasComMeses.length > 0
      ? calculateMedian(duracoesMeses)
      : Number(obj.tempoMedianoMeses) || mediaCalculada;

  const totalExperiencias = empresas.length;
  const { estabilidade, estabilidadeLabel, classificacaoRisco, riscoLabel } = classifyStability(
    mediaCalculada,
    totalExperiencias
  );

  const temPassagemCurta = empresas.some((e) => e.meses > 0 && e.meses < 6);
  const resumo = String(obj.resumo ?? "").trim();

  return {
    tempoMedioMeses: mediaCalculada,
    tempoMedioFormatado: formatDurationMonths(mediaCalculada),
    tempoMedianoMeses: medianaCalculada,
    tempoMedianoFormatado: formatDurationMonths(medianaCalculada),
    totalExperiencias,
    estabilidade,
    estabilidadeLabel,
    classificacaoRisco,
    riscoLabel,
    resumo:
      resumo ||
      (totalExperiencias === 0
        ? "Não há registro explícito de períodos nas empresas descritas no currículo."
        : `Média de ${formatDurationMonths(mediaCalculada)} e mediana de ${formatDurationMonths(
            medianaCalculada
          )} em ${totalExperiencias} ${
            totalExperiencias === 1 ? "empresa analisada" : "empresas analisadas"
          }.`),
    empresas,
    temPassagemCurta,
    temHistorico: totalExperiencias > 0,
  };
}

/**
 * Extrai períodos de permanência exclusivamente da seção de experiências profissionais
 * do currículo. Garante isolamento estrito contra cabeçalhos pessoais, datas de nascimento,
 * telefones e dados acadêmicos.
 */
export function extractHeuristicTenure(resumeText: string | null | undefined): TenureAnalysis | null {
  if (!resumeText || resumeText.trim().length < 40) return null;

  const lines = resumeText
    .split(/\r?\n|•|·|\|/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Localiza o início da seção de experiência profissional
  const startIdx = lines.findIndex((l) =>
    /^(experi[eê]ncias?(\s+profissionais?)?|hist[oó]rico\s+profissional|trajet[oó]ria\s+profissional|atua[cç][aã]o\s+profissional)\b/i.test(
      l
    )
  );

  // Se não encontrar uma seção explícita de experiência profissional, não arrisca regex solto
  if (startIdx < 0) return null;

  const rest = lines.slice(startIdx + 1);
  const endRel = rest.findIndex((l) =>
    /^(forma[cç][aã]o|escolaridade|educa[cç][aã]o|cursos?|idiomas?|qualifica|habilidades|compet[eê]ncias|objetivo|dados\s+pessoais|refer[eê]ncias)/i.test(
      l
    )
  );
  const section = endRel >= 0 ? rest.slice(0, endRel) : rest;

  const matched: TenureCompany[] = [];

  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    if (isLikelyPersonalData(line)) continue;

    // Procura período na linha
    const meses = computeMonthsFromPeriodString(line);
    if (meses > 0 && meses <= 420) {
      // Linha anterior costuma ser o nome da empresa ou cargo
      let empresaCandidate = "";
      let cargoCandidate = "Função conforme currículo";

      if (i > 0) {
        const prev = section[i - 1].replace(/[•\-*]/g, "").trim();
        if (prev && !isLikelyPersonalData(prev) && prev.length >= 3 && prev.length <= 60) {
          empresaCandidate = prev;
        }
      }

      if (!empresaCandidate) {
        // Tenta pegar da própria linha removendo as datas
        const cleanedLine = line
          .replace(
            /(?:(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*|\d{1,2})[\/.\s-]+(?:20\d{2}|19\d{2})\s*(?:a|à|-|–|ate|até|to)\s*(?:(?:(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*|\d{1,2})[\/.\s-]+(?:20\d{2}|19\d{2})|atual|presente|momento)/i,
            ""
          )
          .replace(/\b(?:20\d{2}|19\d{2})\s*(?:a|à|-|–|ate|até|to)\s*(?:(?:20\d{2}|19\d{2})|atual|presente)\b/i, "")
          .replace(/[•\-–—:;,./]+/g, " ")
          .trim();

        if (cleanedLine.length >= 3 && cleanedLine.length <= 60 && !isLikelyPersonalData(cleanedLine)) {
          empresaCandidate = cleanedLine;
        }
      }

      if (!empresaCandidate) {
        empresaCandidate = "Empresa no histórico profissional";
      }

      const isCurrent = /atual|presente|momento/i.test(line);

      matched.push({
        empresa: empresaCandidate,
        cargo: cargoCandidate,
        periodo: line.slice(0, 45),
        meses,
        duracaoFormatada: formatDurationMonths(meses),
        atual: isCurrent,
      });
    }
  }

  if (matched.length === 0) return null;

  // Limita até 6 experiências mais claras
  const unique = matched.slice(0, 6);

  return parseTenureAnalysis({
    empresas: unique,
    resumo: `Histórico profissional com ${unique.length} ${
      unique.length === 1 ? "experiência com datas" : "experiências com datas"
    } no currículo.`,
  });
}

/**
 * Lê do banco: salvo em app.aiTenure ou dentro de app.aiChecklist,
 * ou deduzido a partir da seção profissional do currículo caso a IA ainda não tenha processado.
 */
export function readTenure(value: unknown, resumeText?: string | null): TenureAnalysis | null {
  if (value && typeof value === "object") {
    // Se estiver em formato direto
    if ("empresas" in value || "tempoMedioMeses" in value) {
      const parsed = parseTenureAnalysis(value);
      if (parsed && parsed.totalExperiencias > 0) return parsed;
    }
    // Se estiver aninhado dentro de aiChecklist como { tenure: ... }
    if ("tenure" in value) {
      const parsed = parseTenureAnalysis((value as Record<string, unknown>).tenure);
      if (parsed && parsed.totalExperiencias > 0) return parsed;
    }
  }

  // Fallback seguro em tempo de exibição a partir da seção profissional do currículo
  if (resumeText && resumeText.trim().length >= 40) {
    const extracted = extractHeuristicTenure(resumeText);
    if (extracted && extracted.totalExperiencias > 0) return extracted;
  }

  return null;
}
