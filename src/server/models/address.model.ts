/** Endereço do candidato (necessário na admissão) e busca por CEP. Funções puras. */

export type AddressParts = {
  zipCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Só os dígitos do CEP, no máximo 8. */
export function cepDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 8);
}

/** 00000-000 (parcial enquanto a pessoa digita). */
export function formatCep(value: string | null | undefined): string {
  const d = cepDigits(value);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(value: string | null | undefined): boolean {
  const d = cepDigits(value);
  return d.length === 8 && !/^0+$/.test(d);
}

/** Resposta do ViaCEP → campos do endereço; null se o CEP não existe. */
export function parseViaCep(
  data: unknown
): { street: string; neighborhood: string; city: string; state: string } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.erro === true || d.erro === "true") return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const city = str(d.localidade);
  if (!city) return null;
  return {
    street: str(d.logradouro),
    neighborhood: str(d.bairro),
    city,
    state: str(d.uf).toUpperCase().slice(0, 2),
  };
}

/** Endereço em uma linha ("Rua X, 10 - Apto 2 - Bairro, Cidade/UF - CEP 00000-000"), ou null sem dados. */
export function formatAddress(a: AddressParts): string | null {
  const street = [a.street?.trim(), a.streetNumber?.trim()].filter(Boolean).join(", ");
  const place = [a.neighborhood?.trim(), [a.city?.trim(), a.state?.trim()].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
  const cep = isValidCep(a.zipCode) ? `CEP ${formatCep(a.zipCode)}` : "";
  const line = [street, a.complement?.trim(), place, cep].filter(Boolean).join(" - ");
  return line || null;
}
