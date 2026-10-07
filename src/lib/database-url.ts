/**
 * Conexão do app (serverless na Vercel) com o Supabase:
 *
 * - DATABASE_URL  → pooler em modo TRANSAÇÃO (porta 6543) com
 *                   `pgbouncer=true&connection_limit=1&pool_timeout=20`.
 *                   Cada instância serverless abre no máximo 1 conexão; o
 *                   Supavisor multiplexa. Exemplo:
 *   postgresql://postgres.<ref>:<senha>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20
 *
 * - DIRECT_URL    → só para migrations (`prisma migrate deploy` no build).
 *                   Pooler em modo SESSÃO (porta 5432), que funciona em IPv4:
 *   postgresql://postgres.<ref>:<senha>@aws-0-us-west-2.pooler.supabase.com:5432/postgres
 *
 * Mesmo que a variável na Vercel esteja com a porta 5432 ou sem os
 * parâmetros, a normalização abaixo garante o modo transação no runtime.
 *
 * Com connection_limit=1, queries em paralelo (Promise.all) só entram na fila
 * da mesma conexão — e uma fila longa estoura pool_timeout (P2024). Prefira
 * awaits sequenciais.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;

  try {
    const url = new URL(raw);

    if (url.hostname.endsWith(".pooler.supabase.com")) {
      if (url.port === "5432" || url.port === "") url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", "1");
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "20");
      }
    } else if (
      process.env.NODE_ENV === "production" &&
      url.hostname.endsWith(".supabase.co")
    ) {
      console.warn(
        "[prisma] DATABASE_URL aponta para a conexão direta do Supabase " +
          "(db.<ref>.supabase.co). Em serverless use o pooler na porta 6543."
      );
    }

    return url.toString();
  } catch {
    return raw;
  }
}
