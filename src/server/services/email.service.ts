import "server-only";

import { resend } from "@/lib/resend";

const FROM = "Triagem <onboarding@resend.dev>";

function shell(title: string, lines: string[]): string {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0a0a0a">
      <h2 style="font-size:20px">${title}</h2>
      ${lines
        .map(
          (l) =>
            `<p style="color:#71717a;font-size:14px;line-height:21px">${l}</p>`
        )
        .join("")}
      <p style="color:#a1a1aa;font-size:12px;margin-top:32px">
        Enviado pela plataforma Triagem.
      </p>
    </div>
  `;
}

/** G14 · Avisa o gestor que chegou candidatura nova. Nunca lança. */
export async function sendNewApplicationNotification(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  aiEnabled: boolean;
}): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Nova candidatura · ${params.jobTitle}`,
      html: shell("Nova candidatura recebida", [
        `<strong>${params.candidateName}</strong> se candidatou para <strong>${params.jobTitle}</strong>.`,
        params.aiEnabled
          ? "A análise de aderência da IA já está em andamento — em instantes o score aparece no seu painel."
          : "Abra o painel para ver os detalhes.",
      ]),
    });
  } catch (error) {
    console.error("[email] Falha ao notificar gestor:", error);
  }
}

/** Q2 · Avisa o candidato quando o gestor muda o status. Nunca lança. */
export async function sendStatusUpdateEmail(params: {
  to: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  status: "INTERVIEW" | "APPROVED" | "REJECTED";
}): Promise<void> {
  if (!resend) return;
  const copy = {
    INTERVIEW: {
      subject: `Você avançou no processo · ${params.jobTitle}`,
      title: "Boa notícia! 🎉",
      body: `A ${params.companyName} quer te conhecer melhor: sua candidatura para <strong>${params.jobTitle}</strong> avançou para a etapa de <strong>entrevista</strong>. O time de recrutamento vai entrar em contato em breve.`,
    },
    APPROVED: {
      subject: `Você foi aprovado(a)! · ${params.jobTitle}`,
      title: "Parabéns! 🎉",
      body: `A ${params.companyName} aprovou sua candidatura para <strong>${params.jobTitle}</strong>. O time entrará em contato com os próximos passos.`,
    },
    REJECTED: {
      subject: `Atualização do processo · ${params.jobTitle}`,
      title: "Atualização do seu processo",
      body: `O processo para <strong>${params.jobTitle}</strong> na ${params.companyName} foi finalizado. Agradecemos sua participação — seu perfil fica salvo para futuras oportunidades.`,
    },
  }[params.status];
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: copy.subject,
      html: shell(copy.title, [`Olá, ${params.candidateName.split(" ")[0]}!`, copy.body]),
    });
  } catch (error) {
    console.error("[email] Falha ao avisar candidato:", error);
  }
}

/**
 * Confirmação de candidatura (P7: "Confirmação enviada para …").
 * Nunca lança: e-mail é acessório e jamais bloqueia o candidato (regra 2).
 */
export async function sendApplicationConfirmation(params: {
  to: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
}): Promise<void> {
  if (!resend) return; // RESEND_API_KEY não configurada
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Candidatura recebida · ${params.jobTitle}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0a0a0a">
          <h2 style="font-size:20px">Candidatura enviada ✓</h2>
          <p style="color:#71717a;font-size:14px;line-height:21px">
            Olá, ${params.candidateName}! A ${params.companyName} recebeu sua
            candidatura para <strong>${params.jobTitle}</strong>.
          </p>
          <p style="color:#71717a;font-size:14px;line-height:21px">
            Se o seu perfil avançar no processo, o time de recrutamento
            entrará em contato por este e-mail.
          </p>
          <p style="color:#a1a1aa;font-size:12px;margin-top:32px">
            Enviado pela plataforma Triagem.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[email] Falha ao enviar confirmação:", error);
  }
}
