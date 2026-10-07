/**
 * Banco de perguntas sugeridas para o formulário de uma vaga. O gestor só
 * escolhe da lista (ou cria a sua). Funções puras — testadas em
 * question-catalog.model.test.ts.
 *
 * Fora do banco, de propósito: sexo, estado civil, filhos, religião, foto e
 * qualquer pergunta que leve a discriminação na contratação.
 */

export type CatalogFieldType = "SHORT_TEXT" | "LONG_TEXT" | "DROPDOWN" | "YES_NO";

export type CatalogQuestion = {
  id: string;
  category: "Disponibilidade" | "Requisitos" | "Experiência" | "Localização" | "Outros";
  label: string;
  type: CatalogFieldType;
  options: string[];
  required: boolean;
  /** Trechos (sem acento, minúsculos) que tornam a pergunta recomendada. */
  keywords: string[];
};

export const QUESTION_CATALOG: CatalogQuestion[] = [
  // Disponibilidade
  { id: "inicio", category: "Disponibilidade", label: "Pode começar na data de início da vaga?", type: "YES_NO", options: [], required: true, keywords: ["inicio", "imediat"] },
  { id: "sabado", category: "Disponibilidade", label: "Tem disponibilidade para trabalhar aos sábados?", type: "YES_NO", options: [], required: true, keywords: ["sabado", "sab "] },
  { id: "domingo", category: "Disponibilidade", label: "Tem disponibilidade para trabalhar aos domingos e feriados?", type: "YES_NO", options: [], required: true, keywords: ["domingo", "feriado", "escala 6x1", "12x36"] },
  { id: "clt", category: "Disponibilidade", label: "Tem disponibilidade para registro imediato em carteira?", type: "YES_NO", options: [], required: true, keywords: ["ctps", "registro imediato"] },
  { id: "turno", category: "Disponibilidade", label: "Em qual turno prefere trabalhar?", type: "DROPDOWN", options: ["Manhã", "Tarde", "Noite", "Tanto faz"], required: false, keywords: ["turno"] },
  { id: "viagem", category: "Disponibilidade", label: "Tem disponibilidade para viajar?", type: "YES_NO", options: [], required: false, keywords: ["viage", "viaja"] },

  // Requisitos
  { id: "ensino-medio", category: "Requisitos", label: "Concluiu o ensino médio?", type: "YES_NO", options: [], required: true, keywords: ["ensino medio"] },
  { id: "escolaridade", category: "Requisitos", label: "Qual a sua escolaridade?", type: "DROPDOWN", options: ["Fundamental", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo"], required: true, keywords: ["escolaridade", "superior", "graduacao", "tecnico em"] },
  { id: "maioridade", category: "Requisitos", label: "Tem 18 anos ou mais?", type: "YES_NO", options: [], required: true, keywords: ["18 anos", "maior de idade"] },
  { id: "cnh", category: "Requisitos", label: "Tem CNH? Qual categoria?", type: "DROPDOWN", options: ["Não tenho", "A", "B", "AB", "C", "D", "E"], required: true, keywords: ["cnh", "habilitacao", "motorista"] },
  { id: "veiculo", category: "Requisitos", label: "Tem moto ou carro próprio para trabalhar?", type: "YES_NO", options: [], required: false, keywords: ["veiculo", "moto", "carro proprio", "vale combustivel"] },
  { id: "frio", category: "Requisitos", label: "Topa trabalhar em ambiente refrigerado (câmara fria)?", type: "YES_NO", options: [], required: true, keywords: ["frio", "refrigerad", "camara fria"] },
  { id: "sanitario", category: "Requisitos", label: "Consegue seguir as normas sanitárias da função (unhas curtas sem esmalte, cabelo preso, sem adornos)?", type: "YES_NO", options: [], required: true, keywords: ["sanitari", "manipula", "fatia"] },

  // Experiência
  { id: "tempo-funcao", category: "Experiência", label: "Quanto tempo de experiência você tem nesta função?", type: "DROPDOWN", options: ["Nenhuma", "Menos de 6 meses", "6 meses a 1 ano", "1 a 3 anos", "Mais de 3 anos"], required: true, keywords: ["experiencia"] },
  { id: "promotor", category: "Experiência", label: "Já trabalhou como promotor(a) ou repositor(a)? Conte onde e por quanto tempo.", type: "LONG_TEXT", options: [], required: false, keywords: ["promotor", "repositor", "merchandising"] },
  { id: "laticinios", category: "Experiência", label: "Já trabalhou com laticínios, frios ou produtos refrigerados?", type: "YES_NO", options: [], required: false, keywords: ["laticin", "lacteo", "frios"] },
  { id: "fatiamento", category: "Experiência", label: "Já fez manipulação, corte ou fatiamento de alimentos?", type: "YES_NO", options: [], required: false, keywords: ["fatia", "manipula", "corte"] },
  { id: "planograma", category: "Experiência", label: "Conhece planograma e organização de PDV?", type: "YES_NO", options: [], required: false, keywords: ["planograma", "pdv", "gondola"] },
  { id: "atendimento", category: "Experiência", label: "Já trabalhou com atendimento ao público?", type: "YES_NO", options: [], required: false, keywords: ["atendimento", "cliente"] },
  { id: "ferramentas", category: "Experiência", label: "Quais sistemas ou ferramentas você sabe usar?", type: "SHORT_TEXT", options: [], required: false, keywords: ["excel", "sistema", "erp", "planilha"] },
  { id: "ultimo-emprego", category: "Experiência", label: "Qual foi seu último trabalho e por quanto tempo ficou?", type: "LONG_TEXT", options: [], required: false, keywords: [] },

  // Localização
  { id: "bairro", category: "Localização", label: "Em qual bairro e cidade você mora?", type: "SHORT_TEXT", options: [], required: true, keywords: ["presencial", "roteiro", "loja", "rota"] },
  { id: "roteiro", category: "Localização", label: "Consegue se deslocar entre lojas da região durante o dia (roteiro)?", type: "YES_NO", options: [], required: true, keywords: ["roteiro", "rota", "lojas"] },

  // Outros
  { id: "pretensao", category: "Outros", label: "Qual a sua pretensão salarial?", type: "SHORT_TEXT", options: [], required: false, keywords: [] },
  { id: "origem", category: "Outros", label: "Como ficou sabendo da vaga?", type: "DROPDOWN", options: ["WhatsApp", "Instagram", "Indicação", "Site", "Outro"], required: false, keywords: [] },
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export type QuestionSuggestion = CatalogQuestion & { recommended: boolean };

/**
 * Sugestões para a vaga: recomendadas primeiro (palavras do texto da vaga
 * casam com a pergunta), depois o resto do banco. Esconde o que a vaga ou a
 * empresa já pergunta (mesmo texto).
 */
export function suggestQuestions(
  jobText: string,
  existingLabels: string[]
): QuestionSuggestion[] {
  const text = ` ${normalizeText(jobText)} `;
  const existing = new Set(existingLabels.map((l) => normalizeText(l).trim()));
  return QUESTION_CATALOG.filter((q) => !existing.has(normalizeText(q.label).trim()))
    .map((q, index) => ({
      q,
      index,
      score: q.keywords.filter((k) => text.includes(k)).length,
    }))
    .sort((a, b) => Number(b.score > 0) - Number(a.score > 0) || a.index - b.index)
    .map(({ q, score }) => ({ ...q, recommended: score > 0 }));
}

export function findCatalogQuestion(id: string): CatalogQuestion | null {
  return QUESTION_CATALOG.find((q) => q.id === id) ?? null;
}
