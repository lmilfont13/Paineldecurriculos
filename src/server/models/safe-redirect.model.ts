/**
 * Destino pós-login: só caminhos internos do próprio site (sem I/O).
 *
 * "/\evil.com" começa com "/" e não com "//", mas o navegador trata "\" como
 * "/" e vai para evil.com. Também recusa caracteres de controle (quebra de
 * linha, tab), que os navegadores removem antes de resolver a URL.
 */
export function safeInternalPath(raw: unknown, fallback: string): string {
  const value = typeof raw === "string" ? raw : "";
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
