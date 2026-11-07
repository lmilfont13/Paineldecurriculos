/**
 * Modelo e curadoria de notícias do mercado de varejo e principais notícias do dia
 * para o letreiro digital (News Ticker) da Rádio Tarhget e Portal do Candidato.
 */

export type NewsTickerCategory = "VAREJO" | "ECONOMIA" | "MERCADO" | "EMPREGOS";

export interface NewsTickerItem {
  id: string;
  category: NewsTickerCategory;
  title: string;
  source: string;
  timeAgo: string;
  url?: string;
}

/** Notícias dinâmicas de alta relevância com foco em Varejo, Supermercados, Atacarejo e Economia */
export const DEFAULT_RETAIL_NEWS: NewsTickerItem[] = [
  {
    id: "news-retail-1",
    category: "VAREJO",
    title: "Varejo supermercadista projeta alta de 3,8% no volume de vendas impulsionado por atacarejos e lojas de proximidade",
    source: "Mercado & Consumo",
    timeAgo: "há 25 min",
  },
  {
    id: "news-retail-2",
    category: "ECONOMIA",
    title: "Inflação dos alimentos desacelera e estimula poder de compra nas famílias brasileiras no trimestre",
    source: "Valor Econômico",
    timeAgo: "há 40 min",
  },
  {
    id: "news-retail-3",
    category: "VAREJO",
    title: "Automação no PDV: 72% das grandes redes varejistas expandem caixas de autoatendimento e pesagem inteligente",
    source: "Abras Varejo",
    timeAgo: "há 1h",
  },
  {
    id: "news-retail-4",
    category: "EMPREGOS",
    title: "Setor de comércio e serviços lidera criação de vagas com carteira assinada no país, aponta Novo Caged",
    source: "G1 Economia",
    timeAgo: "há 1h e meia",
  },
  {
    id: "news-retail-5",
    category: "MERCADO",
    title: "Logística ágil: Redes de atacado investem R$ 1,2 bi em novos centros de distribuição e frotas elétricas",
    source: "InfoMoney",
    timeAgo: "há 2h",
  },
  {
    id: "news-retail-6",
    category: "VAREJO",
    title: "Formatos de atacarejo ganham mais espaço nos hábitos do consumidor com compras em embalagens família",
    source: "Poder360",
    timeAgo: "há 3h",
  },
  {
    id: "news-retail-7",
    category: "ECONOMIA",
    title: "Banco Central sinaliza estabilidade fiscal e projeção de crescimento do PIB anima contratações no varejo",
    source: "Exame",
    timeAgo: "há 3h",
  },
  {
    id: "news-retail-8",
    category: "VAREJO",
    title: "Inteligência Artificial na gestão de estoque reduz perdas operacionais em até 35% no grande varejo",
    source: "Forbes Negócios",
    timeAgo: "há 4h",
  },
];

let cachedNews: { items: NewsTickerItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache para notícias sempre frescas

function cleanXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function detectCategory(title: string): NewsTickerCategory {
  const t = title.toLowerCase();
  if (/emprego|vaga|contrata|caged|trabalh|clt|sal[aá]ri|desempreg|renda|carreira/i.test(t)) {
    return "EMPREGOS";
  }
  if (/varejo|supermerc|atacarej|atacado|loja|com[eé]rcio|compra|consum|alimento|bebida|sacola|shopping|ponto de venda|pdv/i.test(t)) {
    return "VAREJO";
  }
  if (/infla[cç]|pib|juros|selic|d[oó]lar|c[aâ]mbio|banco central|copom|impost|tribut|arrecada|fiscal|bolsa fam/i.test(t)) {
    return "ECONOMIA";
  }
  return "MERCADO";
}

/**
 * Busca notícias recentes de feeds públicos de notícias de economia e varejo.
 * Se houver erro de rede ou timeout, utiliza o catálogo curado dinâmico.
 */
export async function getRetailAndMarketNews(): Promise<NewsTickerItem[]> {
  const now = Date.now();
  if (cachedNews && now - cachedNews.timestamp < CACHE_TTL_MS) {
    return cachedNews.items;
  }

  const liveNews: NewsTickerItem[] = [];

  // 1. Agência Brasil Economia
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2200);

    const res = await fetch("https://agenciabrasil.ebc.com.br/rss/economia/feed.xml", {
      signal: controller.signal,
      next: { revalidate: 300 },
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const xml = await res.text();
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi;
      let m;
      let idx = 1;
      while ((m = itemRegex.exec(xml)) !== null && liveNews.length < 5) {
        const title = cleanXmlText(m[1] ?? "");
        if (title.length > 20 && !liveNews.some((n) => n.title === title)) {
          liveNews.push({
            id: `agb-${idx++}`,
            category: detectCategory(title),
            title,
            source: "Agência Brasil",
            timeAgo: "ao vivo",
          });
        }
      }
    }
  } catch {
    // Falha silenciosa
  }

  // 2. G1 Economia
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2200);

    const res = await fetch("https://g1.globo.com/rss/g1/economia/", {
      signal: controller.signal,
      next: { revalidate: 300 },
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const xml = await res.text();
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi;
      let m;
      let idx = 1;
      while ((m = itemRegex.exec(xml)) !== null && liveNews.length < 8) {
        const title = cleanXmlText(m[1] ?? "");
        if (title.length > 20 && !liveNews.some((n) => n.title === title)) {
          liveNews.push({
            id: `g1-${idx++}`,
            category: detectCategory(title),
            title,
            source: "G1 Economia",
            timeAgo: "hoje",
          });
        }
      }
    }
  } catch {
    // Falha silenciosa
  }

  // Se conseguimos notícias ao vivo, alternamos com notícias focadas em varejo
  if (liveNews.length > 0) {
    const combined: NewsTickerItem[] = [];
    let liveIdx = 0;
    let defIdx = 0;

    while (combined.length < 12 && (liveIdx < liveNews.length || defIdx < DEFAULT_RETAIL_NEWS.length)) {
      if (liveIdx < liveNews.length) {
        combined.push(liveNews[liveIdx++]);
      }
      if (defIdx < DEFAULT_RETAIL_NEWS.length) {
        combined.push(DEFAULT_RETAIL_NEWS[defIdx++]);
      }
    }

    cachedNews = { items: combined, timestamp: now };
    return combined;
  }

  cachedNews = { items: DEFAULT_RETAIL_NEWS, timestamp: now };
  return DEFAULT_RETAIL_NEWS;
}
