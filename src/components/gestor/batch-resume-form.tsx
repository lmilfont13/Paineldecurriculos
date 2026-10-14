"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Copy, FileText, Loader2, MessageCircle, Upload } from "lucide-react";

import { checkResumeFile, uploadResumeToStorage } from "@/lib/resume-upload";
import {
  importBatchResumeAction,
  requestBatchUploadsAction,
} from "@/server/controllers/intake.controller";

const LIMIT = 30;

type Row = {
  key: string;
  file: File;
  state: "pronto" | "enviando" | "lendo" | "feito" | "existe" | "sem-email" | "erro";
  path?: string;
  message?: string;
  id?: string;
  name?: string;
  email?: string;
  invite?: string;
  whatsapp?: string | null;
  typedEmail?: string;
};

const STATE_LABEL: Record<Row["state"], string> = {
  pronto: "na fila",
  enviando: "enviando…",
  lendo: "lendo o currículo…",
  feito: "cadastrado · IA analisando",
  existe: "já estava nesta vaga",
  "sem-email": "sem e-mail no PDF",
  erro: "não importado",
};

/**
 * Lote de currículos: o gestor solta vários PDFs, cada um vai direto ao
 * Storage (regra 5), o sistema lê nome/e-mail/telefone, faz o pré-cadastro na
 * vaga e manda para a análise da IA. Sem e-mail no PDF, pede para digitar.
 */
export function BatchResumeForm({
  jobs,
  initialJobId,
}: {
  jobs: { id: string; title: string }[];
  initialJobId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState(initialJobId);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const patch = (key: string, data: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...data } : r)));

  function addFiles(list: FileList | File[]) {
    const pdfs = Array.from(list).slice(0, LIMIT);
    setRows((current) =>
      [
        ...current.filter((r) => r.state !== "pronto"),
        ...current.filter((r) => r.state === "pronto"),
        ...pdfs.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, state: "pronto" as const })),
      ].slice(-LIMIT * 2)
    );
  }

  async function applyResult(row: Row, result: Awaited<ReturnType<typeof importBatchResumeAction>>) {
    if (result.status === "created") {
      patch(row.key, {
        state: "feito",
        id: result.id,
        name: result.name,
        email: result.email,
        invite: result.invite,
        whatsapp: result.whatsapp,
      });
    } else if (result.status === "exists") {
      patch(row.key, { state: "existe", id: result.id, name: result.name, email: result.email });
    } else if (result.status === "needs_email") {
      patch(row.key, { state: "sem-email", name: result.name });
    } else {
      patch(row.key, { state: "erro", message: result.reason });
    }
  }

  async function start() {
    const queue = rows.filter((r) => r.state === "pronto");
    if (queue.length === 0) return;
    setRunning(true);
    try {
      // 1) confere os arquivos no navegador
      const valid: Row[] = [];
      for (const row of queue) {
        const problem = await checkResumeFile(row.file);
        if (problem) patch(row.key, { state: "erro", message: problem });
        else valid.push(row);
      }
      if (valid.length === 0) return;

      // 2) URLs assinadas e upload direto ao Storage (3 por vez)
      const targets = await requestBatchUploadsAction(jobId, valid.length);
      if (!targets || targets.length < valid.length) {
        valid.forEach((r) => patch(r.key, { state: "erro", message: "Não foi possível preparar o envio." }));
        return;
      }
      const uploaded: Row[] = [];
      for (let i = 0; i < valid.length; i += 3) {
        await Promise.all(
          valid.slice(i, i + 3).map(async (row, j) => {
            const target = targets[i + j];
            patch(row.key, { state: "enviando" });
            const sent = await uploadResumeToStorage(row.file, target);
            if (!sent.ok) patch(row.key, { state: "erro", message: sent.error });
            else {
              patch(row.key, { path: target.path });
              uploaded.push({ ...row, path: target.path });
            }
          })
        );
      }

      // 3) um por vez: lê, pré-cadastra e manda para a IA
      for (const row of uploaded) {
        patch(row.key, { state: "lendo" });
        try {
          await applyResult(row, await importBatchResumeAction(jobId, row.path!, row.file.name));
        } catch {
          patch(row.key, { state: "erro", message: "Falha ao importar. Tente de novo." });
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function retryWithEmail(row: Row) {
    if (!row.path || !row.typedEmail) return;
    patch(row.key, { state: "lendo" });
    try {
      await applyResult(row, await importBatchResumeAction(jobId, row.path, row.file.name, row.typedEmail));
    } catch {
      patch(row.key, { state: "erro", message: "Falha ao importar. Tente de novo." });
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* sem permissão de área de transferência */
    }
  }

  const pending = rows.filter((r) => r.state === "pronto").length;
  const done = rows.filter((r) => r.state === "feito").length;

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
        <label className="block text-[12px] font-semibold text-[#0a0a0a]">
          Vaga
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={running}
            className="mt-1.5 h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] font-normal"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!running) addFiles(e.dataTransfer.files);
          }}
          onClick={() => !running && inputRef.current?.click()}
          className={
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
            (dragging ? "border-[var(--brand-primary)] bg-[#fafaf9]" : "border-[#e4e4e7] hover:bg-[#fafaf9]")
          }
        >
          <Upload className="size-5 text-[#a1a1aa]" aria-hidden />
          <p className="mt-2 text-[13px] font-medium text-[#0a0a0a]">Arraste os currículos aqui ou clique para escolher</p>
          <p className="mt-0.5 text-[11px] text-[#a1a1aa]">PDF até 5 MB cada · até {LIMIT} por vez</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <button
          type="button"
          onClick={start}
          disabled={running || pending === 0}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          {running ? "Importando…" : pending > 0 ? `Importar ${pending} ${pending === 1 ? "currículo" : "currículos"}` : "Importar"}
        </button>
        {done > 0 && !running && (
          <p className="mt-2 text-[12px] text-[#1f7a4d]">
            {done} {done === 1 ? "candidato pré-cadastrado" : "candidatos pré-cadastrados"}. As notas aparecem em Candidatos em alguns segundos.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-[#f4f4f5] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                {row.id ? (
                  <Link href={`/candidaturas/${row.id}`} className="block truncate text-[13px] font-medium text-[#0a0a0a] hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">{row.name ?? row.file.name}</span>
                )}
                <span className="block truncate text-[11px] text-[#a1a1aa]">
                  {row.email ? `${row.email} · ` : ""}
                  {row.file.name}
                </span>
              </div>
              <span
                className={
                  "text-[11px] font-medium " +
                  (row.state === "feito"
                    ? "text-[#1f7a4d]"
                    : row.state === "erro"
                      ? "text-[#c23b3b]"
                      : row.state === "sem-email"
                        ? "text-[#a16207]"
                        : "text-[#71717a]")
                }
              >
                {(row.state === "enviando" || row.state === "lendo") && (
                  <Loader2 className="mr-1 inline size-3 animate-spin" />
                )}
                {row.message ?? STATE_LABEL[row.state]}
              </span>

              {row.state === "sem-email" && (
                <span className="flex w-full items-center gap-2 sm:w-auto">
                  <input
                    type="email"
                    placeholder="e-mail do candidato"
                    value={row.typedEmail ?? ""}
                    onChange={(e) => patch(row.key, { typedEmail: e.target.value })}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-[#e4e4e7] px-2 text-[12px] sm:w-56"
                  />
                  <button
                    type="button"
                    onClick={() => retryWithEmail(row)}
                    disabled={!row.typedEmail}
                    className="h-8 rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
                  >
                    Cadastrar
                  </button>
                </span>
              )}

              {row.state === "feito" && row.invite && (
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(row.key, row.invite!)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#0a0a0a] ring-1 ring-[#e4e4e7] hover:bg-[#fafafa]"
                  >
                    {copied === row.key ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === row.key ? "Copiado" : "Convite"}
                  </button>
                  {row.whatsapp && (
                    <a
                      href={row.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#1f7a4d] ring-1 ring-[#c6ecd6] hover:bg-[#e7f9f0]"
                    >
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </a>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
