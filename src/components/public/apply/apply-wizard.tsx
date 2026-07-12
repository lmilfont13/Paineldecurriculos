"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import type { PublicCompany } from "@/server/models/company.model";
import type { PublicFormField } from "@/server/models/form.model";
import type { PublicJob } from "@/server/models/job.model";
import { submitApplicationAction } from "@/server/controllers/application.controller";

const STEPS = ["Você", "Perfil", "Extras", "Envio"] as const;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type WizardData = {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
};

/** P3–P7 · Candidatura multi-step (frames 87:72 a 87:243 do Figma). */
export function ApplyWizard({
  company,
  job,
  coreFields,
  customFields,
}: {
  company: PublicCompany;
  job: PublicJob;
  coreFields: PublicFormField[];
  customFields: PublicFormField[];
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    name: "",
    email: "",
    phone: "",
    answers: {},
  });
  const [resume, setResume] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setAnswer = (fieldId: string, value: string) =>
    setData((d) => ({ ...d, answers: { ...d.answers, [fieldId]: value } }));

  const stepError = useMemo(() => {
    if (step === 0) {
      if (data.name.trim().length < 2) return "Informe seu nome completo.";
      if (!/^\S+@\S+\.\S+$/.test(data.email)) return "Informe um e-mail válido.";
      if (data.phone.trim().length < 8) return "Informe um telefone válido.";
    }
    const fields = step === 1 ? coreFields : step === 2 ? customFields : [];
    for (const field of fields) {
      if (
        field.required &&
        field.type !== "FILE_UPLOAD" &&
        !(data.answers[field.id] ?? "").trim()
      ) {
        return `Preencha o campo "${field.label}".`;
      }
    }
    return null;
  }, [step, data, coreFields, customFields]);

  function next() {
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function pickResume(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("O currículo deve ser um PDF.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError("O currículo deve ter no máximo 5 MB.");
      return;
    }
    setError(null);
    setResume(file);
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("slug", company.slug);
    formData.set("jobId", job.id);
    formData.set("name", data.name.trim());
    formData.set("email", data.email.trim());
    formData.set("phone", data.phone.trim());
    formData.set("answers", JSON.stringify(data.answers));
    if (resume) formData.set("resume", resume);

    startTransition(async () => {
      const result = await submitApplicationAction(formData);
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (sent) {
    return <Confirmation company={company} job={job} email={data.email} />;
  }

  const progress = ["w-0", "w-1/3", "w-2/3", "w-full"][step];

  return (
    <div className="mx-auto w-full max-w-[512px] px-6">
      {/* Stepper */}
      <ol className="flex justify-between px-8">
        {STEPS.map((label, i) => (
          <li key={label} className="flex w-24 flex-col items-center gap-2">
            <span
              className={
                "flex size-6 items-center justify-center rounded-full text-[10px] font-bold " +
                (i === step ? "ring-4 ring-[#0a0a0a]/10 " : "") +
                (i > step ? "bg-[#e4e4e7]" : "")
              }
              style={
                i <= step
                  ? {
                      backgroundColor: "var(--brand-primary)",
                      color: "var(--brand-foreground)",
                    }
                  : undefined
              }
            >
              {i < step ? "✓" : ""}
            </span>
            <span
              className={
                "text-xs " +
                (i === step ? "font-medium" : "text-[#71717a]")
              }
              style={
                i === step ? { color: "var(--brand-primary)" } : undefined
              }
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 h-1.5 w-full rounded-[3px] bg-[#e4e4e7]">
        <div
          className={`h-1.5 rounded-[3px] transition-all ${progress}`}
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      {/* Card */}
      <div className="mt-14 flex min-h-[600px] flex-col rounded-3xl border border-[#e4e4e7] bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.07)]">
        <div className="flex-1">
          {step === 0 && (
            <StepShell
              title="Vamos começar por você"
              subtitle="Só o básico pra gente te identificar."
            >
              <Field label="Nome completo">
                <TextInput
                  value={data.name}
                  onChange={(v) => setData((d) => ({ ...d, name: v }))}
                  placeholder="Como você quer ser chamado(a)"
                  autoComplete="name"
                />
              </Field>
              <Field label="E-mail">
                <TextInput
                  type="email"
                  value={data.email}
                  onChange={(v) => setData((d) => ({ ...d, email: v }))}
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefone / WhatsApp">
                <TextInput
                  type="tel"
                  value={data.phone}
                  onChange={(v) => setData((d) => ({ ...d, phone: v }))}
                  placeholder="(85) 9 0000-0000"
                  autoComplete="tel"
                />
              </Field>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              title="Seu perfil profissional"
              subtitle="Conte um pouco sobre sua experiência."
            >
              {coreFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={data.answers[field.id] ?? ""}
                  onChange={(v) => setAnswer(field.id, v)}
                />
              ))}
              <Field label="Currículo (PDF)">
                <div className="flex items-center gap-4 rounded-md border border-[#e4e4e7] bg-[#fafaf9] p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white">
                    <span className="size-[18px] rounded-[3px] bg-[#71717a]/45" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                      {resume
                        ? resume.name
                        : "Arraste aqui ou selecione um arquivo"}
                    </span>
                    <span className="block text-xs text-[#71717a]">
                      PDF até 5 MB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-24 shrink-0 rounded-lg border border-[#0a0a0a]/85 bg-white text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
                  >
                    {resume ? "Trocar" : "Escolher"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => pickResume(e.target.files?.[0] ?? null)}
                  />
                </div>
              </Field>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              title={`Perguntas da ${company.name}`}
              subtitle="Campos definidos por esta empresa."
            >
              {customFields.length === 0 && (
                <p className="text-sm text-[#71717a]">
                  Esta empresa não definiu perguntas adicionais. Pode continuar.
                </p>
              )}
              {customFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={data.answers[field.id] ?? ""}
                  onChange={(v) => setAnswer(field.id, v)}
                />
              ))}
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              title="Tudo certo?"
              subtitle="Revise antes de enviar sua candidatura."
            >
              <dl>
                <ReviewRow label="Nome" value={data.name} />
                <ReviewRow label="E-mail" value={data.email} />
                <ReviewRow label="Telefone" value={data.phone} />
                {[...coreFields, ...customFields]
                  .filter((f) => (data.answers[f.id] ?? "").trim())
                  .map((f) => (
                    <ReviewRow
                      key={f.id}
                      label={f.label}
                      value={data.answers[f.id]}
                    />
                  ))}
                <ReviewRow
                  label="Currículo"
                  value={resume ? resume.name : "Não enviado"}
                />
              </dl>
            </StepShell>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={pending}
              className="flex h-10 w-[100px] items-center justify-center gap-2 rounded-2xl border border-[#e4e4e7] bg-white text-sm font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              <span aria-hidden>‹</span> Voltar
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="flex h-10 w-32 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-foreground)",
              }}
            >
              Continuar <span aria-hidden>›</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="flex h-10 w-[200px] items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-foreground)",
              }}
            >
              {pending ? "Enviando…" : "Enviar candidatura"}{" "}
              {!pending && <span aria-hidden>›</span>}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 pb-16 text-center text-sm text-[#71717a]">
        Passo {step + 1} de 4: {STEPS[step]}
      </p>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[#0a0a0a]">{title}</h1>
      <p className="mt-2 text-sm text-[#71717a]">{subtitle}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
    />
  );
}

/** Renderiza um FormField da empresa conforme o tipo. */
function DynamicField({
  field,
  value,
  onChange,
}: {
  field: PublicFormField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = field.required ? field.label : `${field.label} (opcional)`;

  if (field.type === "YES_NO") {
    return (
      <Field label={label}>
        <div className="grid grid-cols-2 gap-4">
          {["Sim", "Não"].map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                aria-pressed={selected}
                className={
                  "flex h-11 items-center gap-3 rounded-md border px-4 text-sm " +
                  (selected
                    ? "bg-[#fafafa] text-[#0a0a0a]"
                    : "border-[#e4e4e7] bg-white text-[#71717a]")
                }
                style={
                  selected ? { borderColor: "var(--brand-primary)" } : undefined
                }
              >
                <span
                  className={
                    "flex size-[15px] items-center justify-center rounded-full border " +
                    (selected ? "" : "border-[#e4e4e7]")
                  }
                  style={
                    selected ? { borderColor: "var(--brand-primary)" } : undefined
                  }
                >
                  {selected && (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    />
                  )}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </Field>
    );
  }

  if (field.type === "DROPDOWN") {
    return (
      <Field label={label}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
        >
          <option value="">Selecione…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === "LONG_TEXT") {
    return (
      <Field label={label}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <TextInput
        type={
          field.type === "NUMBER"
            ? "number"
            : field.type === "DATE"
              ? "date"
              : "text"
        }
        value={value}
        onChange={onChange}
      />
    </Field>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[#e4e4e7] py-3 last:border-b-0">
      <dt className="shrink-0 text-xs text-[#71717a]">{label}</dt>
      <dd className="truncate text-right text-[13px] text-[#0a0a0a]">
        {value}
      </dd>
    </div>
  );
}

/** P7 · Confirmação (frame 87:243). */
function Confirmation({
  company,
  job,
  email,
}: {
  company: PublicCompany;
  job: PublicJob;
  email: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[512px] px-6 pt-8">
      <div className="flex flex-col items-center rounded-3xl border border-[#e4e4e7] bg-white px-7 py-12 text-center shadow-[0px_4px_6px_rgba(0,0,0,0.07)]">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <span className="text-2xl text-green-600" aria-hidden>
            ✓
          </span>
        </span>
        <h1 className="mt-7 text-2xl font-semibold text-[#0a0a0a]">
          Candidatura enviada
        </h1>
        <p className="mt-3 max-w-[400px] text-sm leading-[21px] text-[#71717a]">
          A {company.name} recebeu sua candidatura para {job.title}.
        </p>
        <p className="mt-8 w-full max-w-[400px] rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-4 py-3 text-xs text-[#71717a]">
          Confirmação enviada para {email}
        </p>
        <Link
          href={`/${company.slug}/vagas`}
          className="mt-6 flex h-11 w-[200px] items-center justify-center rounded-2xl border border-[#0a0a0a]/85 bg-white text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
        >
          Ver outras vagas
        </Link>
      </div>
    </div>
  );
}
