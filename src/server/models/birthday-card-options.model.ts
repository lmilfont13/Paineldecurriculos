/**
 * Opções do cartão de aniversário que a tela também usa (temas, mensagens
 * prontas, limite). Sem dependências: pode ir para o navegador.
 */
export type BirthdayCardTheme = "marca" | "claro" | "noite";
export type BirthdayCardNameMode = "first" | "full";

export const BIRTHDAY_CARD_THEMES: { id: BirthdayCardTheme; label: string; description: string }[] = [
  { id: "marca", label: "Marca", description: "Fundo na cor da marca." },
  { id: "claro", label: "Claro", description: "Papel claro, marca nos detalhes." },
  { id: "noite", label: "Noite", description: "Escuro com dourado." },
];

export const BIRTHDAY_MESSAGES: { id: string; label: string; text: string }[] = [
  {
    id: "calorosa",
    label: "Calorosa",
    text: "Que este novo ciclo venha com saúde, boas notícias e muitos motivos para comemorar. É muito bom ter você com a gente.",
  },
  {
    id: "reconhecimento",
    label: "Reconhecimento",
    text: "Obrigado por tudo o que você entrega e pelo jeito como faz isso. Que este ano traga conquistas à altura da sua dedicação.",
  },
  {
    id: "curta",
    label: "Curta",
    text: "Muita saúde, alegria e sucesso neste novo ano de vida. Aproveite o seu dia!",
  },
];

export const MAX_CARD_MESSAGE = 240;
