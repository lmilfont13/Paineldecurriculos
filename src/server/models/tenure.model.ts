/**
 * Análise de tempo de permanência e estabilidade do candidato nas empresas.
 * Avalia o tempo em cada experiência e o tempo médio para alertar sobre
 * rotatividade rápida (candidatos que passam pouco tempo nas empresas).
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
];

function isLikelyPersonalData(text: string): boolean {
  if (!text) return true;
  return INVALID_COMPANY_PATTERNS.some((pat) => pat.test(text));
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
    const meses = Number(it.meses);

    if (!empresa && !cargo && !periodo) continue;

    // Descarta se a IA ou fallback inseriu nome do candidato, telefone, nascimento ou dados pessoais
    if (isLikelyPersonalData(empresa) || isLikelyPersonalData(periodo)) {
      continue;
    }

    // Descarta durações irreais (ex: mais de 35 anos em uma única função)
    const validMonths = Number.isFinite(meses) && meses > 0 && meses <= 420 ? Math.round(meses) : 0;
    if (validMonths === 0 && !periodo) continue;

    empresas.push({
      empresa: empresa || "Empresa não informada",
      cargo: cargo || "Função não informada",
      periodo: periodo || (validMonths > 0 ? formatDurationMonths(validMonths) : "Período não informado"),
      meses: validMonths,
      duracaoFormatada: String(it.duracaoFormatada || (validMonths > 0 ? formatDurationMonths(validMonths) : "Duração não informada")),
      atual: Boolean(it.atual),
    });
  }

  const experienciasComMeses = empresas.filter((e) => e.meses > 0);
  const mediaCalculada =
    experienciasComMeses.length > 0
      ? Math.round(experienciasComMeses.reduce((acc, e) => acc + e.meses, 0) / experienciasComMeses.length)
      : Number(obj.tempoMedioMeses) || 0;

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
    totalExperiencias,
    estabilidade,
    estabilidadeLabel,
    classificacaoRisco,
    riscoLabel,
    resumo:
      resumo ||
      (totalExperiencias === 0
        ? "Não há registro explícito de períodos nas empresas descritas no currículo."
        : `Média de ${formatDurationMonths(mediaCalculada)} em ${totalExperiencias} ${
            totalExperiencias === 1 ? "empresa analisada" : "empresas analisadas"
          }.`),
    empresas,
    temPassagemCurta,
    temHistorico: totalExperiencias > 0,
  };
}

/**
 * Lê do banco: salvo em app.aiTenure ou dentro de app.aiChecklist.
 * NOTA: Nunca usamos fallback regex cego no texto para evitar inventar empresas
 * a partir de cabeçalhos de contato ou datas de nascimento.
 */
export function readTenure(value: unknown, _resumeText?: string | null): TenureAnalysis | null {
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

  return null;
}

/** Fallback regex desativado para garantir fidelidade total e evitar confusão com datas pessoais. */
export function extractHeuristicTenure(_text: string): TenureAnalysis | null {
  return null;
}

