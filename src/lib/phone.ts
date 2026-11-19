/**
 * Telefone brasileiro no mesmo padrão em qualquer tela: "(85) 99999-0000"
 * (celular) ou "(85) 3333-4444" (fixo). O DDI 55 é descartado; números que não
 * cabem no padrão (internacionais, incompletos) voltam como vieram.
 */
export function formatPhone(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\+\s*(?!55)/.test(raw)) return raw;
  let d = raw.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

/** Máscara de digitação: formata enquanto a pessoa escreve (até 11 dígitos). */
export function maskPhoneInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const WHATSAPP_HELP = "Informe apenas o DDD da cidade e o número, sem +55. Exemplo: (85) 99999-9999.";

/** Não corta dígitos extras: um DDI colado deve gerar erro, não um contato corrompido. */
export function maskDomesticPhoneInput(value: string): string {
  if (value.includes("+") || value.replace(/\D/g, "").length > 11) return value;
  return maskPhoneInput(value);
}

const BRAZIL_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99,
]);

export function domesticPhoneError(value: string, options: { optional?: boolean; mobile?: boolean } = {}): string | null {
  const raw = value.trim();
  if (!raw && options.optional) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.includes("+") || (digits.length > 11 && digits.startsWith("55"))) {
    return "Não inclua o código do país (+55). Informe apenas o DDD da cidade e o número.";
  }
  if (!/^[\d\s().-]+$/.test(raw) || !BRAZIL_DDDS.has(Number(digits.slice(0, 2))) ||
    (options.mobile ? !/^\d{2}9\d{8}$/.test(digits) : !/^\d{10,11}$/.test(digits))) {
    return options.mobile
      ? "Informe o WhatsApp com DDD e 9 dígitos. Exemplo: (85) 99999-9999."
      : "Informe o número de recado com DDD e 8 ou 9 dígitos, ou deixe em branco.";
  }
  return null;
}
