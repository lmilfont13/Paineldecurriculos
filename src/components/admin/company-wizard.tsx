"use client";

import { useActionState, useRef, useState } from "react";

import {
  createCompanyAction,
  type CompanyFormState,
} from "@/server/controllers/company.controller";
import { createCompanySchema } from "@/server/models/company.model";

const STEPS = ["Dados", "Marca", "Página", "Formulário", "Gestor"] as const;

type Draft = {
  name: string;
  slug: string;
  email: string;
  cnpj: string;
  sector: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  managerName: string;
  managerEmail: string;
  managerPassword: string;
};

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** A2–A6 · Nova empresa, wizard de 5 passos (frames 101:* do Figma). */
export function CompanyWizard() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    slug: "",
    email: "",
    cnpj: "",
    sector: "",
    website: "",
    primaryColor: "#1E4FBF",
    secondaryColor: "#0E7A6B",
    logoUrl: "",
    heroTitle: "Trabalhe com a gente",
    heroSubtitle: "Candidate-se em minutos, sem criar conta.",
    aboutText: "",
    managerName: "",
    managerEmail: "",
    managerPassword: "",
  });
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    createCompanyAction,
    null
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function setName(name: string) {
    setDraft((d) => ({
      ...d,
      name,
      slug: slugTouched ? d.slug : slugify(name),
    }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (draft.name.trim().length < 2) return "Informe o nome da empresa.";
      if (!/^[a-z0-9-]{2,}$/.test(draft.slug))
        return "Slug: só letras minúsculas, números e hífens.";
      if (!/^\S+@\S+\.\S+$/.test(draft.email))
        return "Informe um e-mail válido.";
    }
    if (step === 2) {
      if (draft.heroTitle.trim().length < 2)
        return "Informe o título da página.";
      if (draft.heroSubtitle.trim().length < 2) return "Informe o subtítulo.";
    }
    if (step === 4) {
      const parsed = createCompanySchema.safeParse(draft);
      if (!parsed.success)
        return parsed.error.issues[0]?.message ?? "Dados inválidos.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const inputClass =
    "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";
  const labelClass = "mb-1.5 block text-sm font-medium text-[#0a0a0a]";
  const progress = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][step];

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {/* Stepper de 5 passos */}
      <ol className="flex justify-between px-4">
        {STEPS.map((label, i) => (
          <li key={label} className="flex w-24 flex-col items-center gap-2">
            <span
              className={
                "flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white " +
                (i < step
                  ? "bg-[#0a0a0a]"
                  : i === step
                    ? "bg-[#0a0a0a] ring-4 ring-[#0a0a0a]/15"
                    : "bg-[#e4e4e7]")
              }
            >
              {i < step ? "✓" : ""}
            </span>
            <span
              className={
                "text-xs " +
                (i === step ? "font-medium text-[#0a0a0a]" : "text-[#71717a]")
              }
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 h-1.5 w-full rounded-[3px] bg-[#e4e4e7]">
        <div
          className={`h-1.5 rounded-[3px] bg-[#0a0a0a] transition-all ${progress}`}
        />
      </div>

      <form
        action={formAction}
        className="mt-10 mb-4 flex min-h-[620px] flex-col rounded-3xl border border-[#e4e4e7] bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.07)]"
      >
        {Object.entries(draft).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        {/* Sempre montado (fora dos passos) para o arquivo persistir até o submit */}
        <input
          ref={logoFileRef}
          type="file"
          name="logoFile"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => setLogoFileName(e.target.files?.[0]?.name ?? null)}
        />

        <div className="flex-1">
          {step === 0 && (
            <StepShell
              title="Dados da empresa"
              subtitle="O básico do cliente na plataforma."
            >
              <label className="block">
                <span className={labelClass}>Nome da empresa</span>
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: TechNova Soluções"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Slug (página pública)</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#71717a]">/</span>
                  <input
                    className={inputClass}
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", e.target.value);
                    }}
                    placeholder="technova"
                  />
                </div>
              </label>
              <label className="block">
                <span className={labelClass}>E-mail de contato</span>
                <input
                  type="email"
                  className={inputClass}
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>CNPJ (opcional)</span>
                  <input
                    className={inputClass}
                    value={draft.cnpj}
                    onChange={(e) => set("cnpj", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Setor (opcional)</span>
                  <input
                    className={inputClass}
                    value={draft.sector}
                    onChange={(e) => set("sector", e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Site (opcional)</span>
                <input
                  className={inputClass}
                  value={draft.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://empresa.com"
                />
              </label>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              title="Marca do cliente"
              subtitle="Aparece só no fluxo público e no login do gestor."
            >
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Cor primária</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={draft.primaryColor}
                      onChange={(e) => set("primaryColor", e.target.value)}
                      className="size-10 cursor-pointer rounded-md border border-[#e4e4e7]"
                      aria-label="Cor primária"
                    />
                    <input
                      className={inputClass}
                      value={draft.primaryColor}
                      onChange={(e) => set("primaryColor", e.target.value)}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className={labelClass}>Cor secundária</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={draft.secondaryColor}
                      onChange={(e) => set("secondaryColor", e.target.value)}
                      className="size-10 cursor-pointer rounded-md border border-[#e4e4e7]"
                      aria-label="Cor secundária"
                    />
                    <input
                      className={inputClass}
                      value={draft.secondaryColor}
                      onChange={(e) => set("secondaryColor", e.target.value)}
                    />
                  </div>
                </label>
              </div>
              <div>
                <span className={labelClass}>Logo (opcional)</span>
                <div className="flex items-center gap-4 rounded-md border border-[#e4e4e7] bg-[#fafaf9] p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                      {logoFileName ?? "PNG, JPG, SVG ou WebP"}
                    </span>
                    <span className="block text-xs text-[#71717a]">
                      até 2 MB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    className="h-9 shrink-0 rounded-lg border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
                  >
                    {logoFileName ? "Trocar" : "Escolher"}
                  </button>
                </div>
              </div>
              <div
                className="mt-2 flex h-16 items-center gap-3 rounded-xl px-5"
                style={{ backgroundColor: draft.primaryColor }}
              >
                <span className="text-sm font-bold text-white">
                  {draft.name || "Prévia da marca"}
                </span>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              title="Página de carreiras"
              subtitle="Textos do hero da página pública."
            >
              <label className="block">
                <span className={labelClass}>Título</span>
                <input
                  className={inputClass}
                  value={draft.heroTitle}
                  onChange={(e) => set("heroTitle", e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Subtítulo</span>
                <input
                  className={inputClass}
                  value={draft.heroSubtitle}
                  onChange={(e) => set("heroSubtitle", e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Sobre a empresa (opcional)</span>
                <textarea
                  rows={4}
                  className="w-full rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm focus:border-[#0a0a0a] focus:outline-none"
                  value={draft.aboutText}
                  onChange={(e) => set("aboutText", e.target.value)}
                />
              </label>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              title="Formulário de candidatura"
              subtitle="O gestor também pode editar isso depois, no painel dele."
            >
              <p className="text-sm font-medium text-[#0a0a0a]">
                Núcleo (fixo em todas as empresas)
              </p>
              <ul className="space-y-2">
                {["Nome completo", "E-mail", "Telefone", "Currículo (PDF)"].map(
                  (label) => (
                    <li
                      key={label}
                      className="flex h-10 items-center justify-between rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-4"
                    >
                      <span className="text-[13px] font-medium text-[#0a0a0a]">
                        {label}
                      </span>
                      <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[9px] font-medium text-[#71717a]">
                        fixo
                      </span>
                    </li>
                  )
                )}
              </ul>
              <p className="rounded-md bg-[#f4f4f5] px-4 py-3 text-[13px] text-[#71717a]">
                Campos extras podem ser adicionados pelo gestor em
                “Formulário”, no painel da empresa.
              </p>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              title="Acesso do gestor"
              subtitle="Quem vai administrar o recrutamento desta empresa."
            >
              <label className="block">
                <span className={labelClass}>Nome do gestor</span>
                <input
                  className={inputClass}
                  value={draft.managerName}
                  onChange={(e) => set("managerName", e.target.value)}
                  placeholder="Ex.: Ana Ribeiro"
                />
              </label>
              <label className="block">
                <span className={labelClass}>E-mail de acesso</span>
                <input
                  type="email"
                  className={inputClass}
                  value={draft.managerEmail}
                  onChange={(e) => set("managerEmail", e.target.value)}
                  placeholder="ana.rh@empresa.com"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Senha temporária</span>
                <input
                  type="text"
                  className={inputClass}
                  value={draft.managerPassword}
                  onChange={(e) => set("managerPassword", e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </label>
              <p className="rounded-md bg-[#f4f4f5] px-4 py-3 text-[13px] text-[#71717a]">
                Compartilhe a senha com o gestor. O login dele fica em
                /login?empresa={draft.slug || "slug"}.
              </p>
            </StepShell>
          )}
        </div>

        {(error || state?.error) && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error ?? state?.error}
          </p>
        )}

        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
              disabled={pending}
              className="flex h-10 w-[100px] items-center justify-center gap-2 rounded-2xl border border-[#e4e4e7] bg-white text-sm font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              <span aria-hidden>‹</span> Voltar
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="flex h-10 w-32 items-center justify-center gap-2 rounded-2xl bg-[#0a0a0a] text-sm font-medium text-white hover:opacity-90"
            >
              Continuar <span aria-hidden>›</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="flex h-10 w-44 items-center justify-center rounded-2xl bg-[#0a0a0a] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Criando…" : "Criar empresa"}
            </button>
          )}
        </div>
      </form>

      <p className="pb-10 text-center text-sm text-[#71717a]">
        Passo {step + 1} de 5: {STEPS[step]}
      </p>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[#0a0a0a]">{title}</h1>
      <p className="mt-2 text-sm text-[#71717a]">{subtitle}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </>
  );
}
