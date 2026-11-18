const MONOGRAM_PALETTES = [
  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/70",
  "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70",
  "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70",
  "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70",
  "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/70",
  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/70",
  "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200/70",
];

const STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return MONOGRAM_PALETTES[Math.abs(hash) % MONOGRAM_PALETTES.length];
}

/**
 * Avatar do candidato nas telas do gestor: a foto recortada do currículo
 * quando existe; senão um monograma minimalista com as iniciais em tom
 * suave (padrão Linear / Attio / Ashby).
 */
export function CandidateAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, muda a cada hora
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${className} shrink-0 object-cover`}
      />
    );
  }

  const cleanClass = className
    .replace(/\bbg-\[#1c1917\]\b/g, "")
    .replace(/\bbg-black\b/g, "")
    .replace(/\btext-white\b/g, "")
    .trim();
  const palette = getPalette(name || "Candidato");
  const initials = getInitials(name || "Candidato");

  return (
    <span
      className={`${cleanClass} ${palette} inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-bold tracking-tight`}
      role="img"
      aria-label={`Iniciais de ${name}`}
    >
      {initials}
    </span>
  );
}
