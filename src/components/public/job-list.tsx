"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, Clock } from "lucide-react";

import {
  contractLabels,
  formatPublishedAgo,
  requirementsToBullets,
  workModeLabels,
  type PublicJob,
} from "@/server/models/job.model";

/* ─── helpers ─────────────────────────────────────────────── */

function firstLine(text: string, max = 110): string {
  const line = text.split("\n").find((l) => l.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

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
  const all = [{ label: "Todos", value: "" }, ...options];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[#b8b2ac]">
        {label}
      </span>
      {all.map((opt) => {
        const active = value === opt.value;
        const count = opt.value ? (counts[opt.value] ?? 0) : undefined;
        if (opt.value && count === 0) return null;
        return (
          <button
            key={opt.value}
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

/* ─── painel de detalhe ──────────────────────────────────── */

function JobPreviewPanel({
  job,
  slug,
  applied,
}: {
  job: PublicJob;
  slug: string;
  applied: boolean;
}) {
  const bullets = requirementsToBullets(job.requirements ?? "");
  const applyHref = `/${slug}/vagas/${job.id}/candidatar`;
  const tags = [
    job.location,
    workModeLabels[job.workMode],
    contractLabels[job.contract],
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-2xl border border-[#ebe7e3] bg-white p-7 shadow-[0_4px_24px_rgba(28,25,23,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[22px] font-bold leading-snug tracking-[-0.3px] text-[#1c1917]">
          {job.title}
        </h2>
        {isNew(job.createdAt) && (
          <span
            className="mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide"
            style={{ backgroundColor: "var(--brand-tint)", color: "var(--brand-primary)" }}
          >
            nova
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-[#f5f1ed] px-2.5 py-0.5 text-xs text-[#57534e]">
            {t}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[11px] text-[#a8a29e]">
          <Clock className="size-3" strokeWidth={1.5} />
          {formatPublishedAgo(job.createdAt)}
        </span>
      </div>

      <div className="mt-6 flex-1 space-y-5 text-[14px] leading-7 text-[#57534e]">
        <p className="whitespace-pre-line">{job.description}</p>
        {bullets.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#1c1917]">O que buscamos</p>
            <ul className="space-y-1.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span
                    className="mt-[9px] size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-7 border-t border-[#f0ece8] pt-5">
        {applied ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#f0faf4] px-4 py-3 text-[13px] font-medium text-[#16a34a]">
            <CheckCircle2 className="size-4 shrink-0" />
            Você já se candidatou a esta vaga
          </div>
        ) : (
          <Link
            href={applyHref}
            className="flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            Candidatar-se
          </Link>
        )}
        <Link
          href={`/${slug}/vagas/${job.id}`}
          className="mt-3 block text-center text-[12px] text-[#a8a29e] underline-offset-2 hover:text-[#57534e] hover:underline"
        >
          Ver página completa
        </Link>
      </div>
    </div>
  );
}

/* ─── alerta de vagas ────────────────────────────────────── */

function JobAlert({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // placeholder: integrar com Resend/Inngest quando RESEND_API_KEY estiver configurada
    setSent(true);
  }

  return (
    <div className="mt-16 rounded-2xl border border-[#ebe7e3] bg-white px-6 py-8 text-center">
      {sent ? (
        <p className="text-[14px] font-medium text-[#1c1917]">
          ✓ Avisaremos quando uma nova vaga for aberta.
        </p>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-[#1c1917]">
            Não encontrou a vaga certa?
          </p>
          <p className="mt-1 text-[13px] text-[#78716c]">
            Deixe seu e-mail e avisamos quando uma nova oportunidade abrir.
          </p>
          <form onSubmit={handleSubmit} className="mx-auto mt-4 flex max-w-[360px] gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-10 flex-1 rounded-xl border border-[#e4e0dc] bg-[#faf9f8] px-3 text-[13px] text-[#1c1917] placeholder:text-[#c4bfba] focus:border-[#1c1917] focus:outline-none"
            />
            <button
              type="submit"
              className="h-10 rounded-xl px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Avisar
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/* ─── componente principal ───────────────────────────────── */

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    jobs[0]?.id ?? null
  );

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (modeFilter && j.workMode !== modeFilter) return false;
      if (contractFilter && j.contract !== contractFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query, modeFilter, contractFilter]);

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

  if (jobs.length === 0) {
    return (
      <>
        <div className="py-16 text-center">
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
              href={`/${slug}/entrar?next=${encodeURIComponent(`/${slug}/minhas-candidaturas`)}&modo=entrar`}
              className="mt-6 inline-block text-[13px] font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Já se candidatou? Entre para acompanhar
            </Link>
          )}
        </div>
        <JobAlert slug={slug} />
      </>
    );
  }

  const modeOptions = Object.entries(workModeLabels).map(([value, label]) => ({ value, label }));
  const contractOptions = Object.entries(contractLabels).map(([value, label]) => ({ value, label }));

  return (
    <>
      {/* cabeçalho + busca */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-[#1c1917]">
          Vagas abertas
          <span className="ml-2 text-[13px] font-normal text-[#a8a29e]">{jobs.length}</span>
        </h2>
        {jobs.length >= 5 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cargo ou cidade…"
            aria-label="Buscar vagas"
            className="h-9 w-full rounded-full border border-[#e4e0dc] bg-white px-4 text-[13px] placeholder:text-[#c4bfba] focus:border-[#1c1917] focus:outline-none sm:w-[260px]"
          />
        )}
      </div>

      {/* filtros */}
      <div className="mt-4 space-y-2 border-y border-[#ebe7e3] py-3">
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
      </div>

      {/* split-panel */}
      <div className="mt-5 flex gap-6">
        {/* lista */}
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#78716c]">
              Nenhuma vaga para os filtros selecionados.
            </p>
          ) : (
            <ul className="divide-y divide-[#f0ece8]">
              {filtered.map((job) => {
                const active = selectedId === job.id;
                const applied = appliedJobIds.includes(job.id);
                const meta = [
                  job.location,
                  workModeLabels[job.workMode],
                  contractLabels[job.contract],
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={job.id}>
                    <button
                      onClick={() => {
                        setSelectedId(job.id);
                        if (window.innerWidth < 1024) {
                          router.push(`/${slug}/vagas/${job.id}`);
                        }
                      }}
                      className={[
                        "group w-full rounded-xl px-4 py-4 text-left transition-all",
                        active
                          ? "bg-[var(--brand-tint)]"
                          : "hover:bg-[#faf9f8]",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "text-[15px] font-semibold leading-snug transition-colors",
                                active
                                  ? "text-[var(--brand-primary)]"
                                  : "text-[#1c1917] group-hover:text-[var(--brand-primary)]",
                              ].join(" ")}
                            >
                              {job.title}
                            </span>
                            {isNew(job.createdAt) && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: "var(--brand-tint)",
                                  color: "var(--brand-primary)",
                                }}
                              >
                                nova
                              </span>
                            )}
                            {applied && (
                              <CheckCircle2
                                className="size-3.5 text-[#16a34a]"
                                strokeWidth={2}
                              />
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#a8a29e]">{meta}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#78716c] lg:hidden">
                            {firstLine(job.description)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* painel de detalhe (desktop) */}
        {selectedJob && (
          <div className="sticky top-6 hidden h-fit w-[420px] shrink-0 lg:block">
            <JobPreviewPanel
              job={selectedJob}
              slug={slug}
              applied={appliedJobIds.includes(selectedJob.id)}
            />
          </div>
        )}
      </div>

      <JobAlert slug={slug} />
    </>
  );
}
