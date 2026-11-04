"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import {
  addReferrerAction,
  listReferrersAction,
  removeReferrerAction,
} from "@/server/controllers/referrer.controller";
import type { ReferrerDTO } from "@/server/models/attribution.model";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-lg bg-[#f4f4f5] px-2 py-1 text-[11px] text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#0a0a0a]"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Copy className="size-3" />
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

export function ReferrerManager({
  companySlug,
  appUrl,
}: {
  companySlug: string;
  appUrl: string;
}) {
  const [referrers, setReferrers] = useState<ReferrerDTO[]>([]);
  const [loading, startLoad] = useTransition();
  const [adding, startAdd] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    startLoad(async () => {
      const data = await listReferrersAction();
      setReferrers(data);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    if (name.trim().length < 2) return;
    setError(null);
    startAdd(async () => {
      try {
        await addReferrerAction(name.trim());
        setName("");
        refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao criar indicador.");
      }
    });
  };

  const handleRemove = (id: string) => {
    startLoad(async () => {
      await removeReferrerAction(id);
      refresh();
    });
  };

  const baseUrl = `${appUrl}/${companySlug}/vagas`;

  // Ranking: ordena por candidaturas desc
  const ranked = [...referrers].sort(
    (a, b) => (b.applicationCount ?? 0) - (a.applicationCount ?? 0),
  );

  return (
    <div className="space-y-8">
      {/* Adicionar indicador */}
      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0a0a0a]">
          <Plus className="size-4 text-[#a1a1aa]" />
          Novo indicador
        </h2>
        <p className="mt-1 text-[12px] text-[#71717a]">
          Cadastre um funcionário ou parceiro. Cada indicador recebe um link
          próprio para divulgar as vagas; as candidaturas que chegam por esse
          link ficam marcadas como indicação dele.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nome do indicador (ex: João Silva)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-10 w-64 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#0a0a0a)]/20"
          />
          <button
            type="button"
            disabled={adding || name.trim().length < 2}
            onClick={handleAdd}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 text-[13px] font-medium text-white hover:bg-[#27272a] disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Criar
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[12px] text-red-600">{error}</p>
        )}
      </section>

      {/* Lista e ranking */}
      {loading && referrers.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
          <Loader2 className="size-4 animate-spin" /> Carregando indicadores…
        </div>
      ) : referrers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[#d4d4d8] bg-[#fafaf9] p-6 text-center">
          <Users className="mx-auto size-8 text-[#d4d4d8]" />
          <p className="mt-2 text-[13px] text-[#71717a]">
            Nenhum indicador cadastrado ainda.
          </p>
          <p className="text-[11px] text-[#a1a1aa]">
            Crie o primeiro acima para gerar links de indicação.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0a0a0a]">
              <Trophy className="size-4 text-[#a1a1aa]" />
              Ranking de indicações
            </h2>
            <div className="mt-3 space-y-2">
              {ranked.map((ref, i) => {
                const link = `${baseUrl}?ref=${ref.code}`;
                return (
                  <div
                    key={ref.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold " +
                          (i === 0
                            ? "bg-[#fef3c7] text-[#b07818]"
                            : i === 1
                              ? "bg-[#f1f0ed] text-[#71717a]"
                              : i === 2
                                ? "bg-[#fef0e1] text-[#b07818]"
                                : "bg-[#f4f4f5] text-[#a1a1aa]")
                        }
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-[#0a0a0a]">
                          {ref.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-[#71717a]">
                          <span>
                            {ref.applicationCount ?? 0}{" "}
                            {(ref.applicationCount ?? 0) === 1
                              ? "candidatura"
                              : "candidaturas"}
                          </span>
                          <span>
                            {ref.hiredCount ?? 0}{" "}
                            {(ref.hiredCount ?? 0) === 1
                              ? "contratação"
                              : "contratações"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-[#fafaf9] px-2.5 py-1.5 ring-1 ring-[#e4e4e7]">
                        <Link2 className="size-3 text-[#a1a1aa]" />
                        <code className="max-w-[180px] truncate text-[11px] text-[#52525b] sm:max-w-[300px]">
                          {link}
                        </code>
                      </div>
                      <CopyButton text={link} />
                      <button
                        type="button"
                        title="Remover indicador"
                        onClick={() => handleRemove(ref.id)}
                        className="rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#fef2f2] hover:text-red-500"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Como funciona */}
          <section className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-5">
            <h3 className="text-[12px] font-semibold text-[#0a0a0a]">
              Como funciona
            </h3>
            <ol className="mt-2 space-y-1.5 text-[12px] text-[#71717a]">
              <li>
                <strong className="text-[#52525b]">1.</strong> Copie o link do
                indicador e envie para ele.
              </li>
              <li>
                <strong className="text-[#52525b]">2.</strong> Quando ele
                compartilhar com alguém, o candidato acessa a página de vagas
                pelo link.
              </li>
              <li>
                <strong className="text-[#52525b]">3.</strong> A candidatura
                fica marcada como indicação daquele funcionário, e o ranking
                atualiza automaticamente.
              </li>
            </ol>
            <p className="mt-3 text-[11px] text-[#a1a1aa]">
              O link funciona para todas as vagas da empresa. O parâmetro{" "}
              <code className="rounded bg-[#e4e4e7] px-1">?ref=</code> identifica
              o indicador; ele fica salvo num cookie de 30 dias no navegador do
              candidato.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
