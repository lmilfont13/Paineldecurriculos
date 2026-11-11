/**
 * Regras de caminho do proxy (borda HTTP), sem I/O — testadas em
 * proxy-paths.test.ts.
 */

/** Prefixos que exigem sessão (gestor e admin). O papel é checado nos guards. */
export const PROTECTED_PREFIXES = [
  "/painel",
  "/vagas",
  "/candidaturas",
  "/talentos",
  "/buscar-cvs",
  "/aniversariantes",
  "/relatorio-geral",
  "/suporte-ao-vivo",
  "/formulario",
  "/configuracoes",
  "/agentes",
  "/auditoria",
  "/admin",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Há cookie de sessão do Supabase (sb-<ref>-auth-token, possivelmente em
 * pedaços .0, .1)? Só então vale renovar o token nas rotas públicas: é o caso
 * do candidato logado em /[slug]/minhas-candidaturas. Server Components não
 * conseguem gravar o cookie renovado; sem o proxy, cada página refazia a
 * renovação depois que o token de 1 hora vencia.
 */
export function hasSupabaseSessionCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}
