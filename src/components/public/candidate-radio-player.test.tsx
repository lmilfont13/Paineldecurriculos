import { describe, expect, it } from "vitest";

import { CURATED_STATIONS } from "@/server/models/radio.model";

describe("Candidate Radio Config", () => {
  it("possui estação padrão válida caso o gestor não tenha definido uma específica", () => {
    expect(CURATED_STATIONS.length).toBeGreaterThan(0);
    expect(CURATED_STATIONS[0].url).toContain("https://");
    expect(CURATED_STATIONS[0].name).toBeTruthy();
  });
});
