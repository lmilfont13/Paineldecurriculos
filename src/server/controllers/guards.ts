import "server-only";

import { redirect } from "next/navigation";

import type { AdminUser, ManagerUser } from "@/server/models/user.model";
import {
  getSessionUser,
  isAdmin,
  isManager,
} from "@/server/services/auth.service";

/**
 * Guards de rota — usados nos layouts/páginas protegidas.
 * O proxy (src/proxy.ts) só verifica existência de sessão; o papel (role)
 * é verificado aqui, onde há acesso ao banco.
 */

export async function requireManager(): Promise<ManagerUser> {
  const user = await getSessionUser();
  if (!user || !isManager(user)) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) redirect("/login");
  return user;
}
