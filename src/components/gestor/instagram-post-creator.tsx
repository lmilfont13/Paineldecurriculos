"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Wand2,
  Copy,
  Check,
  Upload,
  RefreshCw,
  FileText,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  DollarSign,
  Share2,
} from "lucide-react";
import {
  DEFAULT_POST_DATA,
  SocialJobPostData,
  STOCK_MODELS,
} from "@/server/models/social-post.model";
import { InstagramCanvasPreview } from "@/components/gestor/instagram-canvas-preview";
import {
  parseSocialPostAction,
  getJobSocialPostAction,
  generateCaptionAction,
} from "@/server/controllers/social-post.controller";

type JobOption = {
  id: string;
  title: string;
  code: string | null;
  status: string;
  location: string | null;
};

type Props = {
  initialJobs: JobOption[];
  preselectedJobId?: string;
  initialPostData?: SocialJobPostData | null;
};

export function InstagramPostCreator({
  initialJobs,
  preselectedJobId,
  initialPostData,
}: Props) {
  const [data, setData] = useState<SocialJobPostData>(initialPostData || DEFAULT_POST_DATA);
  const [rawText, setRawText] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || "");
  const [isPending, startTransition] = useTransition();
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [customModelPreview, setCustomModelPreview] = useState<string | null>(null);

  // Seções recolhíveis do editor
  const [openSections, setOpenSections] = useState({
    header: true,
    details: true,
    benefits: true,
    caption: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Processa texto bruto com IA
  const handleParseAi = () => {
    if (!rawText.trim()) return;
    startTransition(async () => {
      try {
        const parsed = await parseSocialPostAction(rawText);
        setData(parsed);
      } catch (err) {
        console.error("Erro ao analisar texto com IA:", err);
      }
    });
  };

  // Carrega dados de uma vaga já existente
  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (!jobId) return;

    startTransition(async () => {
      try {
        const jobData = await getJobSocialPostAction(jobId);
        if (jobData) {
          setData(jobData);
        }
      } catch (err) {
        console.error("Erro ao carregar vaga:", err);
      }
    });
  };

  // Atualiza um campo específico do estado
  const updateField = <K extends keyof SocialJobPostData>(key: K, value: SocialJobPostData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // Troca de modelo visual
  const handleModelChange = (modelSrc: string) => {
    setCustomModelPreview(null);
    updateField("modelImage", modelSrc);
  };

  // Sorteia um modelo diferente
  const handleRandomModel = () => {
    const currentIndex = STOCK_MODELS.findIndex((m) => m.src === data.modelImage);
    const available = STOCK_MODELS.filter((_, idx) => idx !== currentIndex);
    const chosen = available[Math.floor(Math.random() * available.length)] || STOCK_MODELS[0];
    handleModelChange(chosen.src);
  };

  // Upload de foto personalizada (ex.: foto da própria equipe ou loja)
  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCustomModelPreview(result);
      updateField("modelImage", result);
    };
    reader.readAsDataURL(file);
  };

  // Copia a legenda gerada
  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(data.caption || "");
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2500);
    } catch {
      // fallback
    }
  };

  // Regerar legenda
  const handleRegenerateCaption = () => {
    startTransition(async () => {
      try {
        const newCaption = await generateCaptionAction(data, "Tarhget");
        updateField("caption", newCaption);
      } catch (err) {
        console.error("Erro ao gerar legenda:", err);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* BANNER DE BOAS-VINDAS / INTRODUÇÃO */}
      <div className="rounded-2xl border border-[#ecd9c6] bg-gradient-to-r from-[#fcfbf9] via-[#f8f3eb] to-[#f4ebe0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#8f281e] text-white">
                <Share2 className="size-4" />
              </span>
              <h1 className="text-xl font-bold text-[#1f1412]">
                Divulgação de Vagas · Post Instagram
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-[#5c473f] max-w-2xl">
              Gere artes profissionais no padrão oficial Tarhget (1080×1080) prontas para o feed.
              Cole o texto do WhatsApp ou selecione uma vaga para preencher tudo com Inteligência Artificial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6c5b0] bg-white/80 px-3 py-1 text-xs font-semibold text-[#8f281e]">
              <Sparkles className="size-3.5" /> IA com Extração Inteligente
            </span>
          </div>
        </div>

        {/* BARRA DE ENTRADA RÁPIDA (CARREGAR VAGA OU COLAR TEXTO) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 border-t border-[#e8dbcc] pt-5">
          {/* Seletor de vaga existente */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#73584e] mb-1.5">
              1. Puxar de uma vaga cadastrada
            </label>
            <div className="relative">
              <select
                value={selectedJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
                disabled={isPending}
                className="w-full appearance-none rounded-xl border border-[#d6c5b0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#1f1412] shadow-2xs focus:border-[#8f281e] focus:outline-none focus:ring-1 focus:ring-[#8f281e] disabled:opacity-50"
              >
                <option value="">-- Escolha uma vaga para preencher --</option>
                {initialJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code ? `#${j.code} · ` : ""}
                    {j.title} {j.location ? `(${j.location})` : ""}
                  </option>
                ))}
              </select>
              <Briefcase className="pointer-events-none absolute right-3.5 top-3 size-4 text-[#8a7268]" />
            </div>
          </div>

          {/* Colar texto bruto */}
          <div className="lg:col-span-7">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#73584e] mb-1.5">
              2. Ou cole a mensagem/descrição da vaga
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Ex: Vaga Promotor Fortaleza CLT R$ 1.839,41 VR 35/dia seg a sab..."
                className="flex-1 rounded-xl border border-[#d6c5b0] bg-white px-3.5 py-2 text-sm text-[#1f1412] placeholder:text-[#a8978e] shadow-2xs focus:border-[#8f281e] focus:outline-none focus:ring-1 focus:ring-[#8f281e]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleParseAi();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleParseAi}
                disabled={isPending || !rawText.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#8f281e] px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-[#722018] disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    Processar com IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: DUAS COLUNAS (EDITOR À ESQUERDA, CANVAS PREVIEW À DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUNA DA ESQUERDA: FORMULÁRIO DE EDIÇÃO FINA */}
        <div className="lg:col-span-6 space-y-4">
          {/* GALERIA DE MODELOS VISUAIS */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#71717a] flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-[#8f281e]" />
                Foto da Modelo / Profissional de Varejo
              </label>
              <button
                type="button"
                onClick={handleRandomModel}
                className="text-xs font-medium text-[#8f281e] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="size-3" />
                Sortear foto
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {STOCK_MODELS.map((model) => {
                const isSelected = data.modelImage === model.src && !customModelPreview;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModelChange(model.src)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${
                      isSelected
                        ? "border-[#8f281e] ring-2 ring-[#8f281e]/30 scale-[1.02]"
                        : "border-[#e4e4e7] hover:border-[#a1a1aa]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={model.src}
                      alt={model.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[10px] text-white font-bold truncate text-center">
                      {model.id === "model-official" ? "★ Oficial" : model.gender === "female" ? "Mulher" : "Homem"}
                    </div>
                    {isSelected && (
                      <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-[#8f281e] text-white">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Botão de Upload Personalizado */}
              <label
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-2 text-center cursor-pointer transition-all aspect-square ${
                  customModelPreview
                    ? "border-[#8f281e] ring-2 ring-[#8f281e]/30"
                    : "border-[#d4d4d8] hover:border-[#8f281e] bg-[#fafaf9]"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />
                {customModelPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customModelPreview}
                    alt="Custom model"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <>
                    <Upload className="size-5 text-[#71717a] mb-1" />
                    <span className="text-[10px] font-semibold text-[#52525b]">
                      Enviar Foto
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* SEÇÃO 1: CABEÇALHO E TÍTULO DA VAGA */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleSection("header")}
              className="flex w-full items-center justify-between p-4 bg-[#fcfbf9] border-b border-[#f4f4f5] text-left hover:bg-[#faf8f4]"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f1412] flex items-center gap-2">
                <FileText className="size-4 text-[#8f281e]" />
                Identificação & Cargo da Vaga
              </span>
              {openSections.header ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {openSections.header && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Código da Vaga
                    </label>
                    <input
                      type="text"
                      value={data.jobCode}
                      onChange={(e) => updateField("jobCode", e.target.value)}
                      placeholder="Ex: 1129"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm font-semibold focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Subtítulo Destaque
                    </label>
                    <input
                      type="text"
                      value={data.opportunitySubtitle}
                      onChange={(e) => updateField("opportunitySubtitle", e.target.value)}
                      placeholder="Estamos contratando!"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#71717a] mb-1">
                    Título do Cargo (Caixa Alta)
                  </label>
                  <input
                    type="text"
                    value={data.roleTitle}
                    onChange={(e) => updateField("roleTitle", e.target.value.toUpperCase())}
                    placeholder="CONSULTOR(A) MERCHAN JR"
                    className="w-full rounded-xl border border-[#e4e4e7] px-3 py-2 text-sm font-bold text-[#401114] focus:border-[#8f281e] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#71717a] mb-1">
                    Pílula de Segmento / Cliente
                  </label>
                  <input
                    type="text"
                    value={data.segmentSubtitle}
                    onChange={(e) => updateField("segmentSubtitle", e.target.value.toUpperCase())}
                    placeholder="SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS"
                    className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-xs font-medium focus:border-[#8f281e] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: DETALHES DA OPERAÇÃO */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleSection("details")}
              className="flex w-full items-center justify-between p-4 bg-[#fcfbf9] border-b border-[#f4f4f5] text-left hover:bg-[#faf8f4]"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f1412] flex items-center gap-2">
                <Briefcase className="size-4 text-[#8f281e]" />
                Informações da Operação (5 Linhas)
              </span>
              {openSections.details ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {openSections.details && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Local (Cidade - UF)
                    </label>
                    <input
                      type="text"
                      value={data.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      placeholder="Fortaleza - CE"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Previsão de Início
                    </label>
                    <input
                      type="text"
                      value={data.startDate}
                      onChange={(e) => updateField("startDate", e.target.value)}
                      placeholder="Em Novembro - data à confirmar"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#71717a] mb-1">
                    Roteiro de Lojas
                  </label>
                  <input
                    type="text"
                    value={data.route}
                    onChange={(e) => updateField("route", e.target.value)}
                    placeholder="Cobertura de 2 Lojas, sendo 1 loja por dia | Bairros: ..."
                    className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Tipo de Contratação
                    </label>
                    <input
                      type="text"
                      value={data.contractType}
                      onChange={(e) => updateField("contractType", e.target.value)}
                      placeholder="Regime CLT – EFETIVO"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Escala e Carga Horária
                    </label>
                    <input
                      type="text"
                      value={data.workSchedule}
                      onChange={(e) => updateField("workSchedule", e.target.value)}
                      placeholder="44h semanais — Seg a Sex e Sáb"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 3: REMUNERAÇÃO E BENEFÍCIOS */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleSection("benefits")}
              className="flex w-full items-center justify-between p-4 bg-[#fcfbf9] border-b border-[#f4f4f5] text-left hover:bg-[#faf8f4]"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f1412] flex items-center gap-2">
                <DollarSign className="size-4 text-[#8f281e]" />
                Faixa Dourada · Remuneração & Benefícios
              </span>
              {openSections.benefits ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {openSections.benefits && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Salário (Destacado)
                    </label>
                    <input
                      type="text"
                      value={data.salary}
                      onChange={(e) => updateField("salary", e.target.value)}
                      placeholder="R$ 1.839,41"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm font-bold text-[#8f281e] focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1">
                      Vale Refeição
                    </label>
                    <input
                      type="text"
                      value={data.mealVoucher}
                      onChange={(e) => updateField("mealVoucher", e.target.value)}
                      placeholder="R$ 35,00/dia"
                      className="w-full rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-sm focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1 truncate">
                      Ajuda Custo
                    </label>
                    <input
                      type="text"
                      value={data.costAid}
                      onChange={(e) => updateField("costAid", e.target.value)}
                      placeholder="de acordo c/ roteiro"
                      className="w-full rounded-xl border border-[#e4e4e7] px-2.5 py-1.5 text-xs focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1 truncate">
                      Convênio Médico
                    </label>
                    <input
                      type="text"
                      value={data.healthInsurance}
                      onChange={(e) => updateField("healthInsurance", e.target.value)}
                      placeholder="e odontológico"
                      className="w-full rounded-xl border border-[#e4e4e7] px-2.5 py-1.5 text-xs focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1 truncate">
                      Aparelho / Extra
                    </label>
                    <input
                      type="text"
                      value={data.corporatePhone}
                      onChange={(e) => updateField("corporatePhone", e.target.value)}
                      placeholder="CORPORATIVO"
                      className="w-full rounded-xl border border-[#e4e4e7] px-2.5 py-1.5 text-xs focus:border-[#8f281e] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 4: LEGENDA PRONTA PARA O INSTAGRAM */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleSection("caption")}
              className="flex w-full items-center justify-between p-4 bg-[#fcfbf9] border-b border-[#f4f4f5] text-left hover:bg-[#faf8f4]"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[#1f1412] flex items-center gap-2">
                <Share2 className="size-4 text-[#8f281e]" />
                Legenda do Post (com Emojis e Hashtags)
              </span>
              {openSections.caption ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {openSections.caption && (
              <div className="p-4 space-y-3">
                <textarea
                  rows={8}
                  value={data.caption}
                  onChange={(e) => updateField("caption", e.target.value)}
                  placeholder="Legenda para o Instagram..."
                  className="w-full rounded-xl border border-[#e4e4e7] p-3 text-xs leading-relaxed text-[#18181b] focus:border-[#8f281e] focus:outline-none font-mono"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleRegenerateCaption}
                    disabled={isPending}
                    className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a] flex items-center gap-1"
                  >
                    <RefreshCw className="size-3" />
                    Regerar legenda
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3.5 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#f4f4f5]"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5 text-[#71717a]" />
                        Copiar Legenda
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DA DIREITA: PRÉ-VISUALIZAÇÃO DO CANVAS EM ALTA RESOLUÇÃO */}
        <div className="lg:col-span-6 lg:sticky lg:top-6">
          <InstagramCanvasPreview
            data={data}
            companyName="TARHGET"
            onRandomModel={handleRandomModel}
          />
        </div>
      </div>
    </div>
  );
}
