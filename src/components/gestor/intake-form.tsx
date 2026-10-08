"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, Loader2, MessageCircle, UserPlus } from "lucide-react";

import { preRegisterAction, type IntakeResult } from "@/server/controllers/intake.controller";

export function IntakeForm({
  jobs,
  initialJobId,
}: {
  jobs: { id: string; title: string }[];
  initialJobId: string;
}) {
  const [jobId, setJobId] = useState(initialJobId);
  const [text, setText] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setResult(null);
    startTransition(async () => {
      const r = await preRegisterAction(jobId, text);
      setResult(r);
      if (r.ok && r.created.length > 0) setText(r.invalid.join("\n"));
    });
  }

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* sem permissão de área de transferência: o texto continua visível */
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
        <label className="block text-[12px] font-semibold text-[#0a0a0a]">
          Vaga
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] font-normal"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-[12px] font-semibold text-[#0a0a0a]">
          E-mails, um por linha
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"maria.souza@gmail.com\njoao@hotmail.com, João Pedro Lima\nana@empresa.com.br; Ana Clara; (85) 99999-0000"}
            className="mt-1.5 w-full rounded-xl border border-[#e4e4e7] px-3 py-2.5 font-mono text-[12px] font-normal leading-5 outline-none focus:border-[#a1a1aa]"
          />
        </label>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">
          Só o e-mail já basta. Nome e telefone (para o convite no WhatsApp) são opcionais, separados por vírgula. Até 50
          por vez.
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {pending ? "Cadastrando…" : "Cadastrar"}
        </button>
      </div>

      {result && !result.ok && (
        <p className="text-[13px] text-[#c23b3b]" role="alert">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5" role="status">
          <p className="text-[13px] font-semibold text-[#0a0a0a]">
            {result.created.length === 0
              ? "Ninguém novo cadastrado."
              : `${result.created.length} ${result.created.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"} em ${result.jobTitle}.`}
          </p>
          {result.created.length > 0 && (
            <>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Mande o convite para cada uma completar a candidatura. Os e-mails automáticos só chegam depois que o
                domínio estiver verificado no Resend.
              </p>
              <ul className="mt-4 divide-y divide-[#f4f4f5]">
                {result.created.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <Link href={`/candidaturas/${c.id}`} className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#0a0a0a] hover:underline">
                        {c.name}
                      </span>
                      <span className="block truncate text-[11px] text-[#a1a1aa]">{c.email}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => copy(c.id, c.invite)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#0a0a0a] ring-1 ring-[#e4e4e7] hover:bg-[#fafafa]"
                    >
                      {copied === c.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied === c.id ? "Copiado" : "Copiar convite"}
                    </button>
                    {c.whatsapp && (
                      <a
                        href={c.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#1f7a4d] ring-1 ring-[#c6ecd6] hover:bg-[#e7f9f0]"
                      >
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.skipped.length > 0 && (
            <div className="mt-4 text-[12px] text-[#71717a]">
              <p className="font-medium text-[#0a0a0a]">Não cadastrados:</p>
              <ul className="mt-1 list-inside list-disc">
                {result.skipped.map((s) => (
                  <li key={s.email}>
                    {s.email}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.invalid.length > 0 && (
            <p className="mt-3 text-[12px] text-[#c23b3b]">
              {result.invalid.length} {result.invalid.length === 1 ? "linha sem e-mail válido ficou" : "linhas sem e-mail válido ficaram"} no campo acima para você corrigir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
