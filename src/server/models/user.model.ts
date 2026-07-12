import type { Role } from "@prisma/client";
import { z } from "zod";

/** Usuário autenticado resolvido a partir da sessão Supabase + tabela User. */
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  companyId: string | null;
};

/** Gestor autenticado — sempre vinculado a uma empresa (isolamento multi-tenant). */
export type ManagerUser = SessionUser & {
  role: "MANAGER";
  companyId: string;
};

/** Admin da plataforma — não pertence a nenhuma empresa. */
export type AdminUser = SessionUser & {
  role: "ADMIN";
};

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;
