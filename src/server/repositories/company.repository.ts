import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Empresa de demonstração (slug "demo") usada para apresentar o sistema a
 * empresas em prospecção: continua acessível por link direto
 * (getPublicCompanyBySlug / login do gestor), mas fica fora do seletor
 * público da tela de login — não é uma empresa real, não deve aparecer para
 * qualquer candidato que passe por ali.
 */
const HIDDEN_FROM_DIRECTORY_SLUGS = ["demo"];

export function findCompanyBySlug(slug: string) {
  return prisma.company.findUnique({ where: { slug } });
}

export function findCompanyById(id: string) {
  return prisma.company.findUnique({ where: { id } });
}

/** Lista para o console admin (A1): contagens + gestor. */
export function findAllCompaniesForAdmin() {
  return prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { jobs: true } },
      users: {
        where: { role: "MANAGER" },
        select: { email: true },
        take: 1,
      },
    },
  });
}

export function countCompanies() {
  return prisma.company.count();
}

/** Lista de empresas ativas para a tela de seleção pública. */
export function findActiveCompanies() {
  return prisma.company.findMany({
    where: { isActive: true, slug: { notIn: HIDDEN_FROM_DIRECTORY_SLUGS } },
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      sector: true,
      _count: { select: { jobs: { where: { status: "OPEN" } } } },
    },
  });
}

/** Primeira empresa ativa — usada como destino padrão da raiz do site. */
export function findFirstActiveCompany() {
  return prisma.company.findFirst({
    where: { isActive: true, slug: { notIn: HIDDEN_FROM_DIRECTORY_SLUGS } },
    orderBy: { createdAt: "asc" },
  });
}

export function createCompany(data: {
  name: string;
  slug: string;
  email: string;
  cnpj: string | null;
  sector: string | null;
  website: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string | null;
}) {
  return prisma.company.create({ data });
}

export function updateCompany(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    email: string;
    senderEmail: string | null;
    cnpj: string | null;
    sector: string | null;
    website: string | null;
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string | null;
    logoFullUrl: string | null;
    heroTitle: string;
    heroSubtitle: string;
    aboutText: string | null;
    aiModel: string | null;
    isActive: boolean;
  }>
) {
  return prisma.company.update({ where: { id }, data });
}
