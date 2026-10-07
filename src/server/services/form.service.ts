import "server-only";

import {
  toPublicFormField,
  type FormFieldInput,
  type PublicFormField,
} from "@/server/models/form.model";
import {
  findCatalogQuestion,
  suggestQuestions,
  type QuestionSuggestion,
} from "@/server/models/question-catalog.model";
import {
  countAnswersByFieldId,
  createFormField,
  deleteFormField,
  findFormFieldById,
  findFormFieldsByCompanyId,
  findJobFormFields,
  updateFormField,
} from "@/server/repositories/form-field.repository";
import { findJobById } from "@/server/repositories/job.repository";

/**
 * Todos os campos que valem para uma vaga: os da empresa e, depois, os
 * desta vaga. Sem jobId, só os da empresa (construtor /formulario).
 */
export async function findFieldsForJob(companyId: string, jobId?: string) {
  const companyFields = await findFormFieldsByCompanyId(companyId);
  if (!jobId) return companyFields;
  const jobFields = await findJobFormFields(companyId, jobId);
  return [...companyFields, ...jobFields];
}

/**
 * Campos do formulário de candidatura do tenant (e da vaga, se informada).
 * `core` (isCore=true) → passo "Perfil"; `custom` → passo "Extras".
 */
export async function listApplicationFormFields(
  companyId: string,
  jobId?: string
): Promise<{
  core: PublicFormField[];
  custom: PublicFormField[];
}> {
  const fields = await findFieldsForJob(companyId, jobId);
  const publicFields = fields.map(toPublicFormField);
  return {
    core: publicFields.filter((f) => f.isCore),
    custom: publicFields.filter((f) => !f.isCore),
  };
}

/** Adiciona campo ao formulário do tenant (construtor /formulario e A5). */
export async function addFormField(companyId: string, input: FormFieldInput) {
  const fields = await findFormFieldsByCompanyId(companyId);
  const nextOrder = Math.max(0, ...fields.map((f) => f.order)) + 1;
  return createFormField({
    companyId,
    label: input.label,
    type: input.type,
    required: input.required,
    options: input.type === "DROPDOWN" ? input.options : [],
    order: nextOrder,
    isCore: input.isCore,
  });
}

async function getOwnedField(companyId: string, fieldId: string) {
  const field = await findFormFieldById(fieldId);
  if (!field || field.companyId !== companyId) return null;
  return field;
}

export async function setFormFieldRequired(
  companyId: string,
  fieldId: string,
  required: boolean
) {
  const field = await getOwnedField(companyId, fieldId);
  if (!field) return null;
  return updateFormField(fieldId, { required });
}

/**
 * Remove campo. Se já houver respostas ligadas a ele, a remoção é bloqueada
 * (preserva histórico de candidaturas).
 */
export async function removeFormField(
  companyId: string,
  fieldId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const field = await getOwnedField(companyId, fieldId);
  if (!field) return { ok: false, error: "Campo não encontrado." };
  const answers = await countAnswersByFieldId(fieldId);
  if (answers > 0) {
    return {
      ok: false,
      error:
        "Este campo já tem respostas de candidatos e não pode ser removido.",
    };
  }
  await deleteFormField(fieldId);
  return { ok: true };
}

async function getOwnedJob(companyId: string, jobId: string) {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return null;
  return job;
}

/**
 * Perguntas da vaga: as que ela já tem, as da empresa (aparecem em todas) e
 * o banco de sugestões, com as recomendadas para o texto da vaga primeiro.
 */
export async function getJobQuestions(
  companyId: string,
  jobId: string
): Promise<{
  questions: PublicFormField[];
  companyQuestions: string[];
  suggestions: QuestionSuggestion[];
} | null> {
  const job = await getOwnedJob(companyId, jobId);
  if (!job) return null;
  const companyFields = await findFormFieldsByCompanyId(companyId);
  const jobFields = await findJobFormFields(companyId, jobId);
  const jobText = [job.title, job.description, job.requirements ?? ""].join("\n");
  return {
    questions: jobFields.map(toPublicFormField),
    companyQuestions: companyFields.filter((f) => !f.isCore).map((f) => f.label),
    suggestions: suggestQuestions(
      jobText,
      [...companyFields, ...jobFields].map((f) => f.label)
    ),
  };
}

/** Cria uma pergunta só desta vaga (do banco de sugestões ou nova). */
export async function addJobQuestion(
  companyId: string,
  jobId: string,
  input: FormFieldInput
) {
  const job = await getOwnedJob(companyId, jobId);
  if (!job) return null;
  const jobFields = await findJobFormFields(companyId, jobId);
  const nextOrder = Math.max(0, ...jobFields.map((f) => f.order)) + 1;
  return createFormField({
    companyId,
    jobId,
    label: input.label,
    type: input.type,
    required: input.required,
    options: input.type === "DROPDOWN" ? input.options : [],
    order: nextOrder,
    isCore: false,
  });
}

/** Adiciona à vaga uma pergunta do banco de sugestões. */
export async function addCatalogQuestionToJob(
  companyId: string,
  jobId: string,
  catalogId: string
) {
  const question = findCatalogQuestion(catalogId);
  if (!question) return null;
  const existing = await findJobFormFields(companyId, jobId);
  if (existing.some((f) => f.label === question.label)) return existing[0];
  return addJobQuestion(companyId, jobId, {
    label: question.label,
    type: question.type,
    required: question.required,
    options: question.options,
    isCore: false,
  });
}
