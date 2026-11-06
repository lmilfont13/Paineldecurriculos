"use server";

import { requireManager } from "@/server/controllers/guards";
import { searchGlobal } from "@/server/services/search.service";
import { isCommandPaletteEnabled } from "@/server/services/company-feature.service";
import type { GlobalSearchResult } from "@/server/models/search.model";

/**
 * Controller de busca global do Command Palette (Ctrl+K).
 * Respeita estritamente o isolamento multi-tenant (companyId da sessão).
 */
export async function searchGlobalAction(query: string): Promise<GlobalSearchResult> {
  const user = await requireManager();
  const enabled = await isCommandPaletteEnabled(user.companyId);
  if (!enabled) {
    return { candidates: [], jobs: [] };
  }
  return searchGlobal(user.companyId, query);
}

