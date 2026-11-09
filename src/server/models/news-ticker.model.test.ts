import { describe, expect, it } from "vitest";
import { getRetailAndMarketNews, DEFAULT_RETAIL_NEWS } from "@/server/models/news-ticker.model";

describe("news-ticker.model", () => {
  it("possui catálogo padrão de notícias de varejo e economia formatado", () => {
    expect(DEFAULT_RETAIL_NEWS.length).toBeGreaterThanOrEqual(4);
    for (const item of DEFAULT_RETAIL_NEWS) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.category).toMatch(/^(VAREJO|ECONOMIA|MERCADO|EMPREGOS|BRASIL|MUNDO|TECNOLOGIA)$/);
      expect(item.source).toBeTruthy();
    }
  });

  it("getRetailAndMarketNews retorna notícias válidas", async () => {
    const news = await getRetailAndMarketNews();
    expect(news.length).toBeGreaterThanOrEqual(4);
    expect(news[0].title).toBeTruthy();
  });
});

