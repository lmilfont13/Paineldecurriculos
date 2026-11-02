/**
 * Avatar do candidato nas telas do gestor: a foto recortada do currículo
 * quando existe, senão um desenho neutro de pessoa (o sistema não guarda nem
 * deduz sexo). `className` define tamanho e forma (as mesmas classes de antes,
 * com fundo escuro, que o desenho aproveita pela cor do texto).
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
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <span className={`${className} overflow-hidden`} role="img" aria-label={`Sem foto: ${name}`}>
      <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="9" r="4" opacity="0.85" />
        <path d="M3.5 24c0-5 3.8-8.2 8.5-8.2s8.5 3.2 8.5 8.2z" opacity="0.85" />
      </svg>
    </span>
  );
}
