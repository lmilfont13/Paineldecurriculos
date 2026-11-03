/**
 * Consentimento LGPD da candidatura e Aviso de Privacidade. Texto puro, sem I/O.
 *
 * Ao mudar qualquer texto abaixo, troque CONSENT_VERSION: cada candidatura
 * guarda a versão aceita (Application.consentVersion), e é ela que prova o que
 * o candidato leu quando aceitou (LGPD art. 8º, §2º — o ônus da prova é de
 * quem trata os dados).
 */

/** Versão do texto (data em que entrou no ar). */
export const CONSENT_VERSION = "2026-11-03";

/** Mensagem quando a candidatura chega sem o aceite. */
export const CONSENT_REQUIRED_MESSAGE =
  "Para enviar, marque que você leu e concorda com o Aviso de Privacidade.";

/**
 * Texto da caixa de aceite, no fim do formulário. Específico e destacado
 * (art. 8º, §4º e art. 11, I): diz quem usa, para quê, inclui o dado sensível
 * de deficiência e lembra que pode revogar.
 */
export function consentCheckboxText(companyName: string): string {
  return (
    `Li e concordo com o Aviso de Privacidade. Autorizo a ${companyName} a usar os dados ` +
    `desta candidatura — inclusive o currículo e, se eu tiver informado, a condição de ` +
    `pessoa com deficiência — somente para este processo seletivo e para o banco de ` +
    `talentos da empresa. Sei que meus dados não serão vendidos nem usados para outra ` +
    `finalidade, e que posso retirar este consentimento a qualquer momento.`
  );
}

export type PrivacySection = { title: string; paragraphs: string[] };

/** Aviso de Privacidade completo (página /[slug]/privacidade). */
export function privacyNotice(companyName: string, contactEmail: string | null): PrivacySection[] {
  const contact = contactEmail
    ? `pelo e-mail ${contactEmail}`
    : "pelos canais de contato da empresa";
  return [
    {
      title: "1. Quem cuida dos seus dados",
      paragraphs: [
        `A ${companyName} é a controladora dos dados que você envia ao se candidatar por este ` +
          `site: é ela quem decide como eles são usados. A plataforma de recrutamento e os ` +
          `serviços citados no item 5 tratam os dados apenas em nome da ${companyName} e ` +
          `seguindo as instruções dela.`,
      ],
    },
    {
      title: "2. Quais dados coletamos",
      paragraphs: [
        "Os dados que você mesmo informa: nome, e-mail, telefone, data de nascimento, endereço, " +
          "currículo (e a foto que estiver nele), pretensão salarial, disponibilidade, respostas " +
          "do formulário e, quando a empresa pedir na pré-entrevista, documentos como RG e CPF.",
        "Informar se você é pessoa com deficiência é opcional. Esse é um dado sensível pela LGPD " +
          "e só é tratado com o seu consentimento específico, para fins de inclusão e de " +
          "adaptação do processo seletivo.",
      ],
    },
    {
      title: "3. Para que usamos",
      paragraphs: [
        "Somente para recrutamento e seleção: analisar sua candidatura a esta vaga, falar com você " +
          "sobre o processo (convites, recados e resultado) e, no banco de talentos, considerar " +
          "seu perfil para outras vagas da mesma empresa.",
        "Seus dados não são vendidos, não são usados para publicidade e não são usados para " +
          "nenhuma outra finalidade além das descritas aqui.",
      ],
    },
    {
      title: "4. Triagem com apoio de inteligência artificial",
      paragraphs: [
        "O currículo pode passar por uma leitura automatizada que ajuda a equipe a organizar as " +
          "candidaturas. Essa leitura é orientada a ignorar nome, gênero, idade, foto e origem e " +
          "a avaliar apenas habilidades e experiência.",
        "A inteligência artificial não aprova nem reprova ninguém: toda decisão é tomada por uma " +
          `pessoa da ${companyName}. Você pode pedir informações sobre essa análise e a revisão ` +
          "de qualquer decisão (LGPD art. 20).",
      ],
    },
    {
      title: "5. Com quem os dados são compartilhados",
      paragraphs: [
        "Apenas com prestadores de serviço necessários para o site funcionar, que tratam os dados " +
          "em nome da empresa e não podem usá-los para fins próprios: hospedagem do site " +
          "(Vercel), banco de dados e armazenamento de arquivos (Supabase), envio de e-mails " +
          "(Resend) e análise de currículo por inteligência artificial (Google).",
        "Alguns desses serviços podem armazenar ou processar dados fora do Brasil, sempre com " +
          "medidas de segurança e nos termos permitidos pela LGPD (art. 33).",
      ],
    },
    {
      title: "6. Base legal",
      paragraphs: [
        "O seu consentimento (LGPD art. 7º, I) e, para o dado de deficiência, o consentimento " +
          "específico e destacado (art. 11, I). Também os procedimentos preliminares a uma " +
          "possível contratação, feitos a seu pedido (art. 7º, V).",
      ],
    },
    {
      title: "7. Por quanto tempo guardamos",
      paragraphs: [
        "Pelo tempo do processo seletivo e, no banco de talentos, até você retirar o " +
          "consentimento, retirar a candidatura ou excluir sua conta. Ao excluir a conta, o " +
          "currículo e a foto são apagados e as candidaturas ficam anônimas — sem dados que " +
          "identifiquem você. Alguns registros podem ser mantidos quando a lei exigir.",
      ],
    },
    {
      title: "8. Segurança",
      paragraphs: [
        "O acesso aos dados é restrito à equipe de recrutamento da empresa, com login. Currículos " +
          "e fotos ficam em armazenamento privado, abertos só por links temporários. RG e CPF " +
          "aparecem mascarados e cada visualização fica registrada.",
      ],
    },
    {
      title: "9. Seus direitos",
      paragraphs: [
        "Você pode, a qualquer momento: confirmar se tratamos seus dados e acessá-los; corrigir " +
          "dados incompletos ou desatualizados; pedir anonimização, bloqueio ou eliminação; " +
          "pedir a portabilidade; saber com quem foram compartilhados; e retirar o " +
          "consentimento (LGPD art. 18).",
        "Pelo próprio site, na área \"Meu perfil\", você edita seus dados e pode excluir sua conta; " +
          "em \"Minhas candidaturas\", pode retirar uma candidatura. Para os demais pedidos, " +
          `fale com a ${companyName} ${contact}. Você também pode reclamar à Autoridade ` +
          "Nacional de Proteção de Dados (ANPD).",
        "Retirar o consentimento não afeta o que já foi feito antes, mas sem ele não é possível " +
          "seguir no processo seletivo.",
      ],
    },
  ];
}
