import "server-only";

import { resend } from "@/lib/resend";

const FROM = "Triagem <onboarding@resend.dev>";

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
