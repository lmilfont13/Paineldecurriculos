import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/birthday-card", () => {
  it("renders a valid PNG buffer for corporate card", async () => {
    const req = new NextRequest("http://localhost:3000/api/birthday-card?name=Maria+Julia+de+Maria+Araujo&company=Trade&theme=navy");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("renders all 4 corporate themes without Satori or font errors", async () => {
    const themes = ["navy", "graphite", "emerald", "clean"];
    for (const theme of themes) {
      const req = new NextRequest(`http://localhost:3000/api/birthday-card?name=Maria+Julia&theme=${theme}&showAge=true&age=30`);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const buf = await res.arrayBuffer();
      expect(buf.byteLength).toBeGreaterThan(1000);
    }
  });

  it("renders cleanly even when message contains WhatsApp text with linebreaks, asterisks and emojis", async () => {
    const msg = "Olá, Maria! 🎉🎂\n\nA equipe da *Trade* passa para desejar a você um *Feliz Aniversário*! ✨🎈";
    const req = new NextRequest(`http://localhost:3000/api/birthday-card?name=Maria+Julia&message=${encodeURIComponent(msg)}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
