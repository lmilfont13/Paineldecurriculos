"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
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
import { jobCity, splitJobTitle } from "@/server/models/job-title.model";
import { StructuredJobDescription } from "@/components/public/structured-job-description";

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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#78716c]">
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
                : "border-[#d6d0c8] bg-white text-[#44403c] hover:border-[#a8a29e]",
            ].join(" ")}
            style={
              active ? { backgroundColor: "var(--brand-primary)" } : undefined
            }
          >
            {opt.label}
            {count !== undefined && (
              <span
                className={`ml-1 ${active ? "opacity-75" : "text-[#78716c]"}`}
              >
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
  const title = splitJobTitle(job.title, job.location);
  const href = `/${slug}/vagas/${job.id}`;

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-[#e2ddd6] bg-white shadow-[0_1px_3px_rgba(28,25,23,0.06)] transition-[box-shadow,border-color] hover:border-[#cfc8bf] hover:shadow-[0_8px_24px_rgba(28,25,23,0.09)]">
      {/* Faixa da marca à esquerda: aparece ao passar o mouse. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: "var(--brand-primary)" }}
      />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {job.location && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ backgroundColor: "var(--brand-tint)", color: "var(--brand-primary)" }}
              >
                <MapPin className="size-3.5" />
                {job.location}
              </span>
            )}
            {isNew(job.createdAt) && (
              <span className="rounded-full border border-[#ecd9a6] bg-[#fbf3de] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7a5a12]">
                Nova
              </span>
            )}
            {applied && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                <CheckCircle2 className="size-3" />
                Inscrito
              </span>
            )}
          </div>

          <h3 className="mt-2.5 text-[18px] font-semibold leading-snug tracking-[-0.3px] text-[#1c1917]">
            {/* O card inteiro leva à vaga; o botão de detalhes fica por cima. */}
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {title}
            </Link>
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#57534e]">
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-3.5 text-[#78716c]" />
              {workModeLabels[job.workMode]} · {contractLabels[job.contract]}
            </span>
            <span className="inline-flex items-center gap-1 text-[#6b645e]">
              <Clock className="size-3.5" />
              {formatPublishedAgo(job.createdAt)}
            </span>
            {job.code && (
              <span className="font-mono text-[11.5px] text-[#6b645e]" title={`Código da vaga: #${job.code}`}>
                #{job.code}
              </span>
            )}
          </div>

          {summary && (
            <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-[#44403c]">
              {summary}
            </p>
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-3 sm:self-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-[#57534e] underline-offset-4 transition-colors hover:text-[#1c1917] hover:underline"
          >
            <span>{open ? "Menos detalhes" : "Detalhes"}</span>
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          <Link
            href={href}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl px-5 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90 sm:flex-none"
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
          className="relative z-10 border-t border-[#ebe6df] bg-[#faf8f5] p-5 text-[13px] leading-relaxed text-[#44403c] sm:p-6"
        >
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-[#1c1917]">Sobre a vaga</p>
              <StructuredJobDescription text={job.description} />
            </div>

            {bullets.length > 0 && (
              <div>
                <p className="font-semibold text-[#1c1917]">
                  Requisitos e qualificações
                </p>
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

/* ─── lista principal ─────────────────────────────────────── */

export function JobList({
  slug,
  jobs,
  companyName,
  loggedIn,
  appliedJobIds = [],
}: {
  slug: string;
  jobs: PublicJob[];
  companyName: string;
  loggedIn: boolean;
  appliedJobIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Filtros de vagas internas
  const modeCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.workMode] = (acc[j.workMode] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );

  const contractCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.contract] = (acc[j.contract] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );

  const cityCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        const city = jobCity(j.location);
        if (city) acc[city] = (acc[city] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );
  const cityOptions = Object.keys(cityCounts)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((city) => ({ value: city, label: city }));

  const filteredInternal = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (modeFilter && j.workMode !== modeFilter) return false;
      if (contractFilter && j.contract !== contractFilter) return false;
      if (cityFilter && jobCity(j.location) !== cityFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.code ?? "").toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query, modeFilter, contractFilter, cityFilter]);

  const modeOptions = Object.entries(workModeLabels).map(([value, label]) => ({
    value,
    label,
  }));
  const contractOptions = Object.entries(contractLabels).map(
    ([value, label]) => ({
      value,
      label,
    }),
  );

  return (
    <>
      {jobs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-base font-semibold text-[#1c1917]">
            Nenhuma vaga aberta agora
          </p>
          <p className="mx-auto mt-2 max-w-[400px] text-sm leading-6 text-[#78716c]">
            Quando a {companyName} abrir uma vaga, ela aparece aqui.
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
                `/${slug}/minhas-candidaturas`,
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
            <h2 className="text-[16px] font-semibold text-[#1c1917]">
              Vagas abertas
              <span className="ml-2 text-[13px] font-medium text-[#6b645e]">
                {jobs.length}
              </span>
            </h2>
            <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 sm:w-auto">
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
                  className="h-10 w-full rounded-full border border-[#d6d0c8] bg-white px-4 text-[13px] text-[#1c1917] shadow-sm placeholder:text-[#8a847e] focus:border-[#1c1917] focus:outline-none sm:w-[280px]"
                />
              )}
            </div>
          </div>

          {cityOptions.length > 1 && (
            <div className="mt-4">
              <FilterRow
                label="Cidade"
                options={cityOptions}
                value={cityFilter}
                onChange={setCityFilter}
                counts={cityCounts}
              />
            </div>
          )}

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
  );
}
