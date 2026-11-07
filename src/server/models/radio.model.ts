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

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}

export const TARGET_PLAYLIST_TRACKS: RadioTrack[] = [
  {
    id: "track-1",
    title: "Days Like These",
    artist: "Tarhget Chill Beats",
    audioUrl: "/audio/music/target-track-1.mp3",
  },
  {
    id: "track-2",
    title: "At My Front Door",
    artist: "DJ Quads · Focus Lo-Fi",
    audioUrl: "/audio/music/target-track-2.mp3",
  },
  {
    id: "track-3",
    title: "Summer Sunset",
    artist: "Tarhget Acoustic Vibe",
    audioUrl: "/audio/music/target-track-3.mp3",
  },
];

export const TARGET_RADIO_SPOTS: RadioSpot[] = [
  {
    id: "spot-1-boas-vindas",
    title: "Tarhget Conecta",
    subtitle: "Boas-vindas & Inspiração",
    audioUrl: "/audio/spots/target-spot-1.mp3",
  },
  {
    id: "spot-2-dica-curriculo",
    title: "Dica Tarhget",
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
    id: "target-exclusive",
    name: "Rádio Tarhget",
    genre: "Músicas Selecionadas + Spots IA",
    url: "playlist:target",
  },
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
