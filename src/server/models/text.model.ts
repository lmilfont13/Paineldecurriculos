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
