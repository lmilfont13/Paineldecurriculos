"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, Sparkles } from "lucide-react";
import { getCompanyBirthdaysAction } from "@/server/controllers/birthday.controller";
import type { BirthdayCandidate } from "@/server/models/birthday.model";

/**
 * Badge de lembrete no Topbar do Gestor:
 * Quando há aniversariante(s) hoje, exibe um alerta festivo pulsante para o gestor parabenizar.
 */
export function BirthdayReminderBadge() {
  const [todayBirthdays, setTodayBirthdays] = useState<BirthdayCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getCompanyBirthdaysAction()
      .then((data) => {
        if (active && data) {
          setTodayBirthdays(data.today);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!loaded || todayBirthdays.length === 0) {
    return null;
  }

  const count = todayBirthdays.length;
  const firstName = todayBirthdays[0].name.split(" ")[0];

  return (
    <Link
      href="/aniversariantes"
      title={`${count} aniversariante${count > 1 ? "s" : ""} hoje! Clique para ver e enviar felicitações.`}
      className="group flex items-center gap-1.5 rounded-full border border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-2xs transition hover:border-amber-400 hover:from-amber-100 hover:to-orange-100 active:scale-95 animate-pulse"
    >
      <span className="flex size-2 rounded-full bg-amber-500 animate-ping" />
      <Cake className="size-3.5 text-amber-600 shrink-0" />
      <span className="hidden sm:inline">
        🎂 {count === 1 ? `${firstName} faz aniversário hoje!` : `${count} aniversariantes hoje!`}
      </span>
      <span className="sm:hidden">
        🎂 {count} hoje
      </span>
    </Link>
  );
}

