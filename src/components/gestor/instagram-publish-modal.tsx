"use client";

import { useState, useEffect } from "react";
import {
  Share2,
  Send,
  ExternalLink,
  Check,
  Copy,
  AlertCircle,
  Smartphone,
  Sparkles,
  Settings,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  publishToInstagramAction,
  checkInstagramConfigAction,
} from "@/server/controllers/social-post.controller";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  caption: string;
  roleTitle: string;
};

// Ícone vetorial oficial do Instagram
function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function InstagramPublishModal({
  isOpen,
  onClose,
  canvasRef,
  caption,
  roleTitle,
}: Props) {
  const [activeTab, setActiveTab] = useState<"api" | "share" | "web">("api");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{
    success?: boolean;
    permalink?: string;
    message?: string;
    error?: string;
  } | null>(null);

  // Credenciais da Meta Graph API
  const [hasServerConfig, setHasServerConfig] = useState<boolean>(false);
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showConfigInputs, setShowConfigInputs] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
      setSupportsNativeShare(hasShare);
      const savedAcc = localStorage.getItem("tarhget_ig_account_id");
      const savedToken = localStorage.getItem("tarhget_ig_access_token");
      if (savedAcc) setAccountId(savedAcc);
      if (savedToken) setAccessToken(savedToken);

      checkInstagramConfigAction().then((cfg) => {
        setHasServerConfig(cfg.configured);
        if (!cfg.configured && !savedAcc) {
          setShowConfigInputs(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. PUBLICAR DIRETO VIA API META
  const handlePublishViaApi = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsPublishing(true);
    setPublishStatus(null);

    try {
      const imageBase64 = canvas.toDataURL("image/png");

      // Salva no localStorage se preenchido manualmente
      if (accountId) localStorage.setItem("tarhget_ig_account_id", accountId);
      if (accessToken) localStorage.setItem("tarhget_ig_access_token", accessToken);

      const result = await publishToInstagramAction({
        imageBase64,
        caption,
        accountId: accountId.trim() || undefined,
        accessToken: accessToken.trim() || undefined,
      });

      setPublishStatus(result);
    } catch (err) {
      console.error("[instagram] Erro ao disparar publicação:", err);
      setPublishStatus({
        success: false,
        error: "Ocorreu uma falha na conexão com a Meta.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // 2. COMPARTILHAR DIRETO PELO CELULAR / NATIVO (WEB SHARE API COM ARQUIVO)
  const handleNativeShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File(
          [blob],
          `vaga-${roleTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.png`,
          { type: "image/png" }
        );

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            text: caption,
            title: `Vaga ${roleTitle} - Tarhget`,
          });
        } else {
          // fallback copia a legenda e faz download
          await navigator.clipboard.writeText(caption);
          setCopiedCaption(true);
          const link = document.createElement("a");
          link.download = `vaga-${roleTitle.toLowerCase()}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          alert("Legenda copiada e imagem baixada! Abra o aplicativo do Instagram para postar.");
        }
      });
    } catch (err) {
      console.warn("Share falhou ou cancelado:", err);
    }
  };

  // 3. ABRIR NO META BUSINESS SUITE / COMPOSER
  const handleOpenMetaSuite = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Copia legenda
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedCaption(true);
    } catch {
      // ignore
    }

    // Faz download da arte para facilitar o upload
    const link = document.createElement("a");
    link.download = `vaga-${roleTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    // Abre o Meta Business Suite em nova aba
    window.open("https://business.facebook.com/latest/composer", "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-[#e4e4e7] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between border-b border-[#f4f4f5] px-6 py-4 bg-gradient-to-r from-[#faf5f0] to-[#ffffff]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white shadow-sm">
              <InstagramIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#18181b]">
                Publicar no Feed do Instagram
              </h2>
              <p className="text-xs text-[#71717a]">
                Envie a arte de divulgação diretamente para o perfil oficial
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* TABS DE SELEÇÃO DO MÉTODO */}
        <div className="flex border-b border-[#f4f4f5] px-6 pt-3 bg-[#fafaf9] gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === "api"
                ? "border-[#8f281e] text-[#8f281e]"
                : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
            }`}
          >
            <Send className="size-3.5" />
            Post Direto (API Meta)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("share")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === "share"
                ? "border-[#8f281e] text-[#8f281e]"
                : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
            }`}
          >
            <Smartphone className="size-3.5" />
            Compartilhar no Celular
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("web")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === "web"
                ? "border-[#8f281e] text-[#8f281e]"
                : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
            }`}
          >
            <ExternalLink className="size-3.5" />
            Meta Business Suite
          </button>
        </div>

        {/* CONTEÚDO DA TAB */}
        <div className="p-6">
          {/* TAB 1: API DIRETA META */}
          {activeTab === "api" && (
            <div className="space-y-4">
              {publishStatus?.success ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-3">
                  <div className="flex justify-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                      <CheckCircle2 className="size-6" />
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">
                      Post publicado com sucesso no Instagram!
                    </h3>
                    <p className="mt-1 text-xs text-emerald-700">
                      Sua oportunidade já está no ar para todos os seguidores.
                    </p>
                  </div>

                  {publishStatus.permalink && (
                    <div className="pt-2">
                      <a
                        href={publishStatus.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                      >
                        <ExternalLink className="size-3.5" />
                        Ver post no Instagram
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#ecd9c6] bg-[#fcfbf9] p-4 text-xs text-[#5c473f] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1f1412] flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-[#8f281e]" />
                        Publicação 100% Automática no Feed
                      </span>
                      {hasServerConfig && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="size-3" /> Conexão ativa no servidor
                        </span>
                      )}
                    </div>
                    <p>
                      A arte 1080×1080 e a legenda serão enviadas diretamente para a conta
                      comercial conectada via Meta Graph API Oficial.
                    </p>
                  </div>

                  {publishStatus?.error && (
                    <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                      <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Não foi possível publicar:</p>
                        <p>{publishStatus.error}</p>
                      </div>
                    </div>
                  )}

                  {/* Campos de Configuração se necessário */}
                  {(!hasServerConfig || showConfigInputs) && (
                    <div className="rounded-2xl border border-[#e4e4e7] p-4 bg-[#fafaf9] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#18181b] flex items-center gap-1.5">
                          <Settings className="size-3.5 text-[#71717a]" />
                          Credenciais do Instagram (Meta for Developers)
                        </span>
                        <a
                          href="https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#8f281e] hover:underline"
                        >
                          Como obter?
                        </a>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#71717a] mb-1">
                            ID da Conta Comercial do Instagram (Account ID)
                          </label>
                          <input
                            type="text"
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            placeholder="Ex: 17841400000000000"
                            className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-mono focus:border-[#8f281e] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#71717a] mb-1">
                            Token de Acesso da Meta (Access Token com instagram_content_publish)
                          </label>
                          <input
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="EAA..."
                            className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-mono focus:border-[#8f281e] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    {hasServerConfig && (
                      <button
                        type="button"
                        onClick={() => setShowConfigInputs(!showConfigInputs)}
                        className="text-xs font-medium text-[#71717a] hover:underline flex items-center gap-1"
                      >
                        <Settings className="size-3" />
                        {showConfigInputs ? "Ocultar credenciais" : "Alterar credenciais"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handlePublishViaApi}
                      disabled={isPublishing}
                      className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 transition-all"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Publicando no Feed...
                        </>
                      ) : (
                        <>
                          <InstagramIcon className="size-4" />
                          Publicar Agora no Feed
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: COMPARTILHAMENTO NATIVO / CELULAR */}
          {activeTab === "share" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-4 text-xs text-[#52525b] space-y-2">
                <span className="font-bold text-[#18181b] flex items-center gap-1.5">
                  <Smartphone className="size-4 text-[#8f281e]" />
                  Compartilhar Direto pelo Aplicativo do Instagram
                </span>
                <p>
                  No celular (iOS ou Android) ou em computadores compatíveis, este botão abre a
                  folha de compartilhamento nativa com a <strong>imagem 1080×1080</strong> e a{" "}
                  <strong>legenda</strong> já anexadas.
                </p>
                <p className="text-[11px] text-[#71717a]">
                  Basta selecionar o app do <strong>Instagram</strong> para abrir o editor de novo post no feed.
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-6 py-3 text-xs font-bold text-white shadow-md hover:opacity-95 transition-all"
                >
                  <Share2 className="size-4" />
                  Abrir Compartilhamento no Instagram
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: META BUSINESS SUITE */}
          {activeTab === "web" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-4 text-xs text-[#52525b] space-y-2">
                <span className="font-bold text-[#18181b] flex items-center gap-1.5">
                  <ExternalLink className="size-4 text-[#8f281e]" />
                  Estúdio de Criação / Meta Business Suite
                </span>
                <p>
                  Ideal para agendar publicações simultâneas no <strong>Instagram</strong> e no{" "}
                  <strong>Facebook</strong> pelo computador.
                </p>
                <p className="text-[11px] text-[#71717a]">
                  Ao clicar abaixo, o sistema <strong>baixa a arte 1080×1080</strong>,{" "}
                  <strong>copia a legenda</strong> para sua área de transferência e abre o
                  Composer da Meta em outra aba.
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleOpenMetaSuite}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0a0a0a] px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-[#27272a] transition-all"
                >
                  {copiedCaption ? (
                    <>
                      <Check className="size-4 text-emerald-400" />
                      Legenda copiada! Abrindo Meta Suite...
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar Legenda e Abrir Meta Suite
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
