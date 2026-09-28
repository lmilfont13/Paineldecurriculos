import type { Metadata } from "next";

import { InviteForm, RemoveManagerButton } from "@/components/gestor/invite-form";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { requireManager } from "@/server/controllers/guards";
import { listCompanyUsers } from "@/server/services/user.service";

export const metadata: Metadata = { title: "Usuários · Triagem" };

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initials(name: string | null, email: string) {
  const src = name ?? email;
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function UsuariosPage() {
  const manager = await requireManager();
  const users = await listCompanyUsers(manager.companyId);

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">Gerencie quem tem acesso ao painel.</p>
      <SettingsTabs />

      <div className="mt-8 max-w-[640px] space-y-8">
        {/* Lista de usuários */}
        <section>
          <h2 className="text-sm font-semibold text-[#0a0a0a]">
            Quem tem acesso ({users.length})
          </h2>
          <ul className="mt-3 divide-y divide-[#f4f4f5] rounded-xl border border-[#e4e4e7] bg-white">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[11px] font-bold text-white">
                  {initials(u.name, u.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[#0a0a0a]">
                    {u.name ?? u.email}
                    {u.id === manager.id && (
                      <span className="ml-2 text-[11px] font-normal text-[#a1a1aa]">você</span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-[#71717a]">
                    {u.email} · desde {formatDate(u.createdAt)}
                  </p>
                </div>
                <RemoveManagerButton
                  userId={u.id}
                  isSelf={u.id === manager.id}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Convidar novo usuário */}
        <section>
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Convidar pessoa</h2>
          <p className="mt-1 text-[12px] text-[#71717a]">
            A pessoa receberá um link por e-mail para definir a própria senha e acessar o painel.
          </p>
          <InviteForm />
        </section>
      </div>
    </>
  );
}
