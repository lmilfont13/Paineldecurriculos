// Leitura da descrição da vaga em blocos (intro, jornada, benefícios...). Regra pura, sem React.

export type ParsedSection = {
  type: "intro" | "jornada" | "atividades" | "beneficios" | "geral";
  title?: string;
  items?: string[];
  content?: string;
};

/** Linha curta, sem pontuação final nem marcador: parece um título de bloco. */
function isHeadingLine(line: string): boolean {
  return (
    line.length <= 50 &&
    !/[.!?;,]$/.test(line) &&
    !/^([•\-*]|\d+\.)\s/.test(line)
  );
}

export function parseJobDescription(text: string): ParsedSection[] {
  if (!text) return [];

  const rawParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: ParsedSection[] = [];

  for (let i = 0; i < rawParagraphs.length; i++) {
    const p = rawParagraphs[i];
    const lower = p.toLowerCase();

    // 1. Detectar Jornada / Horário / Escala
    if (
      lower.startsWith("jornada:") ||
      lower.startsWith("horário:") ||
      lower.startsWith("horario:") ||
      lower.startsWith("escala:") ||
      lower.startsWith("carga horária:")
    ) {
      const cleanContent = p.replace(
        /^(jornada|horário|horario|escala|carga horária):\s*/i,
        ""
      );
      sections.push({
        type: "jornada",
        title: "Jornada de Trabalho",
        content: cleanContent,
      });
      continue;
    }

    // 2. Detectar Principais Atividades / Responsabilidades
    if (
      lower.startsWith("principais atividades:") ||
      lower.startsWith("atividades:") ||
      lower.startsWith("responsabilidades:") ||
      lower.startsWith("o que você vai fazer:")
    ) {
      const lines = p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const title = lines[0].replace(/:$/, "");
      const items = lines
        .slice(1)
        .map((l) => l.replace(/^([•\-\*]|\d+\.)\s*/, "").trim())
        .filter(Boolean);

      sections.push({
        type: "atividades",
        title: title || "Principais Atividades",
        items: items.length > 0 ? items : undefined,
        content: items.length === 0 ? lines.slice(1).join("\n") : undefined,
      });
      continue;
    }

    // 3. Detectar Benefícios / O que oferecemos
    if (
      lower.startsWith("benefícios:") ||
      lower.startsWith("beneficios:") ||
      lower.startsWith("o que oferecemos:") ||
      lower.startsWith("vantagens:")
    ) {
      const lines = p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const title = lines[0].replace(/:$/, "");
      const items = lines
        .slice(1)
        .map((l) => l.replace(/^([•\-\*]|\d+\.)\s*/, "").trim())
        .filter(Boolean);

      sections.push({
        type: "beneficios",
        title: title || "Benefícios & Vantagens",
        items: items.length > 0 ? items : undefined,
        content: items.length === 0 ? lines.slice(1).join("\n") : undefined,
      });
      continue;
    }

    // 3b. Bloco com título em linha própria, sem dois-pontos ("Escala e horário")
    {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2 && isHeadingLine(lines[0])) {
        const title = lines[0].replace(/:$/, "");
        const rest = lines.slice(1);
        const key = title.toLowerCase();
        const items = rest
          .filter((l) => /^([•\-*]|\d+\.)\s+/.test(l))
          .map((l) => l.replace(/^([•\-*]|\d+\.)\s+/, "").trim());
        const hasItems = items.length > 0 && items.length === rest.length;

        if (/benef|remunera|ofere|vantagens/.test(key)) {
          sections.push({
            type: "beneficios",
            title,
            items: hasItems ? items : undefined,
            content: hasItems ? undefined : rest.join("\n"),
          });
        } else if (/escala|hor[aá]rio|jornada/.test(key)) {
          sections.push({ type: "jornada", title, content: rest.join("\n") });
        } else if (hasItems) {
          sections.push({ type: "atividades", title, items });
        } else if (i === 0 && /^sobre/.test(key)) {
          sections.push({ type: "intro", content: rest.join("\n") });
        } else {
          sections.push({ type: "geral", title, content: rest.join("\n") });
        }
        continue;
      }
    }

    // 4. Parágrafo com bullet points genéricos
    if (p.includes("\n•") || p.includes("\n- ") || p.includes("\n* ")) {
      const lines = p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const isHeader = !lines[0].startsWith("•") && !lines[0].startsWith("-") && !lines[0].startsWith("*");
      const title = isHeader ? lines[0].replace(/:$/, "") : undefined;
      const bulletLines = isHeader ? lines.slice(1) : lines;
      const items = bulletLines
        .map((l) => l.replace(/^([•\-\*]|\d+\.)\s*/, "").trim())
        .filter(Boolean);

      sections.push({
        type: "atividades",
        title: title || "Atividades & Detalhes",
        items,
      });
      continue;
    }

    // 5. Parágrafo introdutório ou texto corrido
    if (i === 0) {
      sections.push({
        type: "intro",
        content: p,
      });
    } else {
      sections.push({
        type: "geral",
        content: p,
      });
    }
  }

  return sections;
}


/** Resumo de uma linha para o cartão da vaga: a apresentação, sem título de bloco, cortada sem partir palavra. */
export function jobSummary(description: string, max = 160): string {
  const first = parseJobDescription(description)[0];
  const text = (first?.content ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
