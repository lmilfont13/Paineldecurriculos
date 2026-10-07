/**
 * Lê uma variável de ambiente sem espaços nem quebras de linha nas pontas.
 *
 * Valores colados no painel da Vercel a partir de um .env do Windows vieram
 * com "\r\n" no fim. Numa chave de API isso gera um cabeçalho HTTP inválido
 * (Authorization: Bearer …\r\n) e toda chamada falha — foi o que deixou o
 * bucket de currículos vazio. Só para o servidor: no navegador, variáveis
 * NEXT_PUBLIC_* precisam ser lidas literalmente (veja supabase/client.ts).
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Endereço público do site, sem "\r\n" nem barra final (ex.: links de e-mail). */
export function appUrl(): string {
  return (readEnv("NEXT_PUBLIC_APP_URL") ?? "").replace(/\/+$/, "");
}
