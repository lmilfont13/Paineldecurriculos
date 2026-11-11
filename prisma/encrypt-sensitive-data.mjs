// Cifra o RG e o CPF que já estão no banco em texto normal.
//
//   node --env-file=.env prisma/encrypt-sensitive-data.mjs           → só conta (não grava)
//   node --env-file=.env prisma/encrypt-sensitive-data.mjs --apply   → cifra
//
// Pode rodar quantas vezes quiser: só mexe no que ainda está em texto normal.
// Precisa da mesma DATA_ENCRYPTION_KEY do site. Nunca imprime RG ou CPF.
// Formato igual ao de src/lib/field-crypto.ts (há um teste que confere os dois).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const PREFIX = "enc:v1:";

export function keyFromSecret(secret) {
  const value = secret?.trim();
  if (!value || value.length < 32) return null;
  return createHash("sha256").update(value, "utf8").digest();
}

export function encrypt(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}

export function decrypt(value, key) {
  const [iv, tag, data] = value.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const FIELDS = ["rg", "cpf"];
const plain = (field) => ({ AND: [{ [field]: { not: null } }, { NOT: { [field]: { startsWith: PREFIX } } }, { NOT: { [field]: "" } }] });

async function run(prisma, key, apply) {
  const summary = {};
  for (const model of ["candidate", "application"]) {
    for (const field of FIELDS) {
      const rows = await prisma[model].findMany({ where: plain(field), select: { id: true, [field]: true } });
      let done = 0;
      let skipped = 0;
      if (apply) {
        for (const row of rows) {
          const sealed = encrypt(row[field], key);
          // Confere que abre de volta antes de gravar.
          if (decrypt(sealed, key) !== row[field]) throw new Error(`conferência falhou em ${model}.${field} (${row.id})`);
          // Só grava se o valor não mudou enquanto o script rodava.
          const res = await prisma[model].updateMany({ where: { id: row.id, [field]: row[field] }, data: { [field]: sealed } });
          if (res.count === 1) done++;
          else skipped++;
        }
      }
      summary[`${model}.${field}`] = { emTextoNormal: rows.length, cifrados: done, alteradosDuranteAExecucao: skipped };
    }
  }
  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const key = keyFromSecret(process.env.DATA_ENCRYPTION_KEY);
  if (!key) {
    console.log("DATA_ENCRYPTION_KEY ausente (ou com menos de 32 caracteres): nada a fazer.");
    return null;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const summary = await run(prisma, key, apply);
    console.log(apply ? "RG/CPF cifrados:" : "Simulação (nada foi gravado; use --apply para cifrar):");
    console.table(summary);
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Falha ao cifrar RG/CPF:", error.message);
    process.exit(1);
  });
}
