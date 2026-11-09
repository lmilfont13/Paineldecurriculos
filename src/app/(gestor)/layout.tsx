import type { Metadata } from "next";

import {
  GestorBottomNav,
  GestorSidebar,
  GestorTopbar,
} from "@/components/gestor/sidebar";
import { CommandPalette } from "@/components/gestor/command-palette";
import { SoundNotificationListener } from "@/components/gestor/sound-notification-listener";
import { logoutAction } from "@/server/controllers/auth.controller";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import { brandCssVars } from "@/server/models/company.model";
import { personInitials } from "@/server/models/dashboard.model";
import {
  isCommandPaletteEnabled,
  isSoundNotificationsEnabled,
} from "@/server/services/company-feature.service";

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getGestorShell();
  return {
    icons: {
      icon: company.logoUrl || "/images/tarhget-icon.png",
      apple: "/images/tarhget-icon.png",
    },
  };
}

/**
 * Shell da área do gestor (regra 4): base neutra com a marca do cliente
 * nos acentos-chave (botões primários, estados ativos) via CSS vars --brand-*.
 * No celular a lateral vira barra inferior, porque é pelo telefone que o dono
 * olha quem chegou.
 */
export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company, pendingCount, radioStation, canManageRadio, activeJobsCount, totalJobsCount, jobsToday } = await getGestorShell();
  const commandPaletteEnabled = await isCommandPaletteEnabled(company.id);
  const soundNotificationsEnabled = await isSoundNotificationsEnabled(company.id);
  const userName = user.name ?? user.email;
  const companyInitials = personInitials(company.name);

  return (
    <div
      className="flex min-h-screen bg-[#fafaf9]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      <CommandPalette enabled={commandPaletteEnabled} />
      <SoundNotificationListener pendingCount={pendingCount} enabled={soundNotificationsEnabled} />
      <GestorSidebar
        companyName={company.name}
        companySlug={company.slug}
        companyInitials={companyInitials}
        logoUrl={company.logoUrl}
        pendingCount={pendingCount}
        userName={userName}
        userInitials={personInitials(userName)}
        radioStation={radioStation}
        canManageRadio={canManageRadio}
        activeJobsCount={activeJobsCount}
        totalJobsCount={totalJobsCount}
        jobsToday={jobsToday}

        logoutAction={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <GestorTopbar
          companyName={company.name}
          companySlug={company.slug}
          companyInitials={companyInitials}
          logoUrl={company.logoUrl}
          logoutAction={logoutAction}
          commandPaletteEnabled={commandPaletteEnabled}
          soundEnabled={soundNotificationsEnabled}
        />
        <main className="flex-1 overflow-x-clip px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
      <GestorBottomNav pendingCount={pendingCount} />
    </div>
  );
}
