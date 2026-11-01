import { isValidCpf } from "@/server/models/pre-interview.model";

/**
 * Dados de admissão que o candidato pode adiantar (tudo opcional): RG, CPF e
 * tamanhos de uniforme. Quem for aprovado precisa fornecer; informar antes só
 * acelera. Nunca entram na nota nem vão para a IA.
 */

/** 000.000.000-00 enquanto a pessoa digita. */
export function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export type AdmissionData = {
  rg: string | null;
  cpf: string | null;
  bootSize: string | null;
  pantsSize: string | null;
  shirtSize: string | null;
  /** "yes" | "no" | null (não respondeu). */
  hasBankAccount: string | null;
  bankNames: string | null;
  bankAccountType: string | null;
};

export const BANK_ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "salario", label: "Conta salário" },
] as const;

type RawAdmission = Partial<Record<keyof AdmissionData, string | null | undefined>>;

const clean = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max) || null;

/** Valida o que veio preenchido; em branco é aceito. CPF vai só com dígitos. */
export function parseAdmissionInput(
  raw: RawAdmission
): { ok: true; data: AdmissionData } | { ok: false; error: string } {
  const rg = clean(raw.rg, 20);
  if (rg && rg.length < 5) return { ok: false, error: "RG inválido. Confira ou deixe em branco." };

  const cpfRaw = clean(raw.cpf, 20);
  if (cpfRaw && !isValidCpf(cpfRaw)) {
    return { ok: false, error: "CPF inválido. Confira os números ou deixe em branco." };
  }

  const hasRaw = clean(raw.hasBankAccount, 5);
  const hasBankAccount = hasRaw === "yes" || hasRaw === "no" ? hasRaw : null;
  const typeRaw = clean(raw.bankAccountType, 20);
  const knownType = BANK_ACCOUNT_TYPES.some((t) => t.value === typeRaw);

  return {
    ok: true,
    data: {
      rg,
      cpf: cpfRaw ? cpfRaw.replace(/\D/g, "") : null,
      bootSize: clean(raw.bootSize, 10),
      pantsSize: clean(raw.pantsSize, 10),
      shirtSize: clean(raw.shirtSize, 10),
      hasBankAccount,
      // Quem não tem conta não tem banco nem tipo para informar.
      bankNames: hasBankAccount === "yes" ? clean(raw.bankNames, 120) : null,
      bankAccountType: hasBankAccount === "yes" && knownType ? typeRaw : null,
    },
  };
}
