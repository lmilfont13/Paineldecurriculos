/**
 * Perfil do Instagram do candidato (opcional). Funções puras.
 *
 * O candidato digita do jeito que quiser — "@maria.souza", "maria.souza" ou o
 * link do perfil — e guardamos só o usuário. Nunca vai para a IA: a triagem
 * avalia só habilidades e experiência (regra 3).
 */

/** Regras do Instagram para usuário: letras, números, ponto e sublinhado; até 30. */
const HANDLE = /^[a-z0-9._]{1,30}$/;

/**
 * Texto digitado → usuário (sem @, minúsculo), ou null se vazio.
 * Inválido devolve { error } para o formulário mostrar.
 */
export function parseInstagram(input: string | null | undefined): { handle: string | null } | { error: string } {
  let value = (input ?? "").trim();
  if (!value) return { handle: null };
  // Link colado: instagram.com/usuario, com ou sem https, www, barra ou ?parâmetros.
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  if (!HANDLE.test(value) || value.startsWith(".") || value.endsWith(".") || value.includes("..")) {
    return { error: "Instagram inválido. Use só o seu usuário, por exemplo @maria.souza." };
  }
  return { handle: value };
}

/** Usuário → link do perfil. */
export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

/** Versão da API da Meta usada na publicação. */
export const META_GRAPH_VERSION = "v27.0";

/**
 * Endereço da API conforme o tipo de token. Token do "Login do Instagram"
 * (começa com IG, ex.: IGAA…) só funciona em graph.instagram.com; token do
 * Facebook/Business (EAA…) usa graph.facebook.com.
 */
export function instagramApiBase(accessToken: string): string {
  const host = /^IG/i.test(accessToken.trim()) ? "https://graph.instagram.com" : "https://graph.facebook.com";
  return `${host}/${META_GRAPH_VERSION}`;
}

/** Token do Login do Instagram dispensa o ID da conta (descobrimos pelo /me). */
export function isInstagramLoginToken(accessToken: string): boolean {
  return /^IG/i.test(accessToken.trim());
}
