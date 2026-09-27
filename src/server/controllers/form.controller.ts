"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { formFieldInputSchema } from "@/server/models/form.model";
import {
  addFormField,
  removeFormField,
  setFormFieldRequired,
} from "@/server/services/form.service";

export type FormBuilderState = { error: string } | null;

export async function addFormFieldAction(
  _prev: FormBuilderState,
  formData: FormData
): Promise<FormBuilderState> {
  const user = await requireManager();
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const parsed = formFieldInputSchema.safeParse({
    label: formData.get("label"),
    type: formData.get("type"),
    required: formData.get("required") === "on",
    options,
    isCore: formData.get("isCore") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.type === "DROPDOWN" && parsed.data.options.length < 2) {
    return { error: "Dropdown precisa de pelo menos 2 opções." };
  }
  await addFormField(user.companyId, parsed.data);
  revalidatePath("/configuracoes/formulario");
  return null;
}

export async function toggleFieldRequiredAction(
  fieldId: string,
  required: boolean
): Promise<void> {
  const user = await requireManager();
  await setFormFieldRequired(user.companyId, fieldId, required);
  revalidatePath("/configuracoes/formulario");
}

export async function deleteFormFieldAction(
  fieldId: string
): Promise<{ error: string } | null> {
  const user = await requireManager();
  const result = await removeFormField(user.companyId, fieldId);
  revalidatePath("/configuracoes/formulario");
  return result.ok ? null : { error: result.error };
}
