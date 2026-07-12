import "server-only";

import {
  toPublicFormField,
  type FormFieldInput,
  type PublicFormField,
} from "@/server/models/form.model";
import {
  countAnswersByFieldId,
  createFormField,
  deleteFormField,
  findFormFieldById,
  findFormFieldsByCompanyId,
  updateFormField,
} from "@/server/repositories/form-field.repository";

/**
 * Campos do formulário de candidatura do tenant.
 * `core` (isCore=true) → passo "Perfil"; `custom` → passo "Extras".
 */
export async function listApplicationFormFields(companyId: string): Promise<{
  core: PublicFormField[];
  custom: PublicFormField[];
}> {
  const fields = await findFormFieldsByCompanyId(companyId);
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
