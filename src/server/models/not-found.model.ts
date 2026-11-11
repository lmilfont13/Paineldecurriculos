import { PROTECTED_PREFIXES } from "@/lib/supabase/proxy-paths";

/**
 * Para onde mandar quem caiu numa página que não existe (sem I/O).
 * - área do gestor/admin → painel
 * - página de uma empresa (/[slug]/…) → vagas dessa empresa
 * - resto → início
 */
export function notFoundTarget(pathname: string): { href: string; label: string } {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  if (!first) return { href: "/", label: "Ir para o início" };
  if (first === "admin") return { href: "/admin/empresas", label: "Voltar às empresas" };
  if (PROTECTED_PREFIXES.includes(`/${first}`)) return { href: "/painel", label: "Voltar ao painel" };
  if (["login", "api", "recuperar-senha", "redefinir-senha", "apresentacao"].includes(first)) {
    return { href: "/", label: "Ir para o início" };
  }
  if (!/^[a-z0-9-]+$/.test(first)) return { href: "/", label: "Ir para o início" };
  return { href: `/${first}/vagas`, label: "Ver vagas abertas" };
}
