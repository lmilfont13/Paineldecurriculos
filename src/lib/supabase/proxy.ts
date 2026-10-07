import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Prefixos que exigem sessão (gestor e admin). O papel é checado nos guards. */
const PROTECTED_PREFIXES = [
  "/painel",
  "/vagas",
  "/candidaturas",
  "/formulario",
  "/configuracoes",
  "/agentes",
  "/auditoria",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Mantém a sessão Supabase sincronizada (refresh de token via cookies) e
 * redireciona para /login quem acessa área protegida sem sessão.
 */
export async function updateSession(request: NextRequest) {
  // Performance: só as rotas protegidas validam a sessão na borda. Nas
  // páginas públicas, a sessão do candidato é resolvida na própria página
  // quando necessário.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Importante: não inserir lógica entre createServerClient e
  // auth.getClaims(), e sempre retornar o supabaseResponse para não perder
  // cookies de sessão.
  //
  // getClaims() renova o token se estiver vencendo e valida o JWT localmente
  // com a chave pública do projeto (JWKS em cache, ES256) — sem chamar
  // /auth/v1/user a cada navegação, como o getUser() fazia.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
