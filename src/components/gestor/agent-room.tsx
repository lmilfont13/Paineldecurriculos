"use client";

import type { LiveAgentRun } from "@/components/gestor/agent-live-monitor";

/**
 * Sala dos agentes: os três agentes como bonecos nas mesas, a fila de
 * candidatos na porta e um balão com a etapa real de cada execução
 * (AgentRun.summary). Só o agente que está trabalhando se mexe.
 *
 * Coordenadas no viewBox 760 × 262; os balões são HTML posicionados em %
 * sobre o SVG para quebrar linha e escalar junto no celular.
 */

const W = 760;
const H = 262;

const C = {
  wall: "#F3F6F9",
  floor: "#E3E9EF",
  line: "#C9D3DC",
  desk: "#B98E66",
  deskEdge: "#9C7552",
  ink: "#22303C",
  idle: "#8A99A8",
  skin: ["#F2C9A5", "#C68A62", "#8D5A3B", "#E8B48F", "#A8714D", "#F0D2B6"],
  shirt: ["#5B7FA6", "#6F9A7E", "#B07A9C", "#C2A35A", "#6E8C99", "#9D7BB0"],
};

type Seat = { x: number; y: number };
const TRIAGE: Seat = { x: 392, y: 178 };
const COMMS: Seat = { x: 575, y: 178 };
const INTEL: Seat = { x: 690, y: 178 };
const ATTENDED: Seat = { x: 318, y: 238 };
const QUEUE_X0 = 116;
const QUEUE_GAP = 34;
const QUEUE_Y = 238;
const MAX_QUEUE = 5;

function hashIndex(text: string, mod: number) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Pessoa de pé (candidato), pés em (x, y). */
function Person({ x, y, seed, dim }: { x: number; y: number; seed: string; dim?: boolean }) {
  const i = hashIndex(seed, C.skin.length);
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.8 : 1}>
      <rect x={-6} y={-16} width={5} height={16} rx={2.5} fill={C.ink} />
      <rect x={1} y={-16} width={5} height={16} rx={2.5} fill={C.ink} />
      <rect x={-10} y={-40} width={20} height={26} rx={8} fill={C.shirt.at(i)} />
      <circle cx={0} cy={-49} r={9} fill={C.skin.at(i)} />
      <path d="M-9 -51 a9 9 0 0 1 18 0 q-9 -5 -18 0z" fill={C.ink} opacity={0.85} />
    </g>
  );
}

/** Agente sentado atrás da mesa; `active` = trabalhando agora. */
function Agent({
  seat,
  active,
  icon,
}: {
  seat: Seat;
  active: boolean;
  icon: "triage" | "mail" | "chart";
}) {
  const { x, y } = seat;
  const body = active ? "var(--brand-primary)" : C.idle;
  return (
    <g>
      {/* cadeira */}
      <rect x={x - 16} y={y - 40} width={32} height={34} rx={8} fill="#D3DCE4" />
      {/* agente (corpo + cabeça de robô amigável) */}
      <g
        style={
          active
            ? { animation: "room-typing 0.9s ease-in-out infinite", transformBox: "fill-box" }
            : undefined
        }
      >
        <rect x={x - 12} y={y - 34} width={24} height={26} rx={9} fill={body} />
        <rect x={x - 11} y={y - 58} width={22} height={20} rx={7} fill={body} />
        <rect x={x - 7} y={y - 52} width={14} height={8} rx={4} fill="#ffffff" opacity={0.9} />
        <circle cx={x - 3} cy={y - 48} r={1.6} fill={C.ink} />
        <circle cx={x + 3} cy={y - 48} r={1.6} fill={C.ink} />
        <line x1={x} y1={y - 58} x2={x} y2={y - 64} stroke={body} strokeWidth={2} />
        <circle cx={x} cy={y - 66} r={2.5} fill={active ? "var(--brand-primary)" : C.line} />
      </g>
      {/* mesa */}
      <rect x={x - 46} y={y - 6} width={92} height={10} rx={3} fill={C.desk} />
      <rect x={x - 46} y={y + 2} width={92} height={3} fill={C.deskEdge} />
      <rect x={x - 40} y={y + 4} width={5} height={44} fill={C.deskEdge} />
      <rect x={x + 35} y={y + 4} width={5} height={44} fill={C.deskEdge} />
      {/* monitor */}
      <rect x={x + 14} y={y - 34} width={28} height={20} rx={3} fill={C.ink} />
      <rect
        x={x + 16}
        y={y - 32}
        width={24}
        height={16}
        rx={2}
        fill={active ? "#BFE3FF" : "#4A5866"}
        style={active ? { animation: "room-screen 1.4s ease-in-out infinite" } : undefined}
      />
      <rect x={x + 26} y={y - 14} width={4} height={8} fill={C.ink} />
      {/* objeto da mesa */}
      {icon === "triage" && (
        <g transform={`translate(${x - 38} ${y - 18})`}>
          <rect width={14} height={12} rx={1.5} fill="#ffffff" stroke={C.line} />
          <rect x={3} y={-3} width={14} height={12} rx={1.5} fill="#ffffff" stroke={C.line} />
          <line x1={6} y1={1} x2={14} y2={1} stroke={C.line} />
          <line x1={6} y1={4} x2={12} y2={4} stroke={C.line} />
        </g>
      )}
      {icon === "mail" && (
        <g transform={`translate(${x - 38} ${y - 16})`}>
          <rect width={18} height={12} rx={1.5} fill="#ffffff" stroke={C.line} />
          <path d="M0 0 L9 7 L18 0" fill="none" stroke={C.line} />
        </g>
      )}
      {icon === "chart" && (
        <g transform={`translate(${x - 38} ${y - 18})`}>
          <rect x={0} y={8} width={4} height={6} fill={C.line} />
          <rect x={6} y={4} width={4} height={10} fill={C.line} />
          <rect x={12} y={0} width={4} height={14} fill={C.line} />
        </g>
      )}
    </g>
  );
}

function scoreFrom(summary: string | null): number | null {
  const m = summary?.match(/Nota (\d+)\/100/);
  return m ? Number(m[1]) : null;
}

function firstName(name: string | undefined) {
  return name?.split(" ")[0] ?? "Candidato";
}

function Bubble({ seat, text, tone }: { seat: Seat; text: string; tone: "work" | "info" }) {
  return (
    <div
      className="pointer-events-none absolute w-[34%] max-w-[230px] -translate-x-1/2 -translate-y-full"
      style={{ left: `${(seat.x / W) * 100}%`, top: `${((seat.y - 74) / H) * 100}%` }}
    >
      <div
        className={
          "relative rounded-xl px-2.5 py-1.5 text-center text-[10px] leading-snug shadow-sm sm:text-[11.5px] " +
          (tone === "work"
            ? "bg-white text-[#22303C] ring-1 ring-[var(--brand-primary)]/40"
            : "bg-white/90 text-[#5A6876] ring-1 ring-[#C9D3DC]")
        }
      >
        {text}
        {tone === "work" && (
          <span className="ml-1 inline-flex gap-0.5 align-middle" aria-hidden>
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="inline-block size-1 rounded-full bg-[var(--brand-primary)]"
                style={{ animation: `room-dot 1.2s ${d * 0.2}s infinite` }}
              />
            ))}
          </span>
        )}
        <span
          className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-white"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function AgentRoom({ runs }: { runs: LiveAgentRun[] }) {
  const byAgent = (agent: LiveAgentRun["agent"], status: LiveAgentRun["status"]) =>
    runs.filter((r) => r.agent === agent && r.status === status);

  const triageNow = byAgent("TRIAGE", "RUNNING")[0];
  // Fila: quem ainda não foi atendido, na ordem de chegada.
  const queue = byAgent("TRIAGE", "QUEUED").slice().reverse();
  const commsNow = byAgent("COMMUNICATION", "RUNNING")[0] ?? byAgent("COMMUNICATION", "QUEUED")[0];
  const intelNow = byAgent("INTELLIGENCE", "RUNNING")[0] ?? byAgent("INTELLIGENCE", "QUEUED")[0];
  const results = runs
    .filter((r) => r.agent === "TRIAGE" && (r.status === "SUCCEEDED" || r.status === "FAILED"))
    .slice(0, 6);

  const busy = Boolean(triageNow || queue.length || commsNow || intelNow);
  const shown = queue.slice(0, MAX_QUEUE);
  const extra = queue.length - shown.length;

  const headline = triageNow
    ? `Atendendo ${triageNow.application?.name ?? "um candidato"}. ${
        queue.length === 0 ? "Ninguém mais na fila." : `${queue.length} na fila.`
      }`
    : queue.length > 0
      ? `${queue.length} na fila, o agente vai chamar o próximo.`
      : "Sala tranquila. Inicie a simulação para ver os agentes trabalhando.";

  return (
    <section
      aria-label="Sala dos agentes"
      className="mt-8 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <h2 className="text-base font-semibold text-[#18181b]">Sala dos agentes</h2>
        <p className="text-[12px] text-[#71717a]" aria-live="polite">
          {headline}
        </p>
      </div>

      <div className="relative mt-3 aspect-[760/262] w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label={headline}
        >
          {/* parede e piso */}
          <rect width={W} height={150} fill={C.wall} />
          <rect y={150} width={W} height={H - 150} fill={C.floor} />
          <line x1={0} y1={150} x2={W} y2={150} stroke={C.line} strokeWidth={2} />

          {/* porta de entrada */}
          <rect x={26} y={48} width={62} height={190} rx={4} fill="#D6DEE6" stroke={C.line} />
          <circle cx={78} cy={148} r={3} fill={C.idle} />
          <text x={57} y={38} textAnchor="middle" fontSize={11} fill="#5A6876">
            Entrada
          </text>

          {/* quadro na parede */}
          <rect x={300} y={22} width={190} height={62} rx={6} fill="#ffffff" stroke={C.line} />
          <text x={395} y={46} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.ink}>
            Triagem de currículos
          </text>
          <text x={395} y={66} textAnchor="middle" fontSize={11} fill="#5A6876">
            {results.length} analisado{results.length === 1 ? "" : "s"}, {queue.length} na fila
          </text>

          {/* faixa no chão marcando a fila */}
          <rect x={100} y={244} width={190} height={6} rx={3} fill={C.line} opacity={0.6} />

          {/* fila de candidatos */}
          {shown.map((r, i) => (
            <Person
              key={r.id}
              x={QUEUE_X0 + (shown.length - 1 - i) * QUEUE_GAP}
              y={QUEUE_Y}
              seed={r.application?.name ?? r.id}
              dim
            />
          ))}
          {extra > 0 && (
            <text x={QUEUE_X0 - 16} y={QUEUE_Y + 22} fontSize={11} fill="#5A6876">
              +{extra}
            </text>
          )}

          {/* candidato sendo atendido, com o currículo na mão */}
          {triageNow && (
            <g>
              <Person x={ATTENDED.x} y={ATTENDED.y} seed={triageNow.application?.name ?? triageNow.id} />
              <rect x={ATTENDED.x + 9} y={ATTENDED.y - 38} width={12} height={15} rx={1.5} fill="#ffffff" stroke={C.line} />
            </g>
          )}

          <Agent seat={TRIAGE} active={Boolean(triageNow)} icon="triage" />
          <Agent seat={COMMS} active={Boolean(commsNow)} icon="mail" />
          <Agent seat={INTEL} active={Boolean(intelNow)} icon="chart" />

          {/* placas das mesas */}
          {[
            { seat: TRIAGE, label: "Agente de Triagem" },
            { seat: COMMS, label: "Comunicação" },
            { seat: INTEL, label: "Inteligência" },
          ].map(({ seat, label }) => (
            <text
              key={label}
              x={seat.x}
              y={seat.y + 66}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={600}
              fill={C.ink}
            >
              {label}
            </text>
          ))}
        </svg>

        {triageNow && (
          <Bubble
            seat={TRIAGE}
            tone="work"
            text={`${firstName(triageNow.application?.name)}: ${triageNow.summary ?? "analisando"}`}
          />
        )}
        {commsNow && (
          <Bubble seat={COMMS} tone="work" text={commsNow.summary ?? "Avisando o candidato"} />
        )}
        {intelNow && (
          <Bubble seat={INTEL} tone="work" text={intelNow.summary ?? "Lendo o funil de recrutamento"} />
        )}
        {!busy && results[0] && (
          <Bubble
            seat={TRIAGE}
            tone="info"
            text={
              results[0].status === "SUCCEEDED"
                ? (results[0].summary ?? "Última análise concluída")
                : "A última análise falhou"
            }
          />
        )}
      </div>

      {results.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-[#f0efed] px-5 py-4" aria-label="Últimos resultados">
          {results.map((r) => {
            const score = scoreFrom(r.summary);
            const tone =
              r.status === "FAILED"
                ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]"
                : score === null
                  ? "bg-[#f4f4f5] text-[#52525b] ring-[#e4e4e7]"
                  : score >= 70
                    ? "bg-[#ecfdf3] text-[#15803d] ring-[#bbf7d0]"
                    : score >= 40
                      ? "bg-[#fffbeb] text-[#a16207] ring-[#fde68a]"
                      : "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]";
            return (
              <li
                key={r.id}
                title={r.status === "FAILED" ? (r.error ?? undefined) : undefined}
                className={"rounded-full px-3 py-1 text-[11px] font-medium ring-1 " + tone}
              >
                {firstName(r.application?.name)}{" "}
                {r.status === "FAILED" ? "falhou" : score !== null ? `${score}/100` : "analisado"}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
