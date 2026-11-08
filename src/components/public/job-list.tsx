"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  Info,
  MapPin,
} from "lucide-react";

import {
  contractLabels,
  formatPublishedAgo,
  requirementsToBullets,
  workModeLabels,
  type PublicJob,
} from "@/server/models/job.model";
import { jobSummary } from "@/server/models/job-description.model";
import { StructuredJobDescription } from "@/components/public/structured-job-description";
import {
  EXTERNAL_JOBS_DISCLAIMER,
  type PublicExternalJob,
} from "@/server/models/external-job.model";

const NEW_DAYS = 7;
const isNew = (d: Date | string) =>
  Date.now() - new Date(d).getTime() < NEW_DAYS * 86_400_000;

/* ─── filtros ─────────────────────────────────────────────── */

type Opt = { label: string; value: string };

function FilterRow({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  const available = options.filter((o) => (counts[o.value] ?? 0) > 0);
  if (available.length <= 1) return null;
  const all = [{ label: "Todos", value: "" }, ...available];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#b8b2ac]">
        {label}
      </span>
      {all.map((opt) => {
        const active = value === opt.value;
        const count = opt.value ? counts[opt.value] : undefined;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "rounded-full border px-3 py-0.5 text-[12px] font-medium transition-all",
              active
                ? "border-transparent text-[var(--brand-foreground)]"
                : "border-[#e4e0dc] bg-white text-[#57534e] hover:border-[#c8c2bb]",
            ].join(" ")}
            style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
          >
            {opt.label}
            {count !== undefined && (
              <span className={`ml-1 ${active ? "opacity-70" : "text-[#a8a29e]"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── cartão da vaga interna ─────────────────────────────── */

function JobCard({
  job,
  slug,
  applied,
  open,
  onToggle,
}: {
  job: PublicJob;
  slug: string;
  applied: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const bullets = requirementsToBullets(job.requirements ?? "");
  const summary = jobSummary(job.description);
  const panelId = `vaga-${job.id}`;

  return (
    <li className="overflow-hidden rounded-2xl border border-[#ebe7e3] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow hover:shadow-[0_4px_18px_rgba(28,25,23,0.07)]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.2px] text-[#1c1917]">
              {job.title}
            </h3>
            {job.code && (
              <span
                className="font-mono text-[11px] font-medium tracking-wide text-[#a8a29e]"
                title={`Código da vaga: #${job.code}`}
              >
                #{job.code}
              </span>
            )}
            {isNew(job.createdAt) && (
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#059669]">
                NOVA
              </span>
            )}
            {applied && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f3f0] px-2 py-0.5 text-[11px] font-medium text-[#78716c]">
                <CheckCircle2 className="size-3 text-[#1f7a4d]" />
                Inscrito
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#78716c]">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-[#a8a29e]" />
                {job.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-3.5 text-[#a8a29e]" />
              {workModeLabels[job.workMode]} · {contractLabels[job.contract]}
            </span>
            <span className="inline-flex items-center gap-1 text-[#a8a29e]">
              <Clock className="size-3.5" />
              {formatPublishedAgo(job.createdAt)}
            </span>
          </div>

          {summary && (
            <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-[#57534e]">
              {summary}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e4e0dc] bg-white px-3 text-[12px] font-medium text-[#57534e] transition-colors hover:border-[#c8c2bb] hover:text-[#1c1917]"
          >
            <span>{open ? "Menos detalhes" : "Mais detalhes"}</span>
            <ChevronDown
              className={`size-3.5 text-[#a8a29e] transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          <Link
            href={`/${slug}/vagas/${job.id}`}
            className="inline-flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {applied ? "Ver vaga" : "Candidatar-se"}
          </Link>
        </div>
      </div>

      {open && (
        <div
          id={panelId}
          className="border-t border-[#f4f3f0] bg-[#faf9f7] p-5 text-[13px] leading-relaxed text-[#57534e] sm:p-6"
        >
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-[#1c1917]">Sobre a vaga</p>
              <StructuredJobDescription text={job.description} />
            </div>

            {bullets.length > 0 && (
              <div>
                <p className="font-semibold text-[#1c1917]">Requisitos e qualificações</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/* ─── cartão da vaga externa ──────────────────────────────── */

function ExternalJobCard({ job }: { job: PublicExternalJob }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="overflow-hidden rounded-2xl border border-[#ebe7e3] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow hover:shadow-[0_4px_18px_rgba(28,25,23,0.07)]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.2px] text-[#1c1917]">
              {job.title}
            </h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-700 border border-blue-200">
              Vaga Externa
            </span>
            {job.source && (
              <span className="rounded-full bg-[#f4f3f0] px-2 py-0.5 text-[10px] font-medium text-[#78716c]">
                via {job.source}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#78716c]">
            <span className="font-medium text-[#1c1917]">
              Empresa: <strong>{job.employer}</strong>
            </span>
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-[#a8a29e]" />
                {job.location}
              </span>
            )}
            {job.scheduleType && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3.5 text-[#a8a29e]" />
                {job.scheduleType}
              </span>
            )}
            {job.postedLabel && (
              <span className="inline-flex items-center gap-1 text-[#a8a29e]">
                <Clock className="size-3.5" />
                {job.postedLabel}
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-[#57534e]">
              {job.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col sm:items-end gap-1.5">
          <div className="flex items-center gap-2">
            {job.description && (
              <button
                type="button"
                onClick={() => setOpen((c) => !c)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e4e0dc] bg-white px-3 text-[12px] font-medium text-[#57534e] transition-colors hover:border-[#c8c2bb] hover:text-[#1c1917]"
              >
                <span>{open ? "Menos" : "Detalhes"}</span>
                <ChevronDown
                  className={`size-3.5 text-[#a8a29e] transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}

            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1c1917] px-4 text-[12px] font-semibold text-white shadow-2xs hover:bg-black transition active:scale-95"
            >
              <span>Candidatar-se na Fonte</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          <span className="text-[10px] text-[#a8a29e]">
            Inscrição gerenciada pela empresa anunciante
          </span>
        </div>
      </div>

      {open && job.description && (
        <div className="border-t border-[#f4f3f0] bg-[#faf9f7] p-5 text-[13px] leading-relaxed text-[#57534e] sm:p-6">
          <p className="font-semibold text-[#1c1917] mb-2">Descrição da oportunidade:</p>
          <p className="whitespace-pre-line text-[#57534e] leading-relaxed">
            {job.description}
          </p>
        </div>
      )}
    </li>
  );
}

/* ─── lista principal ─────────────────────────────────────── */

export function JobList({
  slug,
  jobs,
  companyName,
  loggedIn,
  appliedJobIds = [],
  externalJobs = [],
}: {
  slug: string;
  jobs: PublicJob[];
  companyName: string;
  loggedIn: boolean;
  appliedJobIds?: string[];
  externalJobs?: PublicExternalJob[];
}) {
  const hasExternal = externalJobs.length > 0;
  const [activeTab, setActiveTab] = useState<"internal" | "external">(() =>
    jobs.length === 0 && hasExternal ? "external" : "internal"
  );

  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Filtros de vagas internas
  const modeCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.workMode] = (acc[j.workMode] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs]
  );

  const contractCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.contract] = (acc[j.contract] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs]
  );

  const filteredInternal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (modeFilter && j.workMode !== modeFilter) return false;
      if (contractFilter && j.contract !== contractFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.code ?? "").toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query, modeFilter, contractFilter]);

  // Filtros de vagas externas
  const filteredExternal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return externalJobs;
    return externalJobs.filter((j) => {
      return (
        j.title.toLowerCase().includes(q) ||
        j.employer.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q) ||
        (j.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [externalJobs, query]);

  const modeOptions = Object.entries(workModeLabels).map(([value, label]) => ({
    value,
    label,
  }));
  const contractOptions = Object.entries(contractLabels).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <>
      {/* Abas Superiores: Vagas Diretas vs Oportunidades Externas */}
      {hasExternal && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#e4e0dc] pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("internal");
              setQuery("");
            }}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition ${
              activeTab === "internal"
                ? "bg-[#1c1917] text-white shadow-xs"
                : "text-[#57534e] hover:bg-white hover:text-[#1c1917]"
            }`}
          >
            Vagas da {companyName} ({jobs.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("external");
              setQuery("");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition ${
              activeTab === "external"
                ? "bg-[#1c1917] text-white shadow-xs"
                : "text-[#57534e] hover:bg-white hover:text-[#1c1917]"
            }`}
          >
            <Globe className="size-3.5 text-blue-500" />
            <span>Mural de Vagas Externas ({externalJobs.length})</span>
          </button>
        </div>
      )}

      {/* SEÇÃO 1: VAGAS DA EMPRESA */}
      {activeTab === "internal" && (
        <>
          {jobs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-semibold text-[#1c1917]">
                Nenhuma vaga interna aberta agora
              </p>
              <p className="mx-auto mt-2 max-w-[400px] text-sm leading-6 text-[#78716c]">
                Quando a {companyName} abrir uma vaga direta, ela aparece aqui.
                {hasExternal && " Enquanto isso, confira as vagas externas no mural!"}
              </p>
              {loggedIn ? (
                <Link
                  href={`/${slug}/minhas-candidaturas`}
                  className="mt-6 inline-block text-[13px] font-medium underline-offset-2 hover:underline"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Ver minhas candidaturas
                </Link>
              ) : (
                <Link
                  href={`/${slug}/entrar?next=${encodeURIComponent(
                    `/${slug}/minhas-candidaturas`
                  )}&modo=entrar`}
                  className="mt-6 inline-block text-[13px] font-medium underline-offset-2 hover:underline"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Já se candidatou? Entre para acompanhar
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <h2 className="text-[15px] font-semibold text-[#1c1917]">
                  Vagas abertas
                  <span className="ml-2 text-[13px] font-normal text-[#a8a29e]">
                    {jobs.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <FilterRow
                    label="Modalidade"
                    options={modeOptions}
                    value={modeFilter}
                    onChange={setModeFilter}
                    counts={modeCounts}
                  />
                  <FilterRow
                    label="Contrato"
                    options={contractOptions}
                    value={contractFilter}
                    onChange={setContractFilter}
                    counts={contractCounts}
                  />
                  {jobs.length >= 5 && (
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por cargo, código ou cidade…"
                      aria-label="Buscar vagas"
                      className="h-9 w-full rounded-full border border-[#e4e0dc] bg-white px-4 text-[13px] placeholder:text-[#c4bfba] focus:border-[#1c1917] focus:outline-none sm:w-[260px]"
                    />
                  )}
                </div>
              </div>

              {filteredInternal.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#78716c]">
                  Nenhuma vaga para os filtros selecionados.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {filteredInternal.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      slug={slug}
                      applied={appliedJobIds.includes(job.id)}
                      open={openId === job.id}
                      onToggle={() =>
                        setOpenId((cur) => (cur === job.id ? null : job.id))
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {/* SEÇÃO 2: MURAL DE VAGAS EXTERNAS (GOOGLE VAGAS) */}
      {activeTab === "external" && (
        <>
          {/* Banner de Isenção de Responsabilidade Legal */}
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950 sm:p-5 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-900 mt-0.5 font-bold">
                <Info className="size-4" />
              </span>
              <div>
                <p className="font-bold text-[13px] text-amber-950">
                  Mural Comunitário · Aviso de Isenção de Responsabilidade
                </p>
                <p className="mt-1 leading-relaxed text-amber-900">
                  {EXTERNAL_JOBS_DISCLAIMER}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 className="text-[15px] font-semibold text-[#1c1917]">
              Oportunidades em outros locais
              <span className="ml-2 text-[13px] font-normal text-[#a8a29e]">
                {externalJobs.length}
              </span>
            </h2>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cargo, empresa ou cidade…"
              aria-label="Buscar vagas externas"
              className="h-9 w-full rounded-full border border-[#e4e0dc] bg-white px-4 text-[13px] placeholder:text-[#c4bfba] focus:border-[#1c1917] focus:outline-none sm:w-[280px]"
            />
          </div>

          {filteredExternal.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#78716c]">
              Nenhuma oportunidade encontrada para a busca &quot;{query}&quot;.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredExternal.map((job) => (
                <ExternalJobCard key={job.id} job={job} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
