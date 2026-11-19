"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";

import { maskPhoneInput } from "@/lib/phone";
import { updateCandidateRegistrationAction } from "@/server/controllers/application.controller";
import type { EditableAnswer } from "@/components/gestor/answers-editor";
import { Toast } from "@/components/gestor/toast";

export type CandidateRegistrationInitial = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null; // YYYY-MM-DD
  rg: string | null;
  cpf: string | null;
  maritalStatus: string | null;
  hasChildren: boolean | null;
  childrenCount: number | null;
  zipCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  desiredRole: string | null;
  salaryExpectation: string | null;
  instagram: string | null;
  workPreference: string | null;
  availability: string | null;
  hasCnh: string | null;
  isPcd: boolean;
  pcdDetails: string | null;
  bootSize: string | null;
  pantsSize: string | null;
  shirtSize: string | null;
  hasBankAccount: string | null;
  bankNames: string | null;
  bankAccountType: string | null;
  professionalSummary: string | null;
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
};

type SectionTab = "pessoal" | "perfil" | "endereco" | "admissao" | "respostas";

const inputClass =
  "mt-1 h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#8b8b94] focus:border-[#0a0a0a] focus:outline-none";

const labelClass = "block text-xs font-medium text-[#52525b]";

export function CandidateRegistrationEditor({
  initial,
  answers = [],
  variant = "header",
}: {
  initial: CandidateRegistrationInitial;
  answers?: EditableAnswer[];
  variant?: "header" | "inline";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SectionTab>("pessoal");
  const [form, setForm] = useState<CandidateRegistrationInitial>(initial);
  const [answerMap, setAnswerMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(answers.map((a) => [a.id, a.value]))
  );
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (variant === "header" && searchParams.get("edit") === "1") {
      setForm(initial);
      setAnswerMap(Object.fromEntries(answers.map((a) => [a.id, a.value])));
      setOpen(true);
    }
  }, [searchParams, variant, initial, answers]);

  function openEditor() {
    setForm(initial);
    setAnswerMap(Object.fromEntries(answers.map((a) => [a.id, a.value])));
    setError(null);
    setOpen(true);
  }

  function setField<K extends keyof CandidateRegistrationInitial>(
    key: K,
    value: CandidateRegistrationInitial[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function lookupCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      setForm((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      /* falha silenciosa no autopreenchimento de CEP */
    }
  }

  function handleSave() {
    if (form.name.trim().length < 2) {
      setError("Informe o nome completo do candidato.");
      setTab("pessoal");
      return;
    }
    if (!form.email.trim().includes("@")) {
      setError("Informe um e-mail válido.");
      setTab("pessoal");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateCandidateRegistrationAction(initial.id, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          birthDate: form.birthDate,
          rg: form.rg,
          cpf: form.cpf,
          maritalStatus: form.maritalStatus,
          hasChildren: form.hasChildren,
          childrenCount: form.childrenCount,
          zipCode: form.zipCode,
          street: form.street,
          streetNumber: form.streetNumber,
          complement: form.complement,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
          desiredRole: form.desiredRole,
          salaryExpectation: form.salaryExpectation,
          instagram: form.instagram,
          workPreference: form.workPreference,
          availability: form.availability,
          hasCnh: form.hasCnh,
          isPcd: form.isPcd,
          pcdDetails: form.pcdDetails,
          bootSize: form.bootSize,
          pantsSize: form.pantsSize,
          shirtSize: form.shirtSize,
          hasBankAccount: form.hasBankAccount,
          bankNames: form.bankNames,
          bankAccountType: form.bankAccountType,
          professionalSummary: form.professionalSummary,
          aiProfile: form.aiProfile,
          aiArea: form.aiArea,
          aiLevel: form.aiLevel,
          answers: answerMap,
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setOpen(false);
        setToast("Cadastro do candidato atualizado com sucesso.");
        router.refresh();
      } catch {
        setError("Não foi possível salvar as alterações agora.");
      }
    });
  }

  const tabs: { key: SectionTab; label: string }[] = [
    { key: "pessoal", label: "Dados Pessoais" },
    { key: "perfil", label: "Perfil & Preferências" },
    { key: "endereco", label: "Endereço" },
    { key: "admissao", label: "Documentos, Uniforme & Banco" },
    ...(answers.length > 0 ? [{ key: "respostas" as SectionTab, label: `Respostas (${answers.length})` }] : []),
  ];

  return (
    <>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <button
        type="button"
        onClick={openEditor}
        className={
          variant === "header"
            ? "inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] shadow-2xs transition hover:bg-[#fafaf9]"
            : "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs font-medium text-[#0a0a0a] transition hover:border-[#0a0a0a]"
        }
        title="Abrir e editar todo o cadastro do candidato"
      >
        <Pencil className="size-3.5 text-[#52525b]" />
        <span>Editar cadastro</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="my-8 flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-[#e4e4e7] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#0a0a0a]">
                  Editar Cadastro Completo · {initial.name}
                </h2>
                <p className="text-xs text-[#71717a]">
                  Altere qualquer dado pessoal, endereço, documento, uniforme, conta bancária ou respostas do candidato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex size-8 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                aria-label="Fechar editor de cadastro"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Abas de Seção */}
            <div className="flex gap-1 overflow-x-auto border-b border-[#e4e4e7] bg-[#fafaf9] px-6 pt-2">
              {tabs.map((item) => {
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={
                      "-mb-px shrink-0 border-b-2 px-3.5 pb-2.5 pt-1.5 text-xs font-semibold transition-colors " +
                      (active
                        ? "border-[#0a0a0a] text-[#0a0a0a]"
                        : "border-transparent text-[#71717a] hover:text-[#0a0a0a]")
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Corpo do Formulário */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              {tab === "pessoal" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Nome completo *</span>
                    <input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={inputClass}
                      placeholder="Nome completo do candidato"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>E-mail *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className={inputClass}
                      placeholder="email@exemplo.com"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Telefone / WhatsApp</span>
                    <input
                      type="tel"
                      value={form.phone ?? ""}
                      onChange={(e) => setField("phone", maskPhoneInput(e.target.value))}
                      className={inputClass}
                      placeholder="(85) 99999-0000"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Data de nascimento</span>
                    <input
                      type="date"
                      value={form.birthDate ?? ""}
                      onChange={(e) => setField("birthDate", e.target.value || null)}
                      className={inputClass}
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Instagram (opcional)</span>
                    <input
                      value={form.instagram ?? ""}
                      onChange={(e) => setField("instagram", e.target.value)}
                      className={inputClass}
                      placeholder="@usuario"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Estado civil</span>
                    <select
                      value={form.maritalStatus ?? ""}
                      onChange={(e) => setField("maritalStatus", e.target.value || null)}
                      className={inputClass}
                    >
                      <option value="">Não informado</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="União estável">União estável</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className={labelClass}>Possui filhos?</span>
                      <select
                        value={form.hasChildren === null ? "" : form.hasChildren ? "yes" : "no"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setField("hasChildren", v === "" ? null : v === "yes");
                          if (v !== "yes") setField("childrenCount", null);
                        }}
                        className={inputClass}
                      >
                        <option value="">Não informado</option>
                        <option value="no">Não</option>
                        <option value="yes">Sim</option>
                      </select>
                    </label>

                    {form.hasChildren && (
                      <label>
                        <span className={labelClass}>Quantos filhos?</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={form.childrenCount ?? ""}
                          onChange={(e) =>
                            setField(
                              "childrenCount",
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className={inputClass}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {tab === "perfil" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Função pretendida / Cargo de interesse</span>
                    <input
                      value={form.desiredRole ?? ""}
                      onChange={(e) => setField("desiredRole", e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: Promotor de Vendas, Assistente"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Pretensão salarial</span>
                    <input
                      value={form.salaryExpectation ?? ""}
                      onChange={(e) => setField("salaryExpectation", e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: R$ 2.000 a R$ 3.500"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Modalidade preferida</span>
                    <select
                      value={form.workPreference ?? "ANY"}
                      onChange={(e) => setField("workPreference", e.target.value)}
                      className={inputClass}
                    >
                      <option value="ANY">Qualquer modalidade</option>
                      <option value="ONSITE">Presencial</option>
                      <option value="HYBRID">Híbrido</option>
                      <option value="REMOTE">100% Remoto</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Disponibilidade para início</span>
                    <select
                      value={form.availability ?? "IMMEDIATE"}
                      onChange={(e) => setField("availability", e.target.value)}
                      className={inputClass}
                    >
                      <option value="IMMEDIATE">Imediata</option>
                      <option value="15_DAYS">Até 15 dias</option>
                      <option value="30_DAYS">Até 30 dias</option>
                      <option value="NEGOTIABLE">A combinar</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Carteira de habilitação (CNH)</span>
                    <select
                      value={form.hasCnh ?? "NONE"}
                      onChange={(e) => setField("hasCnh", e.target.value)}
                      className={inputClass}
                    >
                      <option value="NONE">Não possui</option>
                      <option value="A">Categoria A (Moto)</option>
                      <option value="B">Categoria B (Carro)</option>
                      <option value="AB">Categoria AB (Carro e Moto)</option>
                      <option value="C_D_E">Categoria C, D ou E (Pesados)</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Senioridade (Classificação)</span>
                    <select
                      value={form.aiLevel ?? ""}
                      onChange={(e) => setField("aiLevel", e.target.value || null)}
                      className={inputClass}
                    >
                      <option value="">Não classificado</option>
                      <option value="Operacional">Operacional</option>
                      <option value="Júnior">Júnior</option>
                      <option value="Pleno">Pleno</option>
                      <option value="Sênior">Sênior</option>
                      <option value="Liderança">Liderança</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Área Profissional (Classificação)</span>
                    <input
                      value={form.aiArea ?? ""}
                      onChange={(e) => setField("aiArea", e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: Vendas, Logística, Administrativo"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Perfil / Especialidade</span>
                    <input
                      value={form.aiProfile ?? ""}
                      onChange={(e) => setField("aiProfile", e.target.value)}
                      className={inputClass}
                      placeholder="Ex.: Promotor de Merchandising"
                    />
                  </label>

                  <div className="sm:col-span-2 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3.5">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={form.isPcd}
                        onChange={(e) => setField("isPcd", e.target.checked)}
                        className="size-4 accent-[#0a0a0a]"
                      />
                      <span className="text-xs font-semibold text-[#0a0a0a]">
                        Pessoa com Deficiência (PcD)
                      </span>
                    </label>
                    {form.isPcd && (
                      <input
                        value={form.pcdDetails ?? ""}
                        onChange={(e) => setField("pcdDetails", e.target.value)}
                        className={inputClass + " mt-2"}
                        placeholder="Detalhes, CID ou adaptação necessária (opcional)"
                      />
                    )}
                  </div>

                  <label className="sm:col-span-2">
                    <span className={labelClass}>Resumo profissional</span>
                    <textarea
                      rows={3}
                      value={form.professionalSummary ?? ""}
                      onChange={(e) => setField("professionalSummary", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#e4e4e7] bg-white p-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                      placeholder="Resumo da trajetória ou observações profissionais do candidato…"
                    />
                  </label>
                </div>
              )}

              {tab === "endereco" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                  <label className="sm:col-span-2">
                    <span className={labelClass}>CEP</span>
                    <input
                      value={form.zipCode ?? ""}
                      onChange={(e) => {
                        setField("zipCode", e.target.value);
                        void lookupCep(e.target.value);
                      }}
                      className={inputClass}
                      placeholder="00000-000"
                    />
                  </label>

                  <label className="sm:col-span-3">
                    <span className={labelClass}>Rua / Logradouro</span>
                    <input
                      value={form.street ?? ""}
                      onChange={(e) => setField("street", e.target.value)}
                      className={inputClass}
                      placeholder="Nome da rua ou avenida"
                    />
                  </label>

                  <label className="sm:col-span-1">
                    <span className={labelClass}>Número</span>
                    <input
                      value={form.streetNumber ?? ""}
                      onChange={(e) => setField("streetNumber", e.target.value)}
                      className={inputClass}
                      placeholder="Nº"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className={labelClass}>Complemento</span>
                    <input
                      value={form.complement ?? ""}
                      onChange={(e) => setField("complement", e.target.value)}
                      className={inputClass}
                      placeholder="Apto, bloco, casa…"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className={labelClass}>Bairro</span>
                    <input
                      value={form.neighborhood ?? ""}
                      onChange={(e) => setField("neighborhood", e.target.value)}
                      className={inputClass}
                      placeholder="Bairro"
                    />
                  </label>

                  <label className="sm:col-span-1">
                    <span className={labelClass}>Cidade</span>
                    <input
                      value={form.city ?? ""}
                      onChange={(e) => setField("city", e.target.value)}
                      className={inputClass}
                      placeholder="Cidade"
                    />
                  </label>

                  <label className="sm:col-span-1">
                    <span className={labelClass}>UF</span>
                    <input
                      maxLength={2}
                      value={form.state ?? ""}
                      onChange={(e) => setField("state", e.target.value.toUpperCase())}
                      className={inputClass}
                      placeholder="CE"
                    />
                  </label>
                </div>
              )}

              {tab === "admissao" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>CPF</span>
                      <input
                        value={form.cpf ?? ""}
                        onChange={(e) => setField("cpf", e.target.value)}
                        className={inputClass}
                        placeholder="000.000.000-00"
                      />
                    </label>
                    <label>
                      <span className={labelClass}>RG</span>
                      <input
                        value={form.rg ?? ""}
                        onChange={(e) => setField("rg", e.target.value)}
                        className={inputClass}
                        placeholder="Documento de identidade"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label>
                      <span className={labelClass}>Tamanho da Bota / Calçado</span>
                      <input
                        value={form.bootSize ?? ""}
                        onChange={(e) => setField("bootSize", e.target.value)}
                        className={inputClass}
                        placeholder="Ex.: 39, 40, 42"
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Tamanho da Calça</span>
                      <input
                        value={form.pantsSize ?? ""}
                        onChange={(e) => setField("pantsSize", e.target.value)}
                        className={inputClass}
                        placeholder="Ex.: 38, 40, M, G"
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Tamanho da Blusa / Camisa</span>
                      <input
                        value={form.shirtSize ?? ""}
                        onChange={(e) => setField("shirtSize", e.target.value)}
                        className={inputClass}
                        placeholder="Ex.: P, M, G, GG"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label>
                      <span className={labelClass}>Possui conta bancária?</span>
                      <select
                        value={form.hasBankAccount ?? ""}
                        onChange={(e) => setField("hasBankAccount", e.target.value || null)}
                        className={inputClass}
                      >
                        <option value="">Não informado</option>
                        <option value="yes">Sim</option>
                        <option value="no">Não</option>
                      </select>
                    </label>

                    <label>
                      <span className={labelClass}>Banco(s)</span>
                      <input
                        value={form.bankNames ?? ""}
                        onChange={(e) => setField("bankNames", e.target.value)}
                        className={inputClass}
                        placeholder="Ex.: Itaú, Bradesco, Nubank"
                      />
                    </label>

                    <label>
                      <span className={labelClass}>Tipo de conta</span>
                      <select
                        value={form.bankAccountType ?? ""}
                        onChange={(e) => setField("bankAccountType", e.target.value || null)}
                        className={inputClass}
                      >
                        <option value="">Não informado</option>
                        <option value="corrente">Conta corrente</option>
                        <option value="poupanca">Conta poupança</option>
                        <option value="salario">Conta salário</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {tab === "respostas" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {answers.map((a) => (
                    <label
                      key={a.id}
                      className={"block " + (a.type === "LONG_TEXT" ? "sm:col-span-2" : "")}
                    >
                      <span className={labelClass}>{a.label}</span>
                      {a.type === "LONG_TEXT" ? (
                        <textarea
                          rows={3}
                          value={answerMap[a.id] ?? ""}
                          onChange={(e) =>
                            setAnswerMap((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-[#e4e4e7] bg-white p-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                        />
                      ) : (
                        <input
                          value={answerMap[a.id] ?? ""}
                          onChange={(e) =>
                            setAnswerMap((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          className={inputClass}
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-between border-t border-[#e4e4e7] bg-[#fafaf9] px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="h-10 rounded-xl border border-[#e4e4e7] bg-white px-4 text-xs font-semibold text-[#52525b] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending}
                className="h-10 rounded-xl px-5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {pending ? "Salvando alterações…" : "Salvar alterações no cadastro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
