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

      <ul className="mt-3 divide-y divide-[#e4e4e7] border-y border-[#e4e4e7]">
        {filtered.map((job) => (
          <li
            key={job.id}
            className="flex flex-col gap-4 py-6 md:flex-row md:items-center"
          >
            <div className="flex-1">
              <h2 className="text-[22px] font-bold text-[#0a0a0a]">
                {job.title}
              </h2>
              <p className="mt-2 max-w-[560px] text-sm text-[#71717a]">
                {firstLine(job.description)}
              </p>
            </div>
            <p className="w-[220px] text-sm text-[#71717a]">
              {formatJobMeta(job)}
            </p>
            <Link
              href={`/${slug}/vagas/${job.id}`}
              className="flex h-11 w-[170px] items-center justify-center gap-2 rounded-2xl border border-[#0a0a0a]/85 bg-white text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#0a0a0a] hover:text-white"
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
