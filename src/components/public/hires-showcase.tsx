import { BadgeCheck } from "lucide-react";

import type { PublicHire } from "@/server/models/showcase.model";

/**
 * "Quem já entrou": aprovados que autorizaram aparecer na página de vagas.
 * Só nome, vaga, cidade e mês — nada de nota, foto ou contato.
 */
export function HiresShowcase({ hires, companyName }: { hires: PublicHire[]; companyName: string }) {
  if (hires.length === 0) return null;
  return (
    <section
      aria-labelledby="contratados"
      className="mt-8 rounded-2xl border border-[#e2ddd6] bg-white p-6 shadow-[0_1px_3px_rgba(28,25,23,0.06)] md:p-7"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78716c]">
        Contratações recentes
      </p>
      <h2 id="contratados" className="mt-2 text-lg font-semibold tracking-[-0.2px] text-[#1c1917]">
        Quem já entrou pela {companyName}
      </h2>
      <p className="mt-1 text-[13px] leading-6 text-[#57534e]">
        Pessoas que se candidataram por aqui, foram escolhidas e autorizaram aparecer nesta página.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hires.map((hire) => (
          <li
            key={hire.id}
            className="flex items-start gap-3 rounded-xl border border-[#ece8e1] bg-[#faf8f5] p-4"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
                color: "var(--brand-primary)",
              }}
            >
              <BadgeCheck className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#1c1917]">{hire.name}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#44403c]">{hire.role}</p>
              <p className="mt-1 text-[12px] text-[#78716c]">
                {[hire.city, `contratado(a) em ${hire.month}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
