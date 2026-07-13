import type { Metadata } from "next";
import Link from "next/link";

import { getEmpresasPageData } from "@/server/controllers/admin.controller";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Empresas · Console Triagem" };

/** A1 · Empresas (frame 90:19) + A8 · Console vazio (105:95). */
export default async function EmpresasPage() {
  const { companies } = await getEmpresasPageData();
  const active = companies.filter((c) => c.isActive).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Empresas</h1>
          <p className="mt-2 text-sm text-[#71717a]">
            {companies.length === 1
              ? "1 cliente"
              : `${companies.length} clientes`}{" "}
            · {active} ativas
          </p>
        </div>
        <Link
          href="/admin/empresas/nova"
          className="flex h-10 items-center rounded-2xl bg-[#0a0a0a] px-5 text-[13px] font-medium text-white hover:opacity-90"
        >
          + Nova empresa
        </Link>
      </div>

      {companies.length === 0 ? (
        /* A8 · Console vazio (primeiro uso) */
        <div className="mt-16 flex flex-col items-center rounded-xl border border-dashed border-[#e4e4e7] bg-white px-8 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-[#f4f4f5] text-xl">
            ▲
          </span>
          <h2 className="mt-5 text-lg font-semibold text-[#0a0a0a]">
            Nenhuma empresa ainda
          </h2>
          <p className="mt-2 max-w-[360px] text-sm text-[#71717a]">
            Cadastre o primeiro cliente para gerar a página pública de vagas e
            o acesso do gestor.
          </p>
          <Link
            href="/admin/empresas/nova"
            className="mt-6 flex h-10 items-center rounded-2xl bg-[#0a0a0a] px-6 text-[13px] font-medium text-white hover:opacity-90"
          >
            + Nova empresa
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
          <div className="grid grid-cols-[minmax(200px,2fr)_140px_minmax(160px,1.5fr)_70px_110px_80px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-3.5">
            {["EMPRESA", "PÁGINA PÚBLICA", "GESTOR", "VAGAS", "STATUS", ""].map(
              (h, i) => (
                <span
                  key={i}
                  className="text-[11px] font-medium tracking-[0.6px] text-[#a1a1aa]"
                >
                  {h}
                </span>
              )
            )}
          </div>
          {companies.map((company) => (
            <div
              key={company.id}
              className="group grid grid-cols-[minmax(200px,2fr)_140px_minmax(160px,1.5fr)_70px_110px_80px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafaf9]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                  style={{ backgroundColor: company.primaryColor }}
                >
                  {personInitials(company.name)}
                </span>
                <span className="truncate text-[13px] font-medium text-[#0a0a0a]">
                  {company.name}
                </span>
              </div>
              <a
                href={`/${company.slug}/vagas`}
                target="_blank"
                className="truncate text-xs text-[#71717a] hover:text-[#0a0a0a] hover:underline"
              >
                /{company.slug}
              </a>
              <span className="truncate text-xs text-[#71717a]">
                {company.managerEmail ?? "—"}
              </span>
              <span className="text-xs text-[#0a0a0a]">{company.jobCount}</span>
              <span
                className={
                  "inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-3 text-[11px] font-medium " +
                  (company.isActive
                    ? "bg-[#e4f6ec] text-[#1f7a4d]"
                    : "bg-[#fbeae8] text-[#c23b3b]")
                }
              >
                <span className="size-1.5 rounded-full bg-current" />
                {company.isActive ? "Ativa" : "Suspensa"}
              </span>
              <Link
                href={`/admin/empresas/${company.id}`}
                className="text-right text-xs font-medium text-[#71717a] transition-colors hover:text-[#0a0a0a] hover:underline group-hover:text-[#0a0a0a]"
              >
                Editar ›
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
