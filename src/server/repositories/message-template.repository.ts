import "server-only";

import { prisma } from "@/lib/prisma";

export const RADIO_TEMPLATE_KEY = "__radio_station__";
export const RADIO_PLAYLIST_KEY = "__radio_playlist__";

/** Recados salvos da empresa, os mais usados primeiro. */
export function findTemplatesByCompany(companyId: string) {
  return prisma.messageTemplate.findMany({
    where: {
      companyId,
      NOT: [
        { subjectKey: RADIO_TEMPLATE_KEY },
        { subjectKey: RADIO_PLAYLIST_KEY },
      ],
    },
    orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
    take: 30,
    select: { id: true, subject: true, body: true },
  });
}

export function findTemplate(companyId: string, subjectKey: string) {
  return prisma.messageTemplate.findUnique({
    where: { companyId_subjectKey: { companyId, subjectKey } },
    select: { body: true },
  });
}

/** Um modelo por assunto e empresa: reenviar com o mesmo assunto atualiza o texto. */
export function saveTemplate(
  companyId: string,
  subject: string,
  subjectKey: string,
  body: string
) {
  return prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey } },
    create: { companyId, subject, subjectKey, body },
    update: { subject, body, useCount: { increment: 1 } },
  });
}

/** Lê a rádio ativa configurada pelo admin (da empresa ou global). */
export async function findRadioStationRaw(companyId?: string | null): Promise<string | null> {
  if (companyId) {
    const byCompany = await prisma.messageTemplate.findUnique({
      where: { companyId_subjectKey: { companyId, subjectKey: RADIO_TEMPLATE_KEY } },
      select: { body: true },
    });
    if (byCompany?.body) return byCompany.body;
  }
  const latest = await prisma.messageTemplate.findFirst({
    where: { subjectKey: RADIO_TEMPLATE_KEY },
    orderBy: { updatedAt: "desc" },
    select: { body: true },
  });
  return latest?.body ?? null;
}

/** Salva a rádio ativa definida pelo admin (na empresa ou em todas as empresas se for admin global). */
export async function saveRadioStationRaw(companyId: string | null, body: string): Promise<void> {
  if (companyId) {
    await prisma.messageTemplate.upsert({
      where: { companyId_subjectKey: { companyId, subjectKey: RADIO_TEMPLATE_KEY } },
      create: { companyId, subject: "Rádio Online", subjectKey: RADIO_TEMPLATE_KEY, body },
      update: { body },
    });
    return;
  }
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const c of companies) {
    await prisma.messageTemplate.upsert({
      where: { companyId_subjectKey: { companyId: c.id, subjectKey: RADIO_TEMPLATE_KEY } },
      create: { companyId: c.id, subject: "Rádio Online", subjectKey: RADIO_TEMPLATE_KEY, body },
      update: { body },
    });
  }
}

/** Lê a fila/playlist da rádio salva pelo admin (da empresa ou global). */
export async function findRadioPlaylistRaw(companyId?: string | null): Promise<string | null> {
  if (companyId) {
    const byCompany = await prisma.messageTemplate.findUnique({
      where: { companyId_subjectKey: { companyId, subjectKey: RADIO_PLAYLIST_KEY } },
      select: { body: true },
    });
    if (byCompany?.body) return byCompany.body;
  }
  const latest = await prisma.messageTemplate.findFirst({
    where: { subjectKey: RADIO_PLAYLIST_KEY },
    orderBy: { updatedAt: "desc" },
    select: { body: true },
  });
  return latest?.body ?? null;
}

/** Salva a playlist personalizada da Rádio Tarhget. */
export async function saveRadioPlaylistRaw(companyId: string | null, body: string): Promise<void> {
  if (companyId) {
    await prisma.messageTemplate.upsert({
      where: { companyId_subjectKey: { companyId, subjectKey: RADIO_PLAYLIST_KEY } },
      create: { companyId, subject: "Playlist Rádio Tarhget", subjectKey: RADIO_PLAYLIST_KEY, body },
      update: { body },
    });
    return;
  }
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const c of companies) {
    await prisma.messageTemplate.upsert({
      where: { companyId_subjectKey: { companyId: c.id, subjectKey: RADIO_PLAYLIST_KEY } },
      create: { companyId: c.id, subject: "Playlist Rádio Tarhget", subjectKey: RADIO_PLAYLIST_KEY, body },
      update: { body },
    });
  }
}
