"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import type { Contract, WorkMode } from "@prisma/client";
import { contractLabels, formatPublishedAgo, workModeLabels } from "@/server/models/job.model";
import { parseJobTitleAndCity } from "@/server/models/job.model";

export interface FeaturedJobItem {
  id: string;
  title: string;
  code: string | null;
  location: string | null;
  workMode: WorkMode;
  contract: Contract;
  createdAt: Date | string;
  company: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
}

export interface PublicCompanyItem {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  sector: string | null;
  _count: { jobs: number };
}

interface CandidatePortalExperienceProps {
  companies: PublicCompanyItem[];
  featuredJobs: FeaturedJobItem[];
  defaultCompanySlug: string | null;
  autoOpenCompanyLogin?: boolean;
}

export function CandidatePortalExperience({
  companies,
  featuredJobs,
  defaultCompanySlug,
  autoOpenCompanyLogin = false,
}: CandidatePortalExperienceProps) {
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [companyModalOpen, setCompanyModalOpen] = useState(autoOpenCompanyLogin);

  // Escuta tecla ESC para fechar modal da empresa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && companyModalOpen) {
        setCompanyModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [companyModalOpen]);

  // Lista de cidades disponíveis nas vagas em destaque
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const job of featuredJobs) {
      const { city } = parseJobTitleAndCity(job.title);
      if (city) set.add(city);
      else if (job.location) set.add(job.location);
    }
    return Array.from(set);
  }, [featuredJobs]);

  // Filtragem dinâmica de vagas
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return featuredJobs.filter((job) => {
      const { role, city } = parseJobTitleAndCity(job.title);
      const loc = city || job.location || "";

      // Filtro de cidade selecionada
      if (selectedCity !== "all") {
        if (!loc.toLowerCase().includes(selectedCity.toLowerCase())) {
          return false;
        }
      }

      // Filtro de busca livre
      if (!q) return true;
      const codeStr = job.code ? `#${job.code}`.toLowerCase() : "";
      return (
        role.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        job.company.name.toLowerCase().includes(q) ||
        codeStr.includes(q)
      );
    });
  }, [featuredJobs, search, selectedCity]);

  // Contagem total de vagas abertas somando as empresas
  const totalOpenJobs = useMemo(
    () => companies.reduce((acc, c) => acc + (c._count?.jobs || 0), 0) || featuredJobs.length,
    [companies, featuredJobs]
  );

  return (
    <div className="relative min-h-screen bg-[#070607] text-white selection:bg-[#811201]/40 selection:text-white">
      {/* ─── Fundos e Auroras Ambientais Sofisticadas ─── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Glow Central da TARHGET Burgundy */}
        <div className="absolute left-1/2 top-[-12%] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(129,18,1,0.28)_0%,rgba(194,59,59,0.1)_45%,transparent_75%)] blur-3xl" />
        {/* Glow Superior Direito */}
        <div className="absolute -right-32 top-1/4 h-[450px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(225,29,72,0.12)_0%,transparent_70%)] blur-3xl" />
        {/* Glow Inferior Esquerdo */}
        <div className="absolute -left-32 bottom-1/4 h-[500px] w-[550px] rounded-full bg-[radial-gradient(circle,rgba(129,18,1,0.18)_0%,transparent_70%)] blur-3xl" />
        {/* Grade Sutil de Fundo */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* ─── Barra de Navegação Superior ─── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070607]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Brand TARHGET */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#811201] to-[#450901] shadow-[0_0_20px_rgba(129,18,1,0.5)] ring-1 ring-white/20 transition-transform group-hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tarhget-icon-white.png"
                alt="TARHGET"
                className="size-6 object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-white text-base">TARHGET</span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  Vagas Abertas
                </span>
              </div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-white/45">
                Inteligência & Recrutamento
              </p>
            </div>
          </Link>

          {/* Links Centrais de Acesso Rápido */}
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#vagas"
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Vagas Abertas
            </a>
            <a
              href="#como-funciona"
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Como Funciona
            </a>
            <a
              href="#empresas"
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Unidades & Marcas
            </a>
            {defaultCompanySlug && (
              <Link
                href={`/${defaultCompanySlug}/banco`}
                className="text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Banco de Talentos
              </Link>
            )}
          </nav>

          {/* Acesso da Empresa: Discreto, Isolado em Botão Exclusivo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCompanyModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/75 shadow-sm backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              title="Acesso restrito para recrutadores e empresas"
            >
              <Building2 className="size-3.5 text-white/50" />
              <span>Acesso Corporativo</span>
              <span className="text-[10px] text-white/40">↗</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section: Entrada Triunfal & Surreal ─── */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          {/* Emblema Animado com Pulso 3D / Radar da TARHGET */}
          <div className="relative mb-8 flex items-center justify-center">
            {/* Anéis de Pulso Concêntricos */}
            <div className="absolute size-32 rounded-full border border-[#811201]/30 animate-ping opacity-30" />
            <div className="absolute size-44 rounded-full border border-white/[0.05]" />
            <div className="absolute size-56 rounded-full border border-white/[0.03]" />

            {/* Escudo Monograma Central */}
            <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#811201] via-[#630e01] to-[#260500] p-0.5 shadow-[0_0_50px_rgba(129,18,1,0.6)] ring-1 ring-white/30 backdrop-blur-xl sm:size-24 transition-transform hover:scale-105">
              <div className="flex size-full items-center justify-center rounded-[22px] bg-[#0c0909]/60 backdrop-blur-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/tarhget-icon-white.png"
                  alt="TARHGET"
                  className="size-11 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] sm:size-13"
                />
              </div>
            </div>
          </div>

          {/* Selo de Inovação */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-white/85 shadow-inner backdrop-blur-md">
            <Sparkles className="size-3.5 text-[#e11d48]" />
            <span>Portal Oficial de Recrutamento & Seleção · TARHGET</span>
          </div>

          {/* Título Principal de Impacto */}
          <h1 className="mt-6 max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
            O seu próximo salto profissional{" "}
            <span className="bg-gradient-to-r from-white via-white/90 to-[#e11d48] bg-clip-text text-transparent">
              começa aqui.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
            Conectamos você às maiores empresas e marcas do mercado com uma experiência ágil,
            transparente e sem formulários intermináveis. Candidate-se em minutos com seu currículo.
          </p>

          {/* ─── Barra de Busca Interativa com Vidro Escuro ─── */}
          <div className="mt-9 w-full max-w-2xl rounded-2xl border border-white/15 bg-white/[0.04] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex flex-1 items-center">
                <Search className="absolute left-3.5 size-4 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Qual vaga você procura? (ex: Promotor, Fortaleza, Vendas…)"
                  className="h-11 w-full rounded-xl bg-transparent pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-white/35 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 text-white/40 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <a
                href="#vagas"
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#811201] to-[#991b1b] px-6 text-xs sm:text-sm font-semibold text-white shadow-[0_4px_20px_rgba(129,18,1,0.4)] transition-all hover:brightness-110"
              >
                <span>Ver {filteredJobs.length} vagas</span>
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Filtros Rápidos de Praça / Cidades */}
          {cities.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-white/40 font-medium">Praças em destaque:</span>
              <button
                type="button"
                onClick={() => setSelectedCity("all")}
                className={`rounded-full px-3 py-1 font-semibold transition-all ${
                  selectedCity === "all"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                Todas ({featuredJobs.length})
              </button>
              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold transition-all ${
                    selectedCity === city
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  <MapPin className="size-3 text-white/40" />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── 4 Pilares da Inovação TARHGET ─── */}
        <section id="como-funciona" className="mt-20 scroll-mt-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.04]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#811201]/40 to-transparent text-[#e11d48]">
                <Zap className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-white">Candidatura em 60s</h3>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Envie apenas o seu currículo PDF. Sem testes infinitos ou perguntas repetitivas.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.04]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#811201]/40 to-transparent text-[#e11d48]">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-white">Triagem Inteligente & Justa</h3>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Nossa IA avalia estritamente suas experiências e habilidades em relação à vaga.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.04]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#811201]/40 to-transparent text-[#e11d48]">
                <Clock className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-white">Atualizações em Tempo Real</h3>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Acompanhe o andamento da sua inscrição e receba notificações por e-mail e WhatsApp.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.04]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#811201]/40 to-transparent text-[#e11d48]">
                <Building2 className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-white">Grandes Marcas & Operações</h3>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Conecte-se com gigantes de alimentos, bens de consumo e operações de trade no país.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Vitrine Viva de Vagas Abertas ─── */}
        <section id="vagas" className="mt-24 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Oportunidades em Aberto
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Vagas disponíveis para você
              </h2>
            </div>
            <span className="text-xs font-medium text-white/50">
              Exibindo {filteredJobs.length} {filteredJobs.length === 1 ? "vaga" : "vagas"}
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <Briefcase className="mx-auto size-10 text-white/25" />
              <p className="mt-3 text-sm font-semibold text-white">Nenhuma vaga encontrada</p>
              <p className="mt-1 text-xs text-white/50">
                {search || selectedCity !== "all"
                  ? "Tente ajustar os filtros de busca para encontrar mais oportunidades."
                  : "Não há vagas abertas neste momento."}
              </p>
              {(search || selectedCity !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCity("all");
                  }}
                  className="mt-4 inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredJobs.map((job) => {
                const { role, city } = parseJobTitleAndCity(job.title);
                const loc = city || job.location;
                const jobHref = `/${job.company.slug}/vagas/${job.id}`;

                return (
                  <Link
                    key={job.id}
                    href={jobHref}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                  >
                    {/* Borda Acobreada no Hover */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#811201] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    />

                    <div>
                      {/* Topo do Card: Empresa + Código */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-white/80">
                          <span
                            className="flex size-5 items-center justify-center rounded-md text-[9px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: job.company.primaryColor || "#811201" }}
                          >
                            T
                          </span>
                          <span className="truncate max-w-[150px]">{job.company.name}</span>
                        </span>

                        {job.code && (
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/60">
                            #{job.code}
                          </span>
                        )}
                      </div>

                      {/* Cargo em Destaque */}
                      <h3 className="mt-3.5 text-base font-bold tracking-tight text-white group-hover:text-white transition-colors">
                        {role}
                      </h3>

                      {/* Tags de Localidade e Modalidade */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-white/65">
                        {loc && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-white/90">
                            <MapPin className="size-3 text-[#e11d48]" />
                            {loc}
                          </span>
                        )}
                        <span className="rounded-md bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/60">
                          {workModeLabels[job.workMode]}
                        </span>
                        <span className="rounded-md bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/60">
                          {contractLabels[job.contract]}
                        </span>
                      </div>
                    </div>

                    {/* Rodapé: Publicação e Ação */}
                    <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                      <span className="text-[11px] text-white/40">
                        publicada{" "}
                        {formatPublishedAgo(
                          typeof job.createdAt === "string" ? new Date(job.createdAt) : job.createdAt
                        ).replace("publicada ", "")}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-white group-hover:translate-x-0.5 transition-transform">
                        <span>Candidatar-se</span>
                        <ArrowRight className="size-3.5 text-[#e11d48]" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Botão Ver Todas as Vagas da Empresa Padrão */}
          {defaultCompanySlug && (
            <div className="mt-10 text-center">
              <Link
                href={`/${defaultCompanySlug}/vagas`}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/[0.1]"
              >
                <span>Explorar todas as {totalOpenJobs} vagas abertas na TARHGET</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </section>

        {/* ─── Seção: Empresas & Unidades Credenciadas ─── */}
        <section id="empresas" className="mt-28 scroll-mt-24">
          <div className="border-b border-white/[0.08] pb-5">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Nossas Unidades & Parceiras
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-white/60">
              Escolha a unidade mais próxima ou confira os processos em andamento.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}/vagas`}
                className="group flex items-center justify-between rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl shadow-md"
                    style={{ backgroundColor: c.primaryColor || "#811201" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.logoUrl || "/images/tarhget-icon-white.png"}
                      alt={c.name}
                      className="size-7 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white group-hover:text-white">
                      {c.name}
                    </h3>
                    <p className="truncate text-[11px] text-white/50">
                      {c.sector || "Recrutamento & Seleção"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/70">
                    {c._count.jobs} {c._count.jobs === 1 ? "vaga" : "vagas"}
                  </span>
                  <ArrowRight className="size-4 text-white/40 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Seção: Já se candidatou? / Acompanhamento ─── */}
        <section className="mt-24 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-8 backdrop-blur-xl sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-white/80">
                <CheckCircle2 className="size-3 text-emerald-400" />
                <span>Portal do Candidato</span>
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                Já enviou seu currículo para alguma vaga?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-white/60 max-w-xl">
                Você pode acompanhar a evolução da sua candidatura e o status das suas entrevistas a
                qualquer momento através da página de acompanhamento.
              </p>
            </div>

            {defaultCompanySlug && (
              <Link
                href={`/${defaultCompanySlug}/vagas`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs sm:text-sm font-bold text-zinc-950 shadow-md hover:bg-zinc-100 transition-colors"
              >
                <span>Acompanhar Minhas Vagas</span>
                <ArrowRight className="size-4 text-zinc-700" />
              </Link>
            )}
          </div>
        </section>
      </main>

      {/* ─── Rodapé Elegante & Discreto ─── */}
      <footer className="border-t border-white/[0.08] bg-[#050405] py-10 text-xs text-white/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wider text-white">TARHGET</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} Todos os direitos reservados</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#vagas" className="hover:text-white transition-colors">
              Vagas Abertas
            </a>
            {defaultCompanySlug && (
              <Link href={`/${defaultCompanySlug}/banco`} className="hover:text-white transition-colors">
                Banco de Talentos
              </Link>
            )}
            {/* Link Discreto no Rodapé para o Gestor */}
            <button
              type="button"
              onClick={() => setCompanyModalOpen(true)}
              className="hover:text-white transition-colors text-white/40"
            >
              Área do Recrutador
            </button>
          </div>
        </div>
      </footer>

      {/* ─── Drawer / Modal Lateral: Acesso da Empresa (Discreto & Isolado) ─── */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Escuro com Blur */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
            onClick={() => setCompanyModalOpen(false)}
            aria-hidden="true"
          />

          {/* Painel Slide-over Lateral */}
          <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between border-l border-white/10 bg-[#0c0a0b] p-6 shadow-2xl sm:p-8 overflow-y-auto">
            <div>
              {/* Botão Fechar e Cabeçalho */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-[#811201]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/tarhget-icon-white.png" alt="" className="size-5 object-contain" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Painel da Empresa</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">
                      Área Corporativa
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Informações de Login */}
              <div className="mt-6">
                <h3 className="text-lg font-bold text-white">Entrar no Sistema</h3>
                <p className="mt-1 text-xs text-white/60">
                  Acesse com suas credenciais de recrutador para gerenciar vagas, funis e candidatos.
                </p>

                {/* Formulário de Login Oficial */}
                <div className="mt-4">
                  <LoginForm branded={false} dark />
                </div>
              </div>
            </div>

            {/* Rodapé do Drawer */}
            <div className="mt-8 border-t border-white/[0.08] pt-4 text-[11px] text-white/45">
              <p>
                🔒 Ambiente restrito para colaboradores e clientes da TARHGET. Candidatos não
                precisam de senha para se candidatar às vagas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
