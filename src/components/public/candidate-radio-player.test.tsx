import { describe, expect, it } from "vitest";

import { CURATED_STATIONS, TARGET_RADIO_SPOTS } from "@/server/models/radio.model";

describe("Candidate Radio Config", () => {
  it("possui estação padrão válida caso o gestor não tenha definido uma específica", () => {
    expect(CURATED_STATIONS.length).toBeGreaterThan(0);
    expect(CURATED_STATIONS[0].url).toContain("https://");
    expect(CURATED_STATIONS[0].name).toBeTruthy();
  });

  it("possui spots de áudio da Target configurados com caminhos válidos", () => {
    expect(TARGET_RADIO_SPOTS.length).toBeGreaterThanOrEqual(3);
    for (const spot of TARGET_RADIO_SPOTS) {
      expect(spot.id).toBeTruthy();
      expect(spot.title).toBeTruthy();
      expect(spot.audioUrl).toMatch(/^\/audio\/spots\/.+\.mp3$/);
    }
  });
});
