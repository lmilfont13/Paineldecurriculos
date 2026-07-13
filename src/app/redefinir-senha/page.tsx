import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Redefinir senha · Triagem" };

/** Destino do link de recuperação enviado por e-mail (?code=…). */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-6">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[28px] font-bold text-[#0a0a0a]">
          Redefinir senha
        </h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Escolha sua nova senha de acesso.
        </p>
        <div className="mt-8">
          {code ? (
            <ResetPasswordForm code={code} />
          ) : (
            <p className="rounded-md bg-[#f4f4f5] px-4 py-3 text-sm text-[#0a0a0a]">
              Link inválido ou incompleto.{" "}
              <Link
                href="/recuperar-senha"
                className="font-medium hover:underline"
              >
                Peça um novo link ›
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
