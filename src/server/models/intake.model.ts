/**
 * Cadastro rápido pelo gestor: cola uma lista de e-mails (com nome e
 * telefone opcionais) e o sistema já cria as candidaturas; o candidato
 * completa depois. Funções puras — testadas em intake.model.test.ts.
 */

export const INTAKE_LIMIT = 50;

export type IntakeEntry = { email: string; name: string; phone: string | null };
export type IntakeParse = { entries: IntakeEntry[]; invalid: string[] };

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

/** "joao.silva_23@x.com" → "Joao Silva". */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[0-9]+/g, " ")
    .split(/[._\-+]+|\s+/)
    .filter((w) => w.length > 1);
  if (words.length === 0) return local || email;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * Uma pessoa por linha: "email", "email, nome" ou "email; nome; telefone"
 * (a ordem de nome e telefone tanto faz). Aceita "Nome <email>" também.
 * E-mails repetidos entram uma vez só.
 */
export function parseIntakeList(text: string): IntakeParse {
  const entries: IntakeEntry[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const angle = line.match(/^(.*)<([^>]+)>(.*)$/);
    const parts = (angle ? [angle[2], angle[1], angle[3]] : line.split(/[,;\t]/))
      .map((p) => p.trim())
      .filter(Boolean);
    const emailIndex = parts.findIndex((p) => EMAIL.test(p));
    if (emailIndex < 0) {
      invalid.push(line);
      continue;
    }
    const email = parts[emailIndex].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const rest = parts.filter((_, i) => i !== emailIndex);
    const phone = rest.find((p) => p.replace(/\D/g, "").length >= 10) ?? null;
    const name = rest.find((p) => p !== phone && /[a-zà-ú]/i.test(p));
    entries.push({
      email,
      name: name ? name.replace(/\s+/g, " ").slice(0, 80) : nameFromEmail(email),
      phone: phone ? phone.slice(0, 30) : null,
    });
  }
  return { entries: entries.slice(0, INTAKE_LIMIT), invalid };
}

/** Mensagem de convite para completar a candidatura (WhatsApp / copiar). */
export function intakeInviteText(params: {
  name: string;
  company: string;
  jobTitle: string;
  url: string;
  email: string;
}): string {
  const first = params.name.trim().split(/\s+/)[0] ?? "";
  return (
    `Oi, ${first}! Aqui é da ${params.company}. Já deixamos sua candidatura para a vaga ` +
    `${params.jobTitle} iniciada. Para completar (leva uns 3 minutos), entre por aqui e ` +
    `crie sua senha com o e-mail ${params.email}: ${params.url}`
  );
}

/** Quantos PDFs por lote (cada um é lido e analisado). */
export const BATCH_RESUME_LIMIT = 30;

/** Pasta dos PDFs subidos em lote pelo gestor (antes de saber quem é a pessoa). */
export function batchResumePrefix(companyId: string, jobId: string): string {
  return `${companyId}/${jobId}/lote/`;
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_IN_TEXT = /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g;

/** Contatos achados no texto do currículo (sem IA). */
export function findContacts(text: string): { email: string | null; phone: string | null } {
  const email = text.match(EMAIL_IN_TEXT)?.[0]?.toLowerCase() ?? null;
  const phone =
    (text.match(PHONE_IN_TEXT) ?? [])
      .map((p) => p.trim())
      .find((p) => {
        const d = p.replace(/\D/g, "");
        return d.length >= 10 && d.length <= 13;
      }) ?? null;
  return { email, phone };
}

/**
 * Nome provável: a primeira linha do currículo com 2 a 5 palavras só de
 * letras (é como quase todo currículo começa). Senão, o nome do arquivo.
 */
export function guessName(text: string, fileName: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .find((l) => {
      const words = l.split(" ");
      return (
        words.length >= 2 &&
        words.length <= 5 &&
        /^[A-Za-zÀ-ÿ' .-]+$/.test(l) &&
        !/curr[ií]culo|resume|vitae/i.test(l)
      );
    });
  if (line) {
    return line
      .toLowerCase()
      .split(" ")
      .map((w) => (["da", "de", "do", "das", "dos", "e"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  }
  const base = fileName.replace(/\.pdf$/i, "").replace(/curr[ií]culo|cv|resume/gi, " ");
  return nameFromEmail(`${base}@x`).trim() || "Candidato sem nome";
}

/** Lê {name, email, phone} devolvido pela IA; campos inválidos viram null. */
export function parseContactJson(raw: string): { name: string | null; email: string | null; phone: string | null } {
  try {
    const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;
    const name = String(data.name ?? "").replace(/\s+/g, " ").trim();
    const email = String(data.email ?? "").trim().toLowerCase();
    const phone = String(data.phone ?? "").trim();
    return {
      name: name.length >= 3 && name.length <= 80 ? name : null,
      email: EMAIL.test(email) ? email : null,
      phone: phone.replace(/\D/g, "").length >= 10 ? phone.slice(0, 30) : null,
    };
  } catch {
    return { name: null, email: null, phone: null };
  }
}

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim().toLowerCase());
}
