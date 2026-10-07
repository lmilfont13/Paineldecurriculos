import { describe, expect, it } from "vitest";

import { normalizeDatabaseUrl } from "@/lib/database-url";

const host = "postgres.ref:senha@aws-0-us-west-2.pooler.supabase.com";

describe("normalizeDatabaseUrl", () => {
  it("troca o pooler de sessão (5432) pelo de transação (6543) com os parâmetros", () => {
    const url = new URL(normalizeDatabaseUrl(`postgresql://${host}:5432/postgres`)!);
    expect(url.port).toBe("6543");
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("connection_limit")).toBe("1");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("mantém pool_timeout já definido e força connection_limit=1", () => {
    const url = new URL(
      normalizeDatabaseUrl(
        `postgresql://${host}:6543/postgres?connection_limit=10&pool_timeout=30`
      )!
    );
    expect(url.searchParams.get("connection_limit")).toBe("1");
    expect(url.searchParams.get("pool_timeout")).toBe("30");
  });

  it("não mexe em URLs que não são do pooler", () => {
    const raw = "postgresql://u:p@localhost:5432/db";
    expect(normalizeDatabaseUrl(raw)).toBe(raw);
    expect(normalizeDatabaseUrl(undefined)).toBeUndefined();
  });
});
