"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CandidateSlugInput() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = slug.trim().toLowerCase();
    if (value) router.push(`/${value}/vagas`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="nome-da-empresa"
        aria-label="Slug da empresa"
        className="h-10 flex-1 rounded-xl border border-[#e4e0dc] bg-[#faf9f8] px-3 text-sm text-[#1c1917] placeholder:text-[#a8a29e] focus:border-[#1c1917] focus:outline-none"
      />
      <button
        type="submit"
        disabled={!slug.trim()}
        className="h-10 rounded-xl bg-[#1c1917] px-4 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        Acessar
      </button>
    </form>
  );
}
