import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  ATTRIBUTION_COOKIE,
  COOKIE_MAX_AGE,
  REFERRER_COOKIE,
  extractAttribution,
  isGoogleReferer,
} from "@/server/models/attribution.model";

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
 * Captura a origem do candidato (?origem=, ?ref=, Referer do Google) e
 * grava em cookies de 30 dias. Não sobrescreve se já existir (first-touch).
 */
function captureAttribution(
  request: NextRequest,
  response: NextResponse,
): void {
  const { source, referrerCode } = extractAttribution(request.nextUrl);

  // Google via Referer header (se não veio por ?origem=)
  const effectiveSource =
    source ?? (isGoogleReferer(request.headers.get("referer")) ? "google" : null);

  // First-touch: só grava se não existir ainda
  if (effectiveSource && !request.cookies.get(ATTRIBUTION_COOKIE)) {
    response.cookies.set(ATTRIBUTION_COOKIE, effectiveSource, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  if (referrerCode && !request.cookies.get(REFERRER_COOKIE)) {
    response.cookies.set(REFERRER_COOKIE, referrerCode, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
}

/**
 * Mantém a sessão Supabase sincronizada (refresh de token via cookies) e
 * redireciona para /login quem acessa área protegida sem sessão.
 */
export async function updateSession(request: NextRequest) {
  // Captura de atribuição: rotas públicas com slug (candidatos).
  // Rápido e sem I/O — só lê a URL e seta cookies se necessário.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    const response = NextResponse.next({ request });
    captureAttribution(request, response);
    return response;
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
