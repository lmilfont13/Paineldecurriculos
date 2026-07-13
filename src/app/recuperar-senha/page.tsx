import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Recuperar senha · Triagem" };

/** CA7/G13 · Recuperação de senha (gestor, admin e candidato). */
export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-6">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[28px] font-bold text-[#0a0a0a]">
          Recuperar senha
        </h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Enviaremos um link para você definir uma nova senha.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
