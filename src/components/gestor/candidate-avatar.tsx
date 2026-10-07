import { personInitials } from "@/server/models/dashboard.model";

/**
 * Avatar do candidato nas telas do gestor: a foto recortada do currículo
 * quando existe, senão as iniciais. `className` define tamanho e forma
 * (as mesmas classes de antes, com fundo escuro para as iniciais).
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
  return <span className={className}>{personInitials(name)}</span>;
}
