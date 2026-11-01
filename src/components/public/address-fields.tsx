"use client";

import { useState } from "react";

import { cepDigits, formatCep, isValidCep, parseViaCep } from "@/server/models/address.model";

export type AddressValue = {
  zipCode: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

const inputClass =
  "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">{text}</span>
      {children}
    </label>
  );
}

/**
 * Endereço completo com busca por CEP (ViaCEP): digitar o CEP preenche rua,
 * bairro, cidade e UF; número e complemento o candidato completa. Os campos têm
 * `name`, então funciona dentro de um <form> comum; `onChange` serve aos
 * formulários controlados.
 */
export function AddressFields({
  initial,
  onChange,
}: {
  initial?: Partial<AddressValue>;
  onChange?: (value: AddressValue) => void;
}) {
  const [value, setValue] = useState<AddressValue>({
    zipCode: formatCep(initial?.zipCode),
    street: initial?.street ?? "",
    streetNumber: initial?.streetNumber ?? "",
    complement: initial?.complement ?? "",
    neighborhood: initial?.neighborhood ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
  });
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "error"; text?: string }>({ kind: "idle" });

  function update(patch: Partial<AddressValue>) {
    setValue((prev) => {
      const next = { ...prev, ...patch };
      onChange?.(next);
      return next;
    });
  }

  async function lookup(cep: string) {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits(cep)}/json/`);
      const found = res.ok ? parseViaCep(await res.json()) : null;
      if (!found) {
        setStatus({ kind: "error", text: "Não achei esse CEP. Confira os números ou preencha o endereço abaixo." });
        return;
      }
      // Só preenche o que o CEP traz; CEP geral de cidade não traz rua nem bairro.
      update({
        street: found.street || value.street,
        neighborhood: found.neighborhood || value.neighborhood,
        city: found.city,
        state: found.state,
      });
      setStatus({ kind: "ok", text: found.street ? "Endereço encontrado. Informe o número." : "Cidade encontrada. Complete o endereço." });
    } catch {
      setStatus({ kind: "error", text: "Não consegui buscar o CEP agora. Preencha o endereço abaixo." });
    }
  }

  function onCepChange(raw: string) {
    const formatted = formatCep(raw);
    update({ zipCode: formatted });
    if (isValidCep(formatted)) void lookup(formatted);
    else setStatus({ kind: "idle" });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
        <Label text="CEP">
          <input
            name="zipCode"
            inputMode="numeric"
            autoComplete="postal-code"
            value={value.zipCode}
            onChange={(e) => onCepChange(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
            className={inputClass}
          />
        </Label>
        <p
          role={status.kind === "error" ? "alert" : undefined}
          className={
            "self-end pb-2 text-[12px] " +
            (status.kind === "error" ? "text-[#c23b3b]" : status.kind === "ok" ? "text-[#1f7a4d]" : "text-[#a1a1aa]")
          }
        >
          {status.kind === "loading"
            ? "Buscando CEP…"
            : (status.text ?? "Digite o CEP e preenchemos o endereço para você.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_1fr]">
        <Label text="Rua / Avenida">
          <input
            name="street"
            autoComplete="address-line1"
            value={value.street}
            onChange={(e) => update({ street: e.target.value })}
            placeholder="Nome da rua"
            className={inputClass}
          />
        </Label>
        <Label text="Número">
          <input
            name="streetNumber"
            value={value.streetNumber}
            onChange={(e) => update({ streetNumber: e.target.value })}
            placeholder="123"
            className={inputClass}
          />
        </Label>
        <Label text="Complemento (opcional)">
          <input
            name="complement"
            autoComplete="address-line2"
            value={value.complement}
            onChange={(e) => update({ complement: e.target.value })}
            placeholder="Apto, bloco, casa"
            className={inputClass}
          />
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_90px]">
        <Label text="Bairro">
          <input
            name="neighborhood"
            value={value.neighborhood}
            onChange={(e) => update({ neighborhood: e.target.value })}
            placeholder="Seu bairro"
            className={inputClass}
          />
        </Label>
        <Label text="Cidade">
          <input
            name="city"
            value={value.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="Sua cidade"
            className={inputClass}
          />
        </Label>
        <Label text="UF">
          <input
            name="state"
            maxLength={2}
            value={value.state}
            onChange={(e) => update({ state: e.target.value.toUpperCase() })}
            placeholder="CE"
            className={`${inputClass} uppercase`}
          />
        </Label>
      </div>
    </div>
  );
}
