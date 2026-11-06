import "server-only";

import type { GlobalSearchResult } from "@/server/models/search.model";
import { findGlobalGestorItems } from "@/server/repositories/search.repository";

export async function searchGlobal(
  companyId: string,
  query: string
): Promise<GlobalSearchResult> {
  return findGlobalGestorItems(companyId, query);
}
