import "server-only";

import { prisma } from "@/lib/prisma";

export function findFormFieldsByCompanyId(companyId: string) {
  return prisma.formField.findMany({
    where: { companyId },
    orderBy: { order: "asc" },
  });
}

export function findFormFieldById(id: string) {
  return prisma.formField.findUnique({ where: { id } });
}

export function createFormField(data: {
  companyId: string;
  label: string;
  type: "SHORT_TEXT" | "LONG_TEXT" | "DROPDOWN" | "YES_NO" | "NUMBER" | "DATE";
  required: boolean;
  options: string[];
  order: number;
  isCore: boolean;
}) {
  return prisma.formField.create({ data });
}

export function updateFormField(
  id: string,
  data: Partial<{ label: string; required: boolean; options: string[] }>
) {
  return prisma.formField.update({ where: { id }, data });
}

export function deleteFormField(id: string) {
  return prisma.formField.delete({ where: { id } });
}

export function countAnswersByFieldId(fieldId: string) {
  return prisma.answer.count({ where: { fieldId } });
}
