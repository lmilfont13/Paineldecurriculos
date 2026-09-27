import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Prefixos que exigem sessão (gestor e admin). O papel é checado nos guards. */
const PROTECTED_PREFIXES = [
  "/painel",
  "/vagas",
  "/candidaturas",
  "/formulario",
  "/configuracoes",
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
  // Performance: só as rotas protegidas precisam do getUser() (round-trip de
  // auth) na borda. Nas páginas públicas, a sessão do candidato é resolvida
  // na própria página quando necessário — evita uma chamada de auth por acesso.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Importante: não inserir lógica entre createServerClient e auth.getUser(),
  // e sempre retornar o supabaseResponse para não perder cookies de sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
