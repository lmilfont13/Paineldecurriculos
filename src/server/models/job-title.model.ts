/**
 * Título da vaga para a lista pública (sem I/O). Muitas vagas trazem a cidade
 * no próprio título ("Promotor - (QUIXADÁ -CE)"); a lista mostra a cidade à
 * parte, então ela sai do título quando é a mesma da vaga. Só exibição: o
 * título gravado não muda.
 */

const UF = /\s*[-/,]?\s*\b[A-Z]{2}\b\s*$/i;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "Guaraciaba do Norte, CE" → "Guaraciaba do Norte". */
export function jobCity(location: string | null | undefined): string {
  const text = (location ?? "").trim();
  if (!text) return "";
  return text.split(/\s*[,/]\s*|\s+-\s+/)[0].trim();
}

export function splitJobTitle(title: string, location: string | null | undefined): string {
  const fixed = title.replace(/\s+\((a|o|as|os)\)/gi, "($1)").replace(/\s+/g, " ").trim();
  const city = normalize(jobCity(location));
  if (!city) return fixed;

  // Trecho final: "( CIDADE - UF )", "- (CIDADE)", "- Cidade/UF"...
  const match = fixed.match(/\s*[-–—]?\s*\(?\s*([^()\-–—]+?(?:\s*[-/,]\s*[A-Z]{2})?)\s*\)?\s*$/i);
  if (!match || match.index === undefined || match.index === 0) return fixed;
  const tail = match[1].replace(UF, "");
  if (normalize(tail) !== city) return fixed;

  const rest = fixed.slice(0, match.index).replace(/[\s\-–—(]+$/, "").trim();
  return rest || fixed;
}
