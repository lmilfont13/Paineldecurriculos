import type { LucideIcon } from "lucide-react";

/**
 * Rótulo dos blocos da ficha do candidato: ícone num quadradinho com o tom
 * claro da marca e o texto na cor da marca. Mantém todos os blocos no mesmo
 * padrão (regra 4: a marca entra só como acento).
 */
export function SectionEyebrow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.6px]"
      style={{ color: "var(--brand-primary)" }}
    >
      <span
        className="flex size-5 items-center justify-center rounded-md"
        style={{ backgroundColor: "var(--brand-tint)" }}
      >
        <Icon className="size-3" aria-hidden />
      </span>
      {children}
    </p>
  );
}
