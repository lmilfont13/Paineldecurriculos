import "server-only";

import { resend } from "@/lib/resend";
import { brandForeground } from "@/server/models/company.model";
import { appUrl, readEnv } from "@/lib/env";
import type { EmailOutcome } from "@/server/models/communication.model";

/**
 * Identidade de quem envia. Para o candidato, quem escreve é a empresa, não
 * a plataforma: nome, símbolo e cor dela em todo e-mail.
 */
export type EmailBrand = {
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
};

const APP_URL = appUrl();
/** Endereço de envio. Com domínio verificado no Resend, troque por um da empresa. */
const FROM_ADDRESS = readEnv("EMAIL_FROM_ADDRESS") || "onboarding@resend.dev";

function from(brand: EmailBrand) {
  return `${brand.name.replace(/[<>"]/g, "")} <${FROM_ADDRESS}>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(name: string) {
  return esc(name.split(" ")[0] ?? name);
}

function candidateLink(brand: EmailBrand, applicationId: string) {
  return `${APP_URL}/${brand.slug}/minhas-candidaturas/${applicationId}`;
}

/** Moldura dos e-mails: símbolo e nome no topo, cor da marca no botão. */
function shell(
  brand: EmailBrand,
  content: {
    title: string;
    paragraphs: string[];
    cta?: { label: string; href: string };
    footer: string;
  }
): string {
  const color = brand.primaryColor;
  const logo = brand.logoUrl
    ? `<img src="${brand.logoUrl}" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px" />`
    : "";
  const button = content.cta
    ? `<p style="margin:28px 0 0"><a href="${content.cta.href}" style="display:inline-block;padding:12px 22px;background:${color};color:${brandForeground(color)};border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">${content.cta.label}</a></p>`
    : "";
  return `
  <div style="background:#faf8f6;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ebe7e3;border-top:4px solid ${color};border-radius:12px;padding:28px 28px 24px">
      <p style="margin:0 0 24px;font-size:15px;font-weight:600;color:#1c1917">${logo}<span style="vertical-align:middle">${esc(brand.name)}</span></p>
      <h1 style="margin:0 0 14px;font-size:21px;line-height:28px;color:#1c1917">${content.title}</h1>
      ${content.paragraphs
        .map(
          (p) =>
            `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#57534e">${p}</p>`
        )
        .join("")}
      ${button}
    </div>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:18px;color:#a8a29e;text-align:center">${content.footer}</p>
  </div>`;
}

function candidateFooter(brand: EmailBrand) {
  return `Você recebeu este e-mail porque se candidatou a uma vaga da ${esc(brand.name)}.`;
}

/** Remetente de teste do Resend: só entrega para o dono da conta. */
const SANDBOX_SENDER = FROM_ADDRESS.toLowerCase().endsWith("@resend.dev");

async function send(
  label: string,
  message: Parameters<NonNullable<typeof resend>["emails"]["send"]>[0]
): Promise<EmailOutcome> {
  if (!resend) return "off"; // RESEND_API_KEY não configurada: e-mail vira no-op
  try {
    const { error } = await resend.emails.send(message);
    if (error) {
      console.error(`[email] Resend recusou ${label}:`, error);
      return "failed";
    }
    return SANDBOX_SENDER ? "sandbox" : "sent";
  } catch (error) {
    console.error(`[email] Falha ao enviar ${label}:`, error);
    return "failed";
  }
}

/** Avisa o gestor que chegou candidatura nova. Nunca lança. */
export async function sendNewApplicationNotification(params: {
  brand: EmailBrand;
  to: string;
  candidateName: string;
  jobTitle: string;
  aiEnabled: boolean;
  applicationId: string;
}): Promise<void> {
  const { brand } = params;
  await send("aviso ao gestor", {
    from: from(brand),
    to: params.to,
    subject: `Nova candidatura: ${params.jobTitle}`,
    html: shell(brand, {
      title: `${esc(params.candidateName)} se candidatou`,
      paragraphs: [
        `Vaga: <strong style="color:#1c1917">${esc(params.jobTitle)}</strong>.`,
        params.aiEnabled
          ? "A leitura do currículo pela IA fica pronta em alguns minutos."
          : "A pessoa não mandou currículo, então as respostas do formulário são o que você tem para avaliar.",
      ],
      cta: {
        label: "Abrir candidatura",
        href: `${APP_URL}/candidaturas/${params.applicationId}`,
      },
      footer: "Aviso automático do seu painel de recrutamento.",
    }),
  });
}

/** Confirmação de candidatura. Nunca bloqueia o candidato (regra 2). */
export async function sendApplicationConfirmation(params: {
  brand: EmailBrand;
  to: string;
  candidateName: string;
  jobTitle: string;
  applicationId: string;
}): Promise<void> {
  const { brand } = params;
  await send("confirmação", {
    from: from(brand),
    to: params.to,
    subject: `Recebemos sua candidatura: ${params.jobTitle}`,
    html: shell(brand, {
      title: "Candidatura recebida",
      paragraphs: [
        `Oi, ${firstName(params.candidateName)}. A ${esc(brand.name)} recebeu sua candidatura para <strong style="color:#1c1917">${esc(params.jobTitle)}</strong>.`,
        "Quando houver novidade, você recebe um e-mail e ela aparece na sua área.",
      ],
      cta: {
        label: "Acompanhar candidatura",
        href: candidateLink(brand, params.applicationId),
      },
      footer: candidateFooter(brand),
    }),
  });
}

/** Mudança de etapa feita pelo gestor. Nunca lança. */
export async function sendStatusUpdateEmail(params: {
  brand: EmailBrand;
  to: string;
  candidateName: string;
  jobTitle: string;
  status: "INTERVIEW" | "APPROVED" | "REJECTED";
  applicationId: string;
}): Promise<EmailOutcome> {
  const { brand } = params;
  const job = `<strong style="color:#1c1917">${esc(params.jobTitle)}</strong>`;
  const company = esc(brand.name);
  const copy = {
    INTERVIEW: {
      subject: `Você avançou: ${params.jobTitle}`,
      title: "Você avançou para a entrevista",
      body: `A ${company} quer conversar com você sobre a vaga de ${job}. Em breve alguém entra em contato para combinar o horário.`,
    },
    APPROVED: {
      subject: `Você foi aprovado: ${params.jobTitle}`,
      title: "Você foi aprovado",
      body: `A ${company} aprovou sua candidatura para ${job}. O próximo contato é sobre a contratação.`,
    },
    REJECTED: {
      subject: `Sobre sua candidatura: ${params.jobTitle}`,
      title: "Processo encerrado",
      body: `A ${company} seguiu com outras pessoas para a vaga de ${job}. Obrigado pelo tempo que você dedicou. Seu cadastro continua salvo para as próximas vagas.`,
    },
  }[params.status];

  return send("atualização de etapa", {
    from: from(brand),
    to: params.to,
    subject: copy.subject,
    html: shell(brand, {
      title: copy.title,
      paragraphs: [`Oi, ${firstName(params.candidateName)}.`, copy.body],
      cta: {
        label: "Ver na minha área",
        href: candidateLink(brand, params.applicationId),
      },
      footer: candidateFooter(brand),
    }),
  });
}

/** Entrevista combinada: data, hora e onde, para o candidato responder. */
export async function sendInterviewScheduledEmail(params: {
  brand: EmailBrand;
  to: string;
  candidateName: string;
  jobTitle: string;
  when: string;
  mode: string;
  location: string | null;
  managerEmail: string | null;
  applicationId: string;
}): Promise<void> {
  const { brand } = params;
  const where = params.location
    ? /^https?:\/\//.test(params.location)
      ? `<a href="${esc(params.location)}" style="color:${brand.primaryColor}">${esc(params.location)}</a>`
      : esc(params.location)
    : "";
  await send("convite de entrevista", {
    from: from(brand),
    to: params.to,
    ...(params.managerEmail ? { replyTo: params.managerEmail } : {}),
    subject: `Entrevista marcada: ${params.jobTitle}`,
    html: shell(brand, {
      title: "Sua conversa está marcada",
      paragraphs: [
        `Oi, ${firstName(params.candidateName)}. A ${esc(brand.name)} marcou a conversa sobre a vaga de <strong style="color:#1c1917">${esc(params.jobTitle)}</strong>.`,
        `<span style="display:block;padding:14px 16px;background:#faf8f6;border-radius:10px;color:#1c1917"><strong style="font-size:17px">${esc(params.when)}</strong><br/>${esc(params.mode)}${where ? ` · ${where}` : ""}</span>`,
        "Se o horário não der para você, é só responder este e-mail.",
      ],
      cta: {
        label: "Ver detalhes",
        href: candidateLink(brand, params.applicationId),
      },
      footer: candidateFooter(brand),
    }),
  });
}

/** Recado do gestor ao candidato: o texto dele, sem edição. */
export async function sendManagerMessageEmail(params: {
  brand: EmailBrand;
  to: string;
  candidateName: string;
  jobTitle: string;
  message: string;
  managerEmail: string | null;
  applicationId: string;
}): Promise<void> {
  const { brand } = params;
  await send("recado", {
    from: from(brand),
    to: params.to,
    ...(params.managerEmail ? { replyTo: params.managerEmail } : {}),
    subject: `Recado da ${brand.name}: ${params.jobTitle}`,
    html: shell(brand, {
      title: `Recado da ${esc(brand.name)}`,
      paragraphs: [
        `Oi, ${firstName(params.candidateName)}. Sobre a vaga de <strong style="color:#1c1917">${esc(params.jobTitle)}</strong>:`,
        `<span style="display:block;padding:14px 16px;background:#faf8f6;border-left:3px solid ${brand.primaryColor};color:#1c1917">${esc(params.message).replace(/\n/g, "<br/>")}</span>`,
        "Para responder, é só responder este e-mail.",
      ],
      cta: {
        label: "Ver na minha área",
        href: candidateLink(brand, params.applicationId),
      },
      footer: candidateFooter(brand),
    }),
  });
}
