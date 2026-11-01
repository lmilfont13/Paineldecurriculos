"use client";

import { useState } from "react";

import { formatCpfInput } from "@/server/models/admission.model";

export type AdmissionValue = {
  rg: string;
  cpf: string;
  bootSize: string;
  pantsSize: string;
  shirtSize: string;
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
 * Dados de admissão, todos opcionais: informar agora adianta o processo. Quem
 * for aprovado precisa fornecê-los de qualquer forma. Os campos têm `name`,
 * então funcionam dentro de um <form> comum; `onChange` serve aos formulários
 * controlados.
 */
export function AdmissionFields({
  initial,
  onChange,
}: {
  initial?: Partial<AdmissionValue>;
  onChange?: (value: AdmissionValue) => void;
}) {
  const [value, setValue] = useState<AdmissionValue>({
    rg: initial?.rg ?? "",
    cpf: formatCpfInput(initial?.cpf ?? ""),
    bootSize: initial?.bootSize ?? "",
    pantsSize: initial?.pantsSize ?? "",
    shirtSize: initial?.shirtSize ?? "",
  });

  function update(patch: Partial<AdmissionValue>) {
    setValue((prev) => {
      const next = { ...prev, ...patch };
      onChange?.(next);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-[#f7f6f4] px-3 py-2.5 text-[12px] leading-5 text-[#57534e]">
        <strong className="text-[#0a0a0a]">Opcional.</strong> Você não é obrigado(a) a preencher agora, mas, se for aprovado(a),
        vai precisar fornecer esses dados para a admissão. Informar antes adianta o seu processo. Só a equipe de RH vê, e
        nada disso entra na avaliação do seu currículo.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label text="RG (opcional)">
          <input
            name="rg"
            value={value.rg}
            onChange={(e) => update({ rg: e.target.value })}
            placeholder="Número do RG"
            maxLength={20}
            autoComplete="off"
            className={inputClass}
          />
        </Label>
        <Label text="CPF (opcional)">
          <input
            name="cpf"
            inputMode="numeric"
            value={value.cpf}
            onChange={(e) => update({ cpf: formatCpfInput(e.target.value) })}
            placeholder="000.000.000-00"
            maxLength={14}
            autoComplete="off"
            className={inputClass}
          />
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Label text="Tamanho da bota (opcional)">
          <input
            name="bootSize"
            value={value.bootSize}
            onChange={(e) => update({ bootSize: e.target.value })}
            placeholder="Ex.: 40"
            maxLength={10}
            className={inputClass}
          />
        </Label>
        <Label text="Tamanho da calça (opcional)">
          <input
            name="pantsSize"
            value={value.pantsSize}
            onChange={(e) => update({ pantsSize: e.target.value })}
            placeholder="Ex.: 42"
            maxLength={10}
            className={inputClass}
          />
        </Label>
        <Label text="Tamanho da blusa (opcional)">
          <input
            name="shirtSize"
            value={value.shirtSize}
            onChange={(e) => update({ shirtSize: e.target.value })}
            placeholder="Ex.: M"
            maxLength={10}
            className={inputClass}
          />
        </Label>
      </div>
    </div>
  );
}
