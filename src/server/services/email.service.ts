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
  applicationId: string;
}): Promise<void> {
  if (!resend) return;
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/candidaturas/${params.applicationId}`;
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
        `<a href="${link}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#0a0a0a;color:#fff;border-radius:12px;text-decoration:none;font-size:14px">Abrir candidatura</a>`,
      ]),
    });
  } catch (error) {
    console.error("[email] Falha ao notificar gestor:", error);
  }
}

/** Entrevista combinada: data, hora e onde, para o candidato responder. */
export async function sendInterviewScheduledEmail(params: {
  to: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  when: string;
  mode: string;
  location: string | null;
  managerEmail: string | null;
}): Promise<void> {
  if (!resend) return;
  const first = params.candidateName.split(" ")[0];
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      ...(params.managerEmail ? { replyTo: params.managerEmail } : {}),
      subject: `Entrevista marcada · ${params.jobTitle}`,
      html: shell(`Sua conversa está marcada`, [
        `Oi, ${first}! A ${params.companyName} marcou a conversa sobre a vaga de <strong>${params.jobTitle}</strong>.`,
        `<strong style="color:#0a0a0a;font-size:16px">${params.when}</strong><br/>${params.mode}${
          params.location ? ` · ${params.location}` : ""
        }`,
        "Se esse horário não funcionar para você, é só responder este e-mail.",
      ]),
    });
  } catch (error) {
    console.error("[email] Falha ao enviar convite de entrevista:", error);
  }
}

/** Recado do gestor ao candidato — o texto é escrito por ele, sem edição. */
export async function sendManagerMessageEmail(params: {
  to: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  message: string;
  managerEmail: string | null;
}): Promise<void> {
  if (!resend) return;
  const first = params.candidateName.split(" ")[0];
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      ...(params.managerEmail ? { replyTo: params.managerEmail } : {}),
      subject: `Recado da ${params.companyName} · ${params.jobTitle}`,
      html: shell(`Recado da ${params.companyName}`, [
        `Oi, ${first}! A ${params.companyName} deixou um recado sobre a vaga de <strong>${params.jobTitle}</strong>:`,
        `<span style="display:block;padding:12px 16px;background:#fafaf9;border-left:3px solid #e4e4e7;color:#0a0a0a">${params.message.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</span>`,
        "Você pode responder este e-mail para falar com a empresa.",
      ]),
    });
  } catch (error) {
    console.error("[email] Falha ao enviar recado:", error);
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
