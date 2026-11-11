import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra de campo para RG e CPF (AES-256-GCM).
 *
 * No banco fica `enc:v1:<iv>:<tag>:<dado>` (base64url). A chave vem de
 * `DATA_ENCRYPTION_KEY` (Vercel) e nunca vai para o banco. Um vazamento só do
 * banco não expõe os documentos.
 *
 * Compatível com o que já existe: valor antigo em texto normal é lido como
 * está, e sem a chave configurada o sistema grava como antes. Se a chave for
 * perdida, os valores cifrados não voltam — guarde uma cópia.
 */

const PREFIX = "enc:v1:";
const MIN_SECRET_LENGTH = 32;

/** Campos cifrados. Só `Candidate` e `Application` têm colunas com estes nomes. */
export const SENSITIVE_FIELDS: ReadonlySet<string> = new Set(["rg", "cpf"]);

/** Chave de 32 bytes derivada do segredo. Segredo ausente ou curto → null. */
export function keyFromSecret(secret: string | null | undefined): Buffer | null {
  const value = secret?.trim();
  if (!value || value.length < MIN_SECRET_LENGTH) return null;
  return createHash("sha256").update(value, "utf8").digest();
}

let cachedKey: Buffer | null | undefined;

/** Chave do ambiente (lida uma vez por processo). */
export function fieldKey(): Buffer | null {
  if (cachedKey === undefined) {
    const secret = process.env.DATA_ENCRYPTION_KEY;
    cachedKey = keyFromSecret(secret);
    if (secret?.trim() && !cachedKey) {
      console.error(`[field-crypto] DATA_ENCRYPTION_KEY precisa de pelo menos ${MIN_SECRET_LENGTH} caracteres; RG/CPF seguem sem cifra.`);
    }
  }
  return cachedKey;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Cifra um valor. Sem chave, vazio ou já cifrado: devolve como veio. */
export function encryptField(value: string, key: Buffer | null): string {
  if (!key || !value || isEncrypted(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

/**
 * Abre um valor. Texto antigo (sem cifra) volta como está. Se não der para
 * abrir (sem chave, chave errada, valor adulterado) devolve null — o texto
 * cifrado nunca chega à tela.
 */
export function decryptField(value: string, key: Buffer | null): string | null {
  if (!isEncrypted(value)) return value;
  if (!key) return null;
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Filtros e seleções não são dados a gravar. */
const NOT_DATA = new Set(["where", "select", "include", "omit", "orderBy", "cursor", "distinct"]);

/**
 * Cifra `rg`/`cpf` nos argumentos de uma gravação do Prisma (data, create,
 * update, inclusive aninhados). Devolve uma cópia; não mexe em `where`.
 */
export function encryptSensitiveWrites<T>(args: T, key: Buffer | null): T {
  if (!key) return args;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (NOT_DATA.has(k)) out[k] = v;
      else if (SENSITIVE_FIELDS.has(k) && typeof v === "string") out[k] = encryptField(v, key);
      else if (SENSITIVE_FIELDS.has(k) && isPlainObject(v) && typeof v.set === "string")
        out[k] = { ...v, set: encryptField(v.set, key) };
      else out[k] = walk(v);
    }
    return out;
  };
  return walk(args) as T;
}

/** Abre `rg`/`cpf` em qualquer resultado do Prisma (linha, lista, relações). Altera no lugar. */
export function decryptSensitiveDeep<T>(result: T, key: Buffer | null): T {
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isPlainObject(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (SENSITIVE_FIELDS.has(k) && isEncrypted(v)) {
        const opened = decryptField(v, key);
        if (opened === null) console.error(`[field-crypto] não foi possível abrir o campo ${k}; confira DATA_ENCRYPTION_KEY.`);
        node[k] = opened;
      } else if (v !== null && typeof v === "object") walk(v);
    }
  };
  walk(result);
  return result;
}
