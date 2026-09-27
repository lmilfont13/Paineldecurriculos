"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  contractLabels,
  workModeLabels,
  type PublicJob,
} from "@/server/models/job.model";

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 150 ? `${line.slice(0, 147)}…` : line;
}

/** Busca só aparece quando há vagas o bastante para precisar dela. */
const SEARCH_FROM = 5;

/** Lista de vagas: cartões grandes, o toque inteiro abre a vaga. */
export function JobList({
  slug,
  jobs,
  companyName,
  loggedIn,
}: {
  slug: string;
  jobs: PublicJob[];
  companyName: string;
  loggedIn: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q)
    );
  }, [jobs, query]);

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-[#ebe7e3] bg-white px-6 py-12 text-center">
        <p className="text-base font-semibold text-[#1c1917]">
          Nenhuma vaga aberta agora
        </p>
        <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-[#78716c]">
          Quando a {companyName} abrir uma vaga, ela aparece aqui.
        </p>
        {loggedIn ? (
          <Link
            href={`/${slug}/minhas-candidaturas`}
            className="mt-6 inline-block text-[13px] font-medium"
            style={{ color: "var(--brand-primary)" }}
          >
            Ver minhas candidaturas ›
          </Link>
        ) : (
          <Link
            href={`/${slug}/entrar?next=${encodeURIComponent(`/${slug}/minhas-candidaturas`)}&modo=entrar`}
            className="mt-6 inline-block text-[13px] font-medium"
            style={{ color: "var(--brand-primary)" }}
          >
            Já se candidatou antes? Entre para acompanhar ›
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#1c1917]">
          Vagas abertas
        </h2>
        {jobs.length >= SEARCH_FROM && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cargo ou cidade"
            aria-label="Buscar vagas"
            className="h-10 w-full rounded-xl border border-[#e4e0dc] bg-white px-4 text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:border-[#1c1917] focus:outline-none sm:w-[320px]"
          />
        )}
      </div>

      <ul className="mt-5 space-y-3">
        {filtered.map((job) => {
          const tags = [
            job.location,
            workModeLabels[job.workMode],
            contractLabels[job.contract],
          ].filter(Boolean) as string[];
          return (
            <li key={job.id}>
              <Link
                href={`/${slug}/vagas/${job.id}`}
                className="group flex flex-col gap-4 rounded-2xl border border-[#ebe7e3] bg-white p-5 transition-all hover:border-[#d9d2cb] hover:shadow-[0_6px_20px_rgba(28,25,23,0.06)] md:flex-row md:items-center md:gap-8 md:p-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold leading-snug text-[#1c1917] md:text-xl">
                    {job.title}
                  </span>
                  <span className="mt-2.5 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#f5f1ed] px-2.5 py-1 text-xs text-[#57534e]"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="mt-3 block max-w-[640px] text-sm leading-6 text-[#78716c]">
                    {firstLine(job.description)}
                  </span>
                </span>
                <span className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-primary)] px-5 text-sm font-medium text-[var(--brand-primary)] transition-colors group-hover:bg-[var(--brand-primary)] group-hover:text-[var(--brand-foreground)] md:w-[150px]">
                  Ver vaga <span aria-hidden>›</span>
                </span>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-[#e4e0dc] px-6 py-10 text-center text-sm text-[#78716c]">
            Nenhuma vaga encontrada para “{query}”.
          </li>
        )}
      </ul>
    </>
  );
}
