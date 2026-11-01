"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import type { CandidateProfile } from "@/server/models/candidate.model";
import {
  deleteAccountAction,
  requestProfileResumeUploadAction,
  updateProfileAction,
  type CandidateAuthState,
} from "@/server/controllers/candidate.controller";
import { checkResumeFile, uploadResumeToStorage } from "@/lib/resume-upload";
import { AddressFields } from "@/components/public/address-fields";
import { AdmissionFields } from "@/components/public/admission-fields";

const inputClass =
  "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

/** CA5 · Edição do perfil + CA8 · exclusão de conta. */
export function ProfileForm({
  slug,
  candidate,
}: {
  slug: string;
  candidate: CandidateProfile;
}) {
  const [state, formAction, pending] = useActionState<
    CandidateAuthState,
    FormData
  >(updateProfileAction.bind(null, slug), null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  return (
    <div className="space-y-6">
      <form
        action={(formData) => {
          setUploadError(null);
          // Regra 5: o PDF sobe direto do navegador para o Storage; a action
          // recebe só o caminho (sem o limite de corpo da Vercel).
          const file = formData.get("resume");
          formData.delete("resume");
          startUpload(async () => {
            if (file instanceof File && file.size > 0) {
              const problem = await checkResumeFile(file);
              if (problem) return setUploadError(problem);
              const target = await requestProfileResumeUploadAction();
              if (!target.ok) return setUploadError(target.error);
              const uploaded = await uploadResumeToStorage(file, target);
              if (!uploaded.ok) return setUploadError(uploaded.error);
              formData.set("resumePath", target.path);
            }
            setSaved(true);
            formAction(formData);
          });
        }}
        className="space-y-5 rounded-3xl border border-[#e4e4e7] bg-white p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
              Nome completo
            </span>
            <input
              name="name"
              defaultValue={candidate.name}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
              Data de nascimento
            </span>
            <input
              type="date"
              name="birthDate"
              defaultValue={
                candidate.birthDate
                  ? new Date(candidate.birthDate).toISOString().split("T")[0]
                  : ""
              }
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
              E-mail
            </span>
            <input
              value={candidate.email}
              readOnly
              disabled
              className="h-10 w-full rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-3 text-sm text-[#71717a]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
              Telefone / WhatsApp
            </span>
            <input
              name="phone"
              defaultValue={candidate.phone ?? ""}
              placeholder="(85) 9 0000-0000"
              className={inputClass}
            />
          </label>
        </div>

        {/* Endereço completo: usado na admissão, na adequação de vagas e no VT */}
        <div className="rounded-2xl border border-[#f4f4f5] bg-[#fafaf9] p-4">
          <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#71717a]">
            Endereço
          </span>
          <AddressFields
            initial={{
              zipCode: candidate.zipCode ?? "",
              street: candidate.street ?? "",
              streetNumber: candidate.streetNumber ?? "",
              complement: candidate.complement ?? "",
              neighborhood: candidate.neighborhood ?? "",
              city: candidate.city ?? "",
              state: candidate.state ?? "",
            }}
          />
        </div>

        {/* Admissão (opcional): adianta o processo de quem for aprovado */}
        <div className="rounded-2xl border border-[#f4f4f5] bg-[#fafaf9] p-4">
          <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#71717a]">
            Documentos e uniforme (opcional)
          </span>
          <AdmissionFields
            initial={{
              rg: candidate.rg ?? "",
              cpf: candidate.cpf ?? "",
              bootSize: candidate.bootSize ?? "",
              pantsSize: candidate.pantsSize ?? "",
              shirtSize: candidate.shirtSize ?? "",
            }}
          />
        </div>

        {/* Critérios Essenciais de Triagem */}
        <div className="rounded-2xl border border-[#f4f4f5] bg-[#fafaf9] p-4">
          <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#71717a]">
            Objetivo e Critérios de Busca
          </span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">
                Função pretendida / Cargo de interesse
              </span>
              <input
                name="desiredRole"
                defaultValue={candidate.desiredRole ?? ""}
                placeholder="Ex: Assistente Administrativo, Vendedor, Desenvolvedor"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">
                Pretensão salarial
              </span>
              <input
                list="salary-options"
                name="salaryExpectation"
                defaultValue={candidate.salaryExpectation ?? ""}
                placeholder="Selecione ou digite (Ex: R$ 3.500)"
                className={inputClass}
              />
              <datalist id="salary-options">
                <option value="A combinar" />
                <option value="Até R$ 2.000" />
                <option value="R$ 2.000 a R$ 3.500" />
                <option value="R$ 3.500 a R$ 5.000" />
                <option value="R$ 5.000 a R$ 8.000" />
                <option value="R$ 8.000 a R$ 12.000" />
                <option value="Acima de R$ 12.000" />
              </datalist>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">
                Modalidade de trabalho
              </span>
              <select
                name="workPreference"
                defaultValue={candidate.workPreference ?? "ANY"}
                className={inputClass}
              >
                <option value="ANY">Qualquer modalidade</option>
                <option value="ONSITE">Presencial</option>
                <option value="HYBRID">Híbrido</option>
                <option value="REMOTE">100% Remoto</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">
                Disponibilidade para início
              </span>
              <select
                name="availability"
                defaultValue={candidate.availability ?? "IMMEDIATE"}
                className={inputClass}
              >
                <option value="IMMEDIATE">Imediata</option>
                <option value="15_DAYS">Até 15 dias</option>
                <option value="30_DAYS">Até 30 dias</option>
                <option value="NEGOTIABLE">A combinar</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#0a0a0a]">
                Carteira de Habilitação (CNH)
              </span>
              <select
                name="hasCnh"
                defaultValue={candidate.hasCnh ?? "NONE"}
                className={inputClass}
              >
                <option value="NONE">Não possui</option>
                <option value="A">Categoria A (Moto)</option>
                <option value="B">Categoria B (Carro)</option>
                <option value="AB">Categoria AB (Carro e Moto)</option>
                <option value="C_D_E">Categoria C, D ou E (Pesados)</option>
              </select>
            </label>
          </div>

          {/* PCD */}
          <div className="mt-4 border-t border-[#e4e4e7] pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isPcd"
                value="true"
                defaultChecked={Boolean(candidate.isPcd)}
                className="size-4 rounded border-gray-300 text-[#0a0a0a] focus:ring-[#0a0a0a]"
              />
              <span className="text-xs font-medium text-[#0a0a0a]">
                Sou Pessoa com Deficiência (PCD)
              </span>
            </label>
            <div className="mt-2">
              <input
                name="pcdDetails"
                defaultValue={candidate.pcdDetails ?? ""}
                placeholder="Se desejar, descreva o tipo de deficiência ou necessidades de acessibilidade (opcional)"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
            Currículo (PDF)
          </span>
          <div className="flex items-center gap-4 rounded-md border border-[#e4e4e7] bg-[#fafaf9] p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                {fileName ??
                  (candidate.resumeUrl
                    ? "Currículo salvo no perfil"
                    : "Nenhum currículo salvo")}
              </span>
              <span className="block text-xs text-[#71717a]">PDF até 5 MB</span>
            </span>
            {candidate.resumeUrl && !fileName && (
              <a
                href={`/${slug}/perfil/cv`}
                className="h-9 shrink-0 rounded-lg px-3 text-xs font-medium leading-9 text-[#71717a] hover:text-[#0a0a0a]"
              >
                Baixar
              </a>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 shrink-0 rounded-lg border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
            >
              {candidate.resumeUrl || fileName ? "Trocar" : "Escolher"}
            </button>
            <input
              ref={fileRef}
              type="file"
              name="resume"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>
        </div>

        {(uploadError ?? state?.error) && (
          <p role="alert" className="text-sm text-red-600">
            {uploadError ?? state?.error}
          </p>
        )}
        {saved && !uploadError && !state?.error && !pending && !uploading && (
          <p className="text-sm text-[#1f7a4d]">Perfil atualizado.</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || uploading}
            className="h-10 rounded-2xl px-6 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {uploading ? "Enviando currículo…" : pending ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </form>

      {/* CA8 · Zona de exclusão (LGPD) */}
      <div className="rounded-3xl border border-[#e8d5d2] bg-white p-6">
        <h2 className="text-sm font-semibold text-[#c23b3b]">
          Excluir minha conta
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#71717a]">
          Seus dados pessoais e currículos são apagados definitivamente. As
          empresas mantêm apenas o registro anônimo dos processos.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-4 h-10 rounded-2xl border border-[#e8d5d2] bg-white px-5 text-[13px] font-medium text-[#c23b3b] hover:bg-[#fdf7f6]"
          >
            Excluir conta…
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={deleting}
              onClick={() => startDelete(() => deleteAccountAction(slug))}
              className="h-10 rounded-2xl bg-[#c23b3b] px-5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {deleting ? "Excluindo…" : "Confirmar exclusão definitiva"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
              className="h-10 rounded-2xl border border-[#e4e4e7] px-5 text-[13px] font-medium text-[#71717a]"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
