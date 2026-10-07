/**
 * Sala de simulação (tela /agentes): candidatos fictícios com currículos PDF
 * reais em /public/demo, para ver o Agente de Triagem trabalhando etapa por
 * etapa. Os e-mails usam o domínio reservado .invalid — nunca recebem nada.
 */
export type SimulationCandidate = {
  email: string;
  name: string;
  phone: string;
  resume: string;
  /** O que se espera da IA para a vaga administrativa (só para a tela). */
  expected: "alta" | "média" | "baixa";
};

export const SIMULATION_CANDIDATES: readonly SimulationCandidate[] = [
  {
    email: "marina.alves.costa@example.invalid",
    name: "Marina Alves Costa",
    phone: "(85) 99999-0000",
    resume: "demo/curriculo-candidato-ficticio.pdf",
    expected: "alta",
  },
  {
    email: "rafael.lima@example.invalid",
    name: "Rafael Nogueira Lima",
    phone: "(85) 90000-0001",
    resume: "demo/curriculo-ficticio-rafael.pdf",
    expected: "alta",
  },
  {
    email: "juliana.matos@example.invalid",
    name: "Juliana Prado Matos",
    phone: "(85) 90000-0002",
    resume: "demo/curriculo-ficticio-juliana.pdf",
    expected: "média",
  },
  {
    email: "bruno.alves@example.invalid",
    name: "Bruno Teixeira Alves",
    phone: "(85) 90000-0003",
    resume: "demo/curriculo-ficticio-bruno.pdf",
    expected: "baixa",
  },
];

/** Pausa entre etapas na simulação, para dar tempo de ver cada uma. */
export const SIMULATION_STEP_PAUSE_MS = 1500;

/**
 * Assinatura das execuções ativas (id, status e etapa). A tela de agentes só
 * recarrega quando ela muda — uma vez por etapa, nunca em loop.
 */
export function activeRunsSignature(
  runs: { id: string; status: string; summary: string | null }[]
): string {
  return runs
    .filter((r) => r.status === "QUEUED" || r.status === "RUNNING")
    .map((r) => `${r.id}:${r.status}:${r.summary ?? ""}`)
    .sort()
    .join("|");
}
