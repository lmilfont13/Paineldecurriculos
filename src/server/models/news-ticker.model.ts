/**
 * Modelo e curadoria de notícias do Brasil, Mundo, Economia e Varejo
 * para o letreiro digital (News Ticker) estilo Bloomberg da Rádio Tárguet e Portal do Candidato.
 */

export type NewsTickerCategory =
  | "BRASIL"
  | "MUNDO"
  | "ECONOMIA"
  | "MERCADO"
  | "VAREJO"
  | "EMPREGOS"
  | "TECNOLOGIA";

export interface NewsTickerItem {
  id: string;
  category: NewsTickerCategory;
  title: string;
  source: string;
  timeAgo: string;
  url?: string;
}

/** Notícias dinâmicas de alta relevância com foco em Brasil, Mundo, Varejo e Economia */
export const DEFAULT_RETAIL_NEWS: NewsTickerItem[] = [
  {
    id: "news-brasil-1",
    category: "BRASIL",
    title: "Governo e Congresso alinham pauta econômica prioritária para votação de medidas fiscais",
    source: "Agência Brasil",
    timeAgo: "há 15 min",
  },
  {
    id: "news-world-1",
    category: "MUNDO",
    title: "Geopolítica global: negociações comerciais e diplomáticas mobilizam cúpulas internacionais",
    source: "BBC Brasil",
    timeAgo: "há 20 min",
  },
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
    id: "news-tech-1",
    category: "TECNOLOGIA",
    title: "Avanço em Inteligência Artificial impulsiona investimentos recordes em infraestrutura e semicondutores",
    source: "InfoMoney",
    timeAgo: "há 50 min",
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
    id: "news-world-2",
    category: "MUNDO",
    title: "Mercados globais reagem a indicadores dos EUA, Europa e Ásia com foco em política monetária",
    source: "G1 Mundo",
    timeAgo: "há 2h",
  },
];

let cachedNews: { items: NewsTickerItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutos de cache para notícias sempre frescas

const LIVE_NEWS_SOURCES: {
  name: string;
  url: string;
  defaultCategory: NewsTickerCategory;
}[] = [
  { name: "G1", url: "https://g1.globo.com/rss/g1/", defaultCategory: "BRASIL" },
  { name: "G1 Mundo", url: "https://g1.globo.com/rss/g1/mundo/", defaultCategory: "MUNDO" },
  { name: "G1 Economia", url: "https://g1.globo.com/rss/g1/economia/", defaultCategory: "ECONOMIA" },
  { name: "BBC Brasil", url: "https://feeds.bbci.co.uk/portuguese/rss.xml", defaultCategory: "MUNDO" },
  { name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", defaultCategory: "BRASIL" },
  { name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml", defaultCategory: "MUNDO" },
  { name: "Poder360", url: "https://www.poder360.com.br/feed/", defaultCategory: "BRASIL" },
  { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/", defaultCategory: "MERCADO" },
  { name: "CNN Brasil", url: "https://www.cnnbrasil.com.br/feed/", defaultCategory: "BRASIL" },
];

function cleanXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/<[^>]+>/g, "")
    .replace(/^(VÍDEOS?|FOTOS?|AO VIVO|EXCLUSIVO|ENTREVISTA|ANÁLISE|PODCAST)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(title: string, defaultCategory: NewsTickerCategory): NewsTickerCategory {
  const t = title.toLowerCase();
  if (/intelig[eê]ncia artificial|\bia\b|nvidia|google|apple|microsoft|openai|chatgpt|software|ciber|tecnologia/i.test(t)) {
    return "TECNOLOGIA";
  }
  if (/emprego|vaga|contrata|caged|trabalh|clt|sal[aá]ri|desempreg|renda|carreira|concurso/i.test(t)) {
    return "EMPREGOS";
  }
  if (/varejo|supermerc|atacarej|atacado|loja|com[eé]rcio|compra|consum|alimento|bebida|sacola|shopping|pdv/i.test(t)) {
    return "VAREJO";
  }
  if (/infla[cç]|pib|juros|selic|d[oó]lar|c[aâ]mbio|banco central|copom|impost|tribut|arrecada|fiscal|d[ií]vida/i.test(t)) {
    return "ECONOMIA";
  }
  if (/eua|trump|biden|china|europa|r[uú]ssia|ucr[aâ]nia|israel|oriente m[eé]dio|argentina|milei|venezuela|otan|onu|papa|it[aá]lia|frança|mundo|internacional/i.test(t)) {
    return "MUNDO";
  }
  if (/brasil|lula|congresso|senado|c[aâ]mara|stf|judici[aá]rio|minist[eé]rio|governo|pol[ií]cia federal|\bpf\b|enem|mec/i.test(t)) {
    return "BRASIL";
  }
  return defaultCategory;
}

async function fetchSourceFeed(source: (typeof LIVE_NEWS_SOURCES)[number]): Promise<NewsTickerItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);

    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      next: { revalidate: 240 },
    }).catch(() => null);

    clearTimeout(timeout);
    if (!res || !res.ok) return [];

    const xml = await res.text();
    const itemRegex =
      /<item>[\s\S]*?<title>([\s\S]*?)<\/title>(?:[\s\S]*?<link>([\s\S]*?)<\/link>)?[\s\S]*?<\/item>/gi;

    const items: NewsTickerItem[] = [];
    let m;
    let idx = 1;

    while ((m = itemRegex.exec(xml)) !== null && items.length < 5) {
      const rawTitle = m[1] ?? "";
      const rawLink = m[2] ?? "";
      const title = cleanXmlText(rawTitle);
      const url = rawLink ? cleanXmlText(rawLink) : undefined;

      // Desconsidera chamadas genéricas, muito curtas ou transmissões ao vivo vazias
      if (title.length > 25 && !title.toLowerCase().startsWith("ao vivo:")) {
        items.push({
          id: `${source.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}-${idx++}`,
          category: detectCategory(title, source.defaultCategory),
          title,
          source: source.name,
          timeAgo: "ao vivo",
          url: url && (url.startsWith("http://") || url.startsWith("https://")) ? url : undefined,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

/**
 * Busca notícias recentes de múltiplos feeds públicos de prestígio sobre
 * Brasil, Mundo, Economia, Varejo, Empregos e Tecnologia.
 * Se houver erro de rede, utiliza o catálogo curado dinâmico como fallback.
 */
export async function getRetailAndMarketNews(): Promise<NewsTickerItem[]> {
  const now = Date.now();
  if (cachedNews && now - cachedNews.timestamp < CACHE_TTL_MS) {
    return cachedNews.items;
  }

  try {
    const settled = await Promise.allSettled(LIVE_NEWS_SOURCES.map(fetchSourceFeed));
    const collected: NewsTickerItem[] = [];
    const seenTitles = new Set<string>();

    for (const res of settled) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        for (const item of res.value) {
          const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!seenTitles.has(norm)) {
            seenTitles.add(norm);
            collected.push(item);
          }
        }
      }
    }

    if (collected.length >= 6) {
      // Agrupa por categoria para intercalar harmoniosamente
      const byCategory = new Map<NewsTickerCategory, NewsTickerItem[]>();
      for (const item of collected) {
        const list = byCategory.get(item.category) ?? [];
        list.push(item);
        byCategory.set(item.category, list);
      }

      const priorityOrder: NewsTickerCategory[] = [
        "BRASIL",
        "MUNDO",
        "ECONOMIA",
        "VAREJO",
        "MERCADO",
        "TECNOLOGIA",
        "EMPREGOS",
      ];

      const interleaved: NewsTickerItem[] = [];
      let addedInRound = true;

      while (addedInRound && interleaved.length < 35) {
        addedInRound = false;
        for (const cat of priorityOrder) {
          const catList = byCategory.get(cat);
          if (catList && catList.length > 0) {
            interleaved.push(catList.shift()!);
            addedInRound = true;
          }
        }
      }

      // Adiciona algumas notícias pontuais de varejo se houver poucas no feed
      const hasRetail = interleaved.some((n) => n.category === "VAREJO");
      if (!hasRetail) {
        interleaved.splice(3, 0, DEFAULT_RETAIL_NEWS[2]);
        interleaved.splice(8, 0, DEFAULT_RETAIL_NEWS[0]);
      }

      cachedNews = { items: interleaved, timestamp: now };
      return interleaved;
    }
  } catch (err) {
    console.warn("[news-ticker] Erro ao consolidar feeds ao vivo:", err);
  }

  cachedNews = { items: DEFAULT_RETAIL_NEWS, timestamp: now };
  return DEFAULT_RETAIL_NEWS;
}
