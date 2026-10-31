/** Negativa pronta para o recado ao candidato: texto fixo, sem IA, sem motivo e sem promessa. */
export function rejectionMessage(
  candidateName: string,
  companyName: string,
  jobTitle: string
): string {
  const first = candidateName.trim().split(/\s+/)[0] ?? "";
  return (
    `${first}, agradecemos o seu interesse na vaga de ${jobTitle} na ${companyName} e o tempo dedicado ao processo.\n` +
    `Depois de analisar os perfis, neste momento não vamos seguir com a sua candidatura.\n` +
    `Seu cadastro continua ativo para você se candidatar a outras vagas da ${companyName}. Desejamos sucesso na sua trajetória.`
  );
}
