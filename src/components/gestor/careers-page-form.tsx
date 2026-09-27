"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Toast } from "@/components/gestor/toast";
import {
  updateCareersPageAction,
  type SettingsState,
} from "@/server/controllers/settings.controller";
import {
  brandDeep,
  brandForeground,
  brandTint,
} from "@/server/models/company.model";

const input =
  "w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

type Company = {
  name: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string | null;
  primaryColor: string;
  logoUrl: string | null;
  logoFullUrl: string | null;
};

function LogoPicker({
  name,
  label,
  hint,
  current,
  square,
  onPreview,
}: {
  name: string;
  label: string;
  hint: string;
  current: string | null;
  square?: boolean;
  onPreview: (url: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? current;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3">
      <span
        className={
          "flex shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white p-1.5 " +
          (square ? "size-14" : "h-14 w-24")
        }
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-[10px] text-[#a1a1aa]">sem imagem</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[#0a0a0a]">
          {label}
        </span>
        <span className="block text-[11px] leading-4 text-[#71717a]">
          {hint}
        </span>
      </span>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="h-9 shrink-0 rounded-lg border border-[#0a0a0a]/85 bg-white px-3 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
      >
        Trocar
      </button>
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const url = file ? URL.createObjectURL(file) : null;
          setPreview(url);
          onPreview(url);
        }}
      />
    </div>
  );
}

/**
 * Configurações · Página de carreiras. O dono edita a própria vitrine e vê o
 * resultado enquanto digita, sem precisar salvar para descobrir como ficou.
 */
export function CareersPageForm({
  company,
  publicUrl,
}: {
  company: Company;
  publicUrl: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateCareersPageAction,
    null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: company.name,
    heroTitle: company.heroTitle,
    heroSubtitle: company.heroSubtitle,
    primaryColor: company.primaryColor,
  });
  const [fullPreview, setFullPreview] = useState<string | null>(null);

  useEffect(() => {
    if (state && "ok" in state) setToast("Página de carreiras atualizada.");
  }, [state]);

  const validColor = /^#[0-9a-fA-F]{6}$/.test(draft.primaryColor);
  const color = validColor ? draft.primaryColor : company.primaryColor;
  const logoFull = fullPreview ?? company.logoFullUrl;
  const set = (key: keyof typeof draft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]"
    >
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div className="min-w-0 space-y-8">
        <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Textos</h2>
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Nome da empresa
              </span>
              <input
                name="name"
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                className={`${input} h-10`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Título do topo
              </span>
              <input
                name="heroTitle"
                value={draft.heroTitle}
                onChange={(e) => set("heroTitle")(e.target.value)}
                className={`${input} h-10`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Apresentação
              </span>
              <textarea
                name="heroSubtitle"
                rows={3}
                value={draft.heroSubtitle}
                onChange={(e) => set("heroSubtitle")(e.target.value)}
                className={`${input} resize-y py-2 leading-5`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Sobre a empresa{" "}
                <span className="font-normal text-[#a1a1aa]">(opcional)</span>
              </span>
              <textarea
                name="aboutText"
                rows={4}
                defaultValue={company.aboutText ?? ""}
                placeholder="O que a empresa faz, onde atua, como é trabalhar aí. Aparece na página de cada vaga."
                className={`${input} resize-y py-2 leading-5`}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Marca</h2>
          <div className="mt-5 space-y-3">
            <LogoPicker
              name="logoFullFile"
              label="Logo completo"
              hint="Topo da página de vagas e tela de login. Fundo transparente fica melhor."
              current={company.logoFullUrl}
              onPreview={setFullPreview}
            />
            <LogoPicker
              name="logoFile"
              label="Símbolo"
              hint="Cabeçalho, ícone da aba do navegador e e-mails. Formato quadrado."
              current={company.logoUrl}
              square
              onPreview={() => {}}
            />
          </div>

          <div className="mt-6">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
              Cor principal
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => set("primaryColor")(e.target.value)}
                aria-label="Escolher cor"
                className="h-10 w-12 cursor-pointer rounded-lg border border-[#e4e4e7] bg-white p-1"
              />
              <input
                name="primaryColor"
                value={draft.primaryColor}
                onChange={(e) => set("primaryColor")(e.target.value)}
                className={`${input} h-10 w-28 font-mono`}
              />
              <span className="flex items-center gap-1.5 text-[11px] text-[#71717a]">
                <span className="size-5 rounded" style={{ background: color }} />
                <span
                  className="size-5 rounded"
                  style={{ background: brandDeep(color) }}
                />
                <span
                  className="size-5 rounded border border-[#e4e4e7]"
                  style={{ background: brandTint(color) }}
                />
                tons gerados a partir dela
              </span>
            </div>
          </div>
        </section>

        {state && "error" in state && (
          <p role="alert" className="text-sm text-[#c23b3b]">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending || !validColor}
            className="h-10 rounded-2xl px-6 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {pending ? "Salvando…" : "Salvar alterações"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            Ver a página no ar ↗
          </a>
        </div>
      </div>

      {/* Prévia: como o candidato vai ver, atualizada a cada tecla */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
          Prévia
        </p>
        <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-[#faf8f6] shadow-sm">
          <div
            className="px-6 pb-7 pt-6"
            style={{
              background: `linear-gradient(160deg, ${color} 0%, ${brandDeep(color)} 100%)`,
            }}
          >
            {logoFull ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoFull}
                alt=""
                className="h-12 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <span
                className="text-lg font-bold"
                style={{ color: brandForeground(color) }}
              >
                {draft.name}
              </span>
            )}
            <p className="mt-5 text-xl font-bold leading-tight text-white">
              {draft.heroTitle || "Título do topo"}
            </p>
            <p className="mt-2 text-[12px] leading-[18px] text-white/75">
              {draft.heroSubtitle || "Texto de apresentação"}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e4e4e7] bg-white p-3.5">
              <span>
                <span className="block text-[13px] font-semibold text-[#0a0a0a]">
                  Promotor(a) de Merchandising
                </span>
                <span className="block text-[11px] text-[#71717a]">
                  Fortaleza e região · Presencial
                </span>
              </span>
              <span
                className="rounded-xl px-3 py-1.5 text-[11px] font-medium"
                style={{
                  backgroundColor: color,
                  color: brandForeground(color),
                }}
              >
                Ver vaga
              </span>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
