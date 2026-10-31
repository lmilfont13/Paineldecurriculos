/** Divide a lista em blocos de `size` itens (o último pode ser menor). */
export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
