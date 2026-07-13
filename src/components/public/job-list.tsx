"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatJobMeta, type PublicJob } from "@/server/models/job.model";

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

/** Lista de vagas com busca client-side (frame P1 do Figma). */
export function JobList({
  slug,
  jobs,
  subtitle,
}: {
  slug: string;
  jobs: PublicJob[];
  subtitle: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q)
    );
  }, [jobs, query]);

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <p className="max-w-[560px] text-[15px] leading-[23px] text-[#71717a]">
          {subtitle}
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cargo ou área…"
          aria-label="Buscar vagas"
          className="h-11 w-full rounded-[10px] border border-[#e4e4e7] bg-white px-4 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none md:w-[520px]"
        />
      </div>

      <p className="mt-10 text-[13px] font-medium text-[#71717a]">
        {filtered.length === 1
          ? "1 vaga aberta"
          : `${filtered.length} vagas abertas`}
      </p>

      {/* Mobile (M1): cards · Desktop (P1): linhas divididas */}
      <ul className="mt-3 space-y-4 md:space-y-0 md:divide-y md:divide-[#e4e4e7] md:border-y md:border-[#e4e4e7]">
        {filtered.map((job) => (
          <li
            key={job.id}
            className="group flex flex-col gap-3 rounded-[14px] border border-[#e4e4e7] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)] md:flex-row md:items-center md:gap-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:py-6 md:transition-colors md:hover:translate-y-0 md:hover:bg-[#f5f5f4]/60 md:hover:shadow-none"
          >
            <Link
              href={`/${slug}/vagas/${job.id}`}
              className="flex-1 focus-visible:outline-none"
            >
              <h2 className="text-base font-bold leading-snug text-[#0a0a0a] group-hover:underline md:text-[22px]">
                {job.title}
              </h2>
              <p className="mt-2 hidden max-w-[560px] text-sm text-[#71717a] md:block">
                {firstLine(job.description)}
              </p>
            </Link>
            <p className="text-xs text-[#71717a] md:w-[220px] md:text-sm">
              {formatJobMeta(job)}
            </p>
            <Link
              href={`/${slug}/vagas/${job.id}`}
              className="self-end text-xs font-medium text-[#0a0a0a] transition-colors md:flex md:h-11 md:w-[170px] md:items-center md:justify-center md:gap-2 md:self-auto md:rounded-2xl md:border md:border-[#0a0a0a]/85 md:bg-white md:text-sm md:group-hover:bg-[#0a0a0a] md:group-hover:text-white"
            >
              Ver vaga <span aria-hidden>›</span>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-10 text-sm text-[#71717a]">
            Nenhuma vaga encontrada para “{query}”.
          </li>
        )}
      </ul>
    </>
  );
}
