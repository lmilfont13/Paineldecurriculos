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
