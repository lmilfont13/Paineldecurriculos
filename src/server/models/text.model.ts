const CONNECTORS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "para", "com", "na", "no", "nas", "nos", "por", "ao", "a", "o",
]);

/**
 * Capitaliza em português: "gabriel ribeiro MARTINS" → "Gabriel Ribeiro Martins",
 * ligações (de, da, e...) em minúsculo. Com `keepAcronyms` (títulos de vaga) mantém
 * siglas ("TI", "CLT") e marcas com maiúscula no meio ("iFood").
 */
export function titleCasePt(text: string, opts: { keepAcronyms?: boolean } = {}): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && CONNECTORS.has(lower)) return lower;
      if (opts.keepAcronyms) {
        if (/^[A-ZÀ-Ý0-9]{2,4}$/.test(word) && /[A-ZÀ-Ý]/.test(word)) return word;
        if (/[a-zà-ÿ]/.test(word) && /[A-ZÀ-Ý]/.test(word.slice(1))) return word;
      }
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/**
 * Texto seguro para a fonte padrão do PDF: o que não existe nela (símbolos de lista
 * copiados de currículos, setas, ✓) sai como espaço em vez de virar um caractere errado.
 */
export function toPdfSafeText(text: string): string {
  return text
    .replace(/[^ -~ -ÿ–—‘’“”•…€\n]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Remove o caractere nulo (U+0000) de textos, inclusive dentro de listas e objetos.
 * Alguns PDFs o trazem na extração, e o Postgres recusa gravá-lo (erro 22021),
 * o que fazia a análise inteira falhar na hora de salvar.
 */
export function removeNulChars<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\u0000/g, "") as T;
  if (Array.isArray(value)) return value.map((v) => removeNulChars(v)) as T;
  // só objetos simples: datas, instâncias de classe e valores especiais do Prisma ficam como estão
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, removeNulChars(v)])
    ) as T;
  }
  return value;
}
