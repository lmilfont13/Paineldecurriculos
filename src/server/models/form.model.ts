import type { FieldType, FormField } from "@prisma/client";
import { z } from "zod";

export const fieldTypeLabels: Record<FieldType, string> = {
  SHORT_TEXT: "texto curto",
  LONG_TEXT: "texto longo",
  DROPDOWN: "dropdown",
  YES_NO: "sim/não",
  NUMBER: "número",
  DATE: "data",
  FILE_UPLOAD: "arquivo",
};

export const formFieldInputSchema = z.object({
  label: z.string().min(2, "Informe o nome do campo."),
  type: z.enum([
    "SHORT_TEXT",
    "LONG_TEXT",
    "DROPDOWN",
    "YES_NO",
    "NUMBER",
    "DATE",
  ]),
  required: z.boolean(),
  options: z.array(z.string().min(1)).default([]),
  isCore: z.boolean().default(false),
});

export type FormFieldInput = z.infer<typeof formFieldInputSchema>;

/** Projeção pública do campo de formulário — o que o candidato vê. */
export type PublicFormField = Pick<
  FormField,
  "id" | "label" | "type" | "required" | "options" | "order" | "isCore"
>;

export function toPublicFormField(field: FormField): PublicFormField {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    order: field.order,
    isCore: field.isCore,
  };
}
