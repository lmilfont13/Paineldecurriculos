import "server-only";

import {
  fillTemplate,
  subjectKey,
  toTemplate,
  type TemplateContext,
} from "@/server/models/message-templates.model";
import {
  findTemplate,
  findTemplatesByCompany,
  saveTemplate,
} from "@/server/repositories/message-template.repository";

export const MAX_SUBJECT_LENGTH = 80;
const MAX_BODY_LENGTH = 2000;

export function listMessageTemplates(companyId: string) {
  return findTemplatesByCompany(companyId);
}

/** Grava o recado enviado como modelo do assunto (nome/empresa/vaga viram marcadores). */
export async function rememberMessageTemplate(
  companyId: string,
  subject: string,
  text: string,
  ctx: TemplateContext
): Promise<void> {
  const cleanSubject = subject.trim().slice(0, MAX_SUBJECT_LENGTH).trim();
  const body = toTemplate(text.trim(), ctx).slice(0, MAX_BODY_LENGTH);
  if (!cleanSubject || !text.trim()) return;
  await saveTemplate(companyId, cleanSubject, subjectKey(cleanSubject), body);
}

/** Modelo salvo para o assunto, já preenchido para este candidato (null se não houver). */
export async function savedMessageForSubject(
  companyId: string,
  subject: string,
  ctx: TemplateContext
): Promise<string | null> {
  const key = subjectKey(subject.slice(0, MAX_SUBJECT_LENGTH));
  if (!key) return null;
  const saved = await findTemplate(companyId, key);
  return saved ? fillTemplate(saved.body, ctx) : null;
}
