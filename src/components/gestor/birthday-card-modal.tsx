"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Gift, Loader2, MessageCircle, Send, X } from "lucide-react";

import {
  BIRTHDAY_CARD_THEMES,
  BIRTHDAY_MESSAGES,
  MAX_CARD_MESSAGE,
  type BirthdayCardNameMode,
  type BirthdayCardTheme,
} from "@/server/models/birthday-card-options.model";

const THEME_SWATCH: Record<BirthdayCardTheme, string> = {
  marca: "bg-[var(--brand-primary)]",
  claro: "bg-[#fbf8f3]",
  noite: "bg-[#12141a]",
};

type Feedback = { tone: "ok" | "erro"; text: string } | null;

export function BirthdayCardButtonAndModal({
  name,
  turningAge,
  companyName,
  whatsappUrl,
  variant = "button",
}: {
  name: string;
  turningAge?: number;
  companyName?: string;
  whatsappUrl?: string | null;
  /** Mantido por compatibilidade com as telas; o texto agora é escolhido no cartão. */
  greetingMessage?: string;
  variant?: "button" | "icon";
}) {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  // O cartão abre fora do layout (portal), então leva a cor da marca junto.
  const [brand, setBrand] = useState({ primary: "#0a0a0a", foreground: "#ffffff" });
  const [theme, setTheme] = useState<BirthdayCardTheme>("marca");
  const [mode, setMode] = useState<BirthdayCardNameMode>("first");
  const [showAge, setShowAge] = useState(false);
  const [message, setMessage] = useState(BIRTHDAY_MESSAGES[0].text);
  // A imagem só é refeita quando a pessoa para de digitar.
  const [settledMessage, setSettledMessage] = useState(message);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "copy" | "download" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function open(trigger: HTMLElement) {
    const css = getComputedStyle(trigger);
    const primary = css.getPropertyValue("--brand-primary").trim();
    const foreground = css.getPropertyValue("--brand-foreground").trim();
    if (primary) setBrand({ primary, foreground: foreground || "#ffffff" });
    setIsOpen(true);
  }

  const firstName = name.trim().split(/\s+/)[0] || name;
  const hasAge = typeof turningAge === "number" && turningAge > 0;

  useEffect(() => {
    const timer = setTimeout(() => setSettledMessage(message), 450);
    return () => clearTimeout(timer);
  }, [message]);

  // Fecha no Esc e trava a rolagem do fundo enquanto o cartão está aberto.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const cardUrl = `/api/birthday-card?${new URLSearchParams({
    name,
    mode,
    theme,
    showAge: showAge && hasAge ? "true" : "false",
    age: hasAge ? String(turningAge) : "",
    message: settledMessage.trim(),
  }).toString()}`;
  const loading = loadedUrl !== cardUrl && failedUrl !== cardUrl;
  const failed = failedUrl === cardUrl;
  const pendingTyping = settledMessage !== message;

  const whatsappText = `Olá, ${firstName}! 🎂\n\n${message.trim()}${companyName ? `\n\n— *${companyName}*` : ""}`;
  const whatsappLink = (() => {
    if (!whatsappUrl) return null;
    try {
      const url = new URL(whatsappUrl);
      url.searchParams.set("text", whatsappText);
      return url.toString();
    } catch {
      return whatsappUrl;
    }
  })();

  const fileName = `feliz-aniversario-${firstName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.png`;

  function notify(next: Feedback) {
    setFeedback(next);
    if (next) setTimeout(() => setFeedback((current) => (current === next ? null : current)), 5000);
  }

  async function fetchCard(): Promise<Blob> {
    const res = await fetch(cardUrl);
    if (!res.ok) throw new Error("cartão indisponível");
    return res.blob();
  }

  async function copyImage(blob: Blob): Promise<boolean> {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function saveFile(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** No celular abre o compartilhar com a imagem; no computador copia e abre o WhatsApp. */
  async function handleSend() {
    if (busy) return;
    setBusy("send");
    try {
      const blob = await fetchCard();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: whatsappText });
          return;
        } catch (error) {
          if ((error as Error).name === "AbortError") return; // a pessoa fechou o compartilhar
        }
      }
      const copied = await copyImage(blob);
      if (!copied) saveFile(blob);
      notify({
        tone: "ok",
        text: copied
          ? whatsappLink
            ? "Imagem copiada. Abra a conversa e cole com Ctrl+V."
            : "Imagem copiada. Cole com Ctrl+V onde quiser enviar."
          : "Imagem baixada. Anexe na conversa.",
      });
    } catch {
      notify({ tone: "erro", text: "Não consegui gerar o cartão agora. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    if (busy) return;
    setBusy("copy");
    try {
      const copied = await copyImage(await fetchCard());
      notify(
        copied
          ? { tone: "ok", text: "Imagem copiada. Cole com Ctrl+V." }
          : { tone: "erro", text: "Este navegador não copia imagem. Use Baixar." }
      );
    } catch {
      notify({ tone: "erro", text: "Não consegui gerar o cartão agora. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy("download");
    try {
      saveFile(await fetchCard());
    } catch {
      notify({ tone: "erro", text: "Não consegui gerar o cartão agora. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  const secondary =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#18181b] hover:bg-[#fafaf9] disabled:opacity-50";

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => open(e.currentTarget)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-50/80 text-amber-700 hover:bg-amber-100"
          title={`Cartão de aniversário para ${name}`}
          aria-label={`Cartão de aniversário para ${name}`}
        >
          <Gift className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => open(e.currentTarget)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-100"
          title={`Cartão de aniversário para ${name}`}
        >
          <Gift className="size-3.5 text-amber-700" />
          <span>Cartão</span>
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-9999 flex items-end justify-center bg-black/70 sm:items-center sm:p-5"
            style={{ ["--brand-primary" as string]: brand.primary, ["--brand-foreground" as string]: brand.foreground }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-[#e4e4e7] px-5 py-3.5">
                <div className="min-w-0">
                  <h3 id={titleId} className="text-sm font-bold text-[#0a0a0a]">
                    Cartão de aniversário
                  </h3>
                  <p className="truncate text-xs text-[#71717a]">
                    Para {name}
                    {hasAge ? ` · faz ${turningAge} anos` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setIsOpen(false)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
                <div className="mx-auto w-full max-w-[340px] md:max-w-none">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#f4f4f5]">
                    {!failed && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={cardUrl}
                        src={cardUrl}
                        alt={`Cartão de aniversário para ${name}`}
                        className={`size-full object-cover transition-opacity duration-200 ${loading ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => setLoadedUrl(cardUrl)}
                        onError={() => setFailedUrl(cardUrl)}
                      />
                    )}
                    {(loading || pendingTyping) && !failed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                        <Loader2 className="size-6 animate-spin text-[#71717a]" />
                      </div>
                    )}
                    {failed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                        <p className="text-xs text-[#52525b]">Não consegui desenhar o cartão.</p>
                        <button type="button" onClick={() => setFailedUrl(null)} className={secondary}>
                          Tentar de novo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-[#0a0a0a]">Estilo</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {BIRTHDAY_CARD_THEMES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={theme === item.id}
                          onClick={() => setTheme(item.id)}
                          title={item.description}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${
                            theme === item.id
                              ? "border-[#0a0a0a] bg-[#fafaf9] text-[#0a0a0a] ring-1 ring-[#0a0a0a]"
                              : "border-[#e4e4e7] text-[#52525b] hover:bg-[#fafaf9]"
                          }`}
                        >
                          <span className={`size-4 shrink-0 rounded-full border border-black/15 ${THEME_SWATCH[item.id]}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-[#0a0a0a]">Nome no cartão</legend>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="inline-flex rounded-lg border border-[#e4e4e7] p-0.5">
                        {(
                          [
                            ["first", "Primeiro nome"],
                            ["full", "Nome e sobrenome"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={mode === value}
                            onClick={() => setMode(value)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                              mode === value ? "bg-[#0a0a0a] text-white" : "text-[#52525b] hover:text-[#0a0a0a]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {hasAge && (
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#3f3f46]">
                          <input
                            type="checkbox"
                            checked={showAge}
                            onChange={(e) => setShowAge(e.target.checked)}
                            className="size-4 rounded border-[#a1a1aa]"
                          />
                          Mostrar a idade ({turningAge})
                        </label>
                      )}
                    </div>
                  </fieldset>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor={`${titleId}-msg`} className="text-xs font-semibold text-[#0a0a0a]">
                        Mensagem
                      </label>
                      <span className={`text-[11px] ${message.length > MAX_CARD_MESSAGE ? "text-[#b91c1c]" : "text-[#71717a]"}`}>
                        {message.length}/{MAX_CARD_MESSAGE}
                      </span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {BIRTHDAY_MESSAGES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={message === item.text}
                          onClick={() => setMessage(item.text)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            message === item.text
                              ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                              : "border-[#e4e4e7] text-[#52525b] hover:bg-[#fafaf9]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id={`${titleId}-msg`}
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full resize-none rounded-lg border border-[#d4d4d8] bg-white p-3 text-sm leading-relaxed text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    />
                    {message.length > MAX_CARD_MESSAGE && (
                      <p className="mt-1 text-[11px] text-[#b91c1c]">
                        Passou do limite: no cartão o texto será cortado. No WhatsApp vai inteiro.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#e4e4e7] bg-[#fafaf9] px-5 py-3.5">
                <p
                  role="status"
                  className={`text-xs ${feedback ? "mb-2" : ""} ${feedback?.tone === "erro" ? "text-[#b91c1c]" : "text-[#15803d]"}`}
                >
                  {feedback && (
                    <span className="inline-flex items-center gap-1">
                      {feedback.tone === "ok" && <Check className="size-3.5" />}
                      {feedback.text}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={busy !== null || failed}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-[var(--brand-foreground)] hover:opacity-90 disabled:opacity-50 sm:flex-none"
                  >
                    {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Enviar cartão
                  </button>
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="size-4" />
                      Abrir conversa
                    </a>
                  )}
                  <button type="button" onClick={handleCopy} disabled={busy !== null || failed} className={secondary}>
                    {busy === "copy" ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                    Copiar imagem
                  </button>
                  <button type="button" onClick={handleDownload} disabled={busy !== null || failed} className={secondary}>
                    {busy === "download" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    Baixar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
