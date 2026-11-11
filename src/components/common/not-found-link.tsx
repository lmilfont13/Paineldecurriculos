"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { notFoundTarget } from "@/server/models/not-found.model";

/** Botão da página 404: volta para o lugar que faz sentido para quem se perdeu. */
export function NotFoundLink() {
  const { href, label } = notFoundTarget(usePathname() ?? "/");
  return (
    <Link
      href={href}
      className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[#1c1917] px-5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
    >
      {label}
    </Link>
  );
}
