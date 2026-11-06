export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  url: string;
}

export interface RadioSpot {
  id: string;
  title: string;
  subtitle: string;
  audioUrl: string;
}

export const TARGET_RADIO_SPOTS: RadioSpot[] = [
  {
    id: "spot-1-boas-vindas",
    title: "Target Conecta",
    subtitle: "Boas-vindas & Inspiração",
    audioUrl: "/audio/spots/target-spot-1.mp3",
  },
  {
    id: "spot-2-dica-curriculo",
    title: "Dica Target",
    subtitle: "Destaque seu perfil na triagem",
    audioUrl: "/audio/spots/target-spot-2.mp3",
  },
  {
    id: "spot-3-banco-talentos",
    title: "Banco de Talentos",
    subtitle: "Cadastre-se para futuras vagas",
    audioUrl: "/audio/spots/target-spot-3.mp3",
  },
];

export const CURATED_STATIONS: RadioStation[] = [
  {
    id: "hunter-lofi",
    name: "Hunter.FM — Lo-Fi",
    genre: "Foco & Lo-Fi",
    url: "https://live.hunter.fm/lofi_high",
  },
  {
    id: "somafm-groovesalad",
    name: "SomaFM — Groove Salad",
    genre: "Ambient / Chill",
    url: "https://ice2.somafm.com/groovesalad-128-mp3",
  },
  {
    id: "somafm-bossa",
    name: "SomaFM — Bossa Beyond",
    genre: "Bossa Nova & Jazz",
    url: "https://ice2.somafm.com/bossa-128-mp3",
  },
  {
    id: "somafm-deepspace",
    name: "SomaFM — Deep Space One",
    genre: "Foco Profundo",
    url: "https://ice2.somafm.com/deepspaceone-128-mp3",
  },
  {
    id: "hunter-pop",
    name: "Hunter.FM — Pop2K",
    genre: "Pop Hits",
    url: "https://live.hunter.fm/pop2k_high",
  },
];
