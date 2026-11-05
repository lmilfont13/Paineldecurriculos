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

    const validMonths = Number.isFinite(meses) && meses > 0 ? Math.round(meses) : 0;
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
 * Lê do banco: pode estar salvo em app.aiTenure ou dentro de app.aiChecklist
 * ou deduzido a partir de texto do currículo se ainda não houver análise.
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

  // Fallback heurístico inteligente em tempo de exibição caso o currículo ainda não tenha passado pela nova análise
  if (resumeText && resumeText.trim().length > 30) {
    return extractHeuristicTenure(resumeText);
  }

  return null;
}

/** Extrai heurística rápida de anos e meses de permanência a partir do texto cru do currículo. */
export function extractHeuristicTenure(text: string): TenureAnalysis | null {
  if (!text) return null;

  // Busca padrões como: "2019 a 2022", "01/2020 até 05/2021", "Março/2018 - Atual"
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const yearPattern = /\b(19\d\d|20\d\d)\b(?:\s*(?:a|à|-|ate|até|–)\s*(\b(?:19\d\d|20\d\d)\b|atual|o momento|presente))?/i;
  const monthYearPattern = /\b(0?[1-9]|1[0-2])[\/\.](19\d\d|20\d\d)\b(?:\s*(?:a|à|-|ate|até|–)\s*(?:(0?[1-9]|1[0-2])[\/\.](19\d\d|20\d\d)\b|atual|o momento|presente))?/i;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const matched: TenureCompany[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const myMatch = line.match(monthYearPattern);

    if (myMatch) {
      const startM = parseInt(myMatch[1], 10);
      const startY = parseInt(myMatch[2], 10);
      let endM = currentMonth;
      let endY = currentYear;
      const isCurrent = /atual|presente|momento/i.test(myMatch[0]);

      if (!isCurrent && myMatch[3] && myMatch[4]) {
        endM = parseInt(myMatch[3], 10);
        endY = parseInt(myMatch[4], 10);
      }

      const totalMonths = Math.max(1, (endY - startY) * 12 + (endM - startM));
      if (totalMonths > 0 && totalMonths < 480) {
        const empresa = lines[i > 0 ? i - 1 : i].slice(0, 50).replace(/[•\-*]/g, "").trim() || "Experiência profissional";
        matched.push({
          empresa,
          cargo: "Conforme currículo",
          periodo: myMatch[0],
          meses: totalMonths,
          duracaoFormatada: formatDurationMonths(totalMonths),
          atual: isCurrent,
        });
      }
      continue;
    }

    const yMatch = line.match(yearPattern);
    if (yMatch && yMatch[1]) {
      const startY = parseInt(yMatch[1], 10);
      let endY = startY + 1;
      const isCurrent = /atual|presente|momento/i.test(yMatch[0]);
      if (yMatch[2]) {
        if (/atual|presente|momento/i.test(yMatch[2])) {
          endY = currentYear;
        } else {
          endY = parseInt(yMatch[2], 10);
        }
      }
      const totalMonths = Math.max(1, (endY - startY) * 12);
      if (totalMonths > 0 && totalMonths < 480) {
        const empresa = lines[i > 0 ? i - 1 : i].slice(0, 50).replace(/[•\-*]/g, "").trim() || "Experiência profissional";
        matched.push({
          empresa,
          cargo: "Conforme currículo",
          periodo: yMatch[0],
          meses: totalMonths,
          duracaoFormatada: formatDurationMonths(totalMonths),
          atual: isCurrent,
        });
      }
    }
  }

  // Limita até 6 experiências mais claras
  const unique = matched.slice(0, 6);
  if (unique.length === 0) return null;

  return parseTenureAnalysis({
    empresas: unique,
    tempoMedioMeses: Math.round(unique.reduce((acc, u) => acc + u.meses, 0) / unique.length),
  });
}
