"use client";

import { useActionState, useState, useTransition } from "react";

import type { Company } from "@prisma/client";

import {
  resetManagerPasswordAction,
  setCompanyActiveAction,
  updateCompanyAction,
  type CompanyFormState,
} from "@/server/controllers/company.controller";

const TABS = ["Dados", "Marca", "Página", "Gestor", "Status"] as const;

/** A7 · Editar empresa em abas (frame 105:2 do Figma). */
export function CompanyTabs({
  company,
  manager,
}: {
  company: Company;
  manager: { email: string; name: string | null } | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dados");
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    updateCompanyAction.bind(null, company.id),
    null
  );
  const [saved, setSaved] = useState(false);
  const [slugChanged, setSlugChanged] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [pwdState, pwdAction, pwdPending] = useActionState<
    CompanyFormState,
    FormData
  >(resetManagerPasswordAction.bind(null, company.id), null);
  const [pwdSaved, setPwdSaved] = useState(false);

  const inputClass =
    "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";
  const labelClass = "mb-1.5 block text-sm font-medium text-[#0a0a0a]";

  return (
    <div className="max-w-[560px]">
      <div className="flex gap-1 rounded-lg bg-[#f4f4f5] p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "h-8 flex-1 rounded-md text-[13px] transition-colors " +
              (tab === t
                ? "bg-white font-medium text-[#0a0a0a] shadow-sm"
                : "text-[#71717a] hover:text-[#0a0a0a]")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Gestor" ? (
        <div className="mt-6 rounded-3xl border border-[#e4e4e7] bg-white p-6">
          <p className="text-sm text-[#0a0a0a]">
            Gestor atual:{" "}
            <span className="font-semibold">
              {manager ? (manager.name ?? manager.email) : "—"}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-[#71717a]">
            {manager?.email ?? "Esta empresa não tem gestor cadastrado."}
          </p>
          {manager && (
            <form
              action={(formData) => {
                setPwdSaved(true);
                pwdAction(formData);
              }}
              className="mt-6 space-y-4"
            >
              <label className="block">
                <span className={labelClass}>Nova senha temporária</span>
                <input
                  name="password"
                  type="text"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className={inputClass}
                />
              </label>
              {pwdState?.error && (
                <p role="alert" className="text-sm text-red-600">
                  {pwdState.error}
                </p>
              )}
              {pwdSaved && !pwdState?.error && !pwdPending && (
                <p className="text-sm text-[#1f7a4d]">
                  Senha redefinida. Compartilhe com o gestor.
                </p>
              )}
              <button
                type="submit"
                disabled={pwdPending}
                className="h-10 rounded-2xl bg-[#0a0a0a] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pwdPending ? "Redefinindo…" : "Redefinir senha do gestor"}
              </button>
            </form>
          )}
        </div>
      ) : tab !== "Status" ? (
        <form
          action={(formData) => {
            setSaved(true);
            formAction(formData);
          }}
          className="mt-6 space-y-5 rounded-3xl border border-[#e4e4e7] bg-white p-6"
        >
          {tab === "Dados" && (
            <>
              <label className="block">
                <span className={labelClass}>Nome da empresa</span>
                <input name="name" defaultValue={company.name} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Slug (endereço público)</span>
                <input
                  name="slug"
                  defaultValue={company.slug}
                  onChange={(e) => setSlugChanged(e.target.value !== company.slug)}
                  className={inputClass}
                />
                {slugChanged ? (
                  <span className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[#b07818]">
                    <span aria-hidden>⚠</span>
                    Mudar o endereço quebra os links já divulgados
                    (/{company.slug}/vagas) — QR codes e posts deixarão de
                    funcionar.
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-[#a1a1aa]">
                    triagem.app/{company.slug}/vagas
                  </span>
                )}
              </label>
              <label className="block">
                <span className={labelClass}>E-mail de contato</span>
                <input name="email" type="email" defaultValue={company.email} className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>CNPJ</span>
                  <input name="cnpj" defaultValue={company.cnpj ?? ""} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Setor</span>
                  <input name="sector" defaultValue={company.sector ?? ""} className={inputClass} />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Site</span>
                <input name="website" defaultValue={company.website ?? ""} className={inputClass} />
              </label>
            </>
          )}

          {tab === "Marca" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Cor primária</span>
                  <input name="primaryColor" defaultValue={company.primaryColor} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Cor secundária</span>
                  <input name="secondaryColor" defaultValue={company.secondaryColor} className={inputClass} />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>URL do logo</span>
                <input name="logoUrl" defaultValue={company.logoUrl ?? ""} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>
                  Ou envie um arquivo (substitui a URL)
                </span>
                <input
                  name="logoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="block w-full text-[13px] text-[#71717a] file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-solid file:border-[#0a0a0a]/85 file:bg-white file:px-4 file:text-xs file:font-medium file:text-[#0a0a0a]"
                />
              </label>
            </>
          )}

          {tab === "Página" && (
            <>
              <label className="block">
                <span className={labelClass}>Título do hero</span>
                <input name="heroTitle" defaultValue={company.heroTitle} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Subtítulo</span>
                <input name="heroSubtitle" defaultValue={company.heroSubtitle} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Sobre a empresa</span>
                <textarea
                  name="aboutText"
                  rows={4}
                  defaultValue={company.aboutText ?? ""}
                  className="w-full rounded-md border border-[#e4e4e7] px-3 py-2 text-sm focus:border-[#0a0a0a] focus:outline-none"
                />
              </label>
            </>
          )}

          {state?.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          {saved && !state?.error && !pending && (
            <p className="text-sm text-[#1f7a4d]">Alterações salvas.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-2xl bg-[#0a0a0a] px-6 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 rounded-3xl border border-[#e4e4e7] bg-white p-6">
          <p className="text-sm text-[#0a0a0a]">
            Status atual:{" "}
            <span
              className={
                "font-semibold " +
                (company.isActive ? "text-[#1f7a4d]" : "text-[#c23b3b]")
              }
            >
              {company.isActive ? "Ativa" : "Suspensa"}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-[#71717a]">
            Suspender esconde a página pública de vagas e bloqueia novas
            candidaturas. Nenhum dado é apagado.
          </p>
          <button
            type="button"
            disabled={togglePending}
            onClick={() =>
              startToggle(() =>
                setCompanyActiveAction(company.id, !company.isActive)
              )
            }
            className={
              "mt-5 h-10 rounded-2xl px-6 text-sm font-medium disabled:opacity-60 " +
              (company.isActive
                ? "border border-[#e8d5d2] bg-white text-[#c23b3b] hover:bg-[#fdf7f6]"
                : "bg-[#0a0a0a] text-white hover:opacity-90")
            }
          >
            {togglePending
              ? "Aplicando…"
              : company.isActive
                ? "Suspender empresa"
                : "Reativar empresa"}
          </button>
        </div>
      )}
    </div>
  );
}
