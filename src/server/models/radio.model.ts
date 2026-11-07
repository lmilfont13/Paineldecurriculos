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
  durationSeconds?: number;
  enabled?: boolean;
  isCustom?: boolean;
  sfxPreset?: string;
  hasEmbeddedSfx?: boolean;
}

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}

export const DEFAULT_MUSIC_CATALOG: RadioTrack[] = [
  {
    id: "rufus-du-sol-innerbloom",
    title: "Innerbloom (CYRIL Remix)",
    artist: "RÜFÜS DU SOL",
    audioUrl: "/audio/music/RÜFÜS DU SOL - Innerbloom (CYRIL Remix) - (320 Kbps).mp3",
  },
  {
    id: "tinlicker-fractal",
    title: "Fractal",
    artist: "Tinlicker",
    audioUrl: "/audio/music/Tinlicker - Fractal - (320 Kbps).mp3",
  },
  {
    id: "tiesto-in-my-memory",
    title: "In My Memory (Miss Cyanna Deep Remix)",
    artist: "Tiësto",
    audioUrl: "/audio/music/Tiesto - In My Memory (Miss Cyanna Deep Remix) _ Trance Anthem - (320 Kbps).mp3",
  },
  {
    id: "tinlicker-diamonds",
    title: "Diamonds (Further Than I Ever Was)",
    artist: "Tinlicker & The Boxer Rebellion",
    audioUrl: "/audio/music/Tinlicker & The Boxer Rebellion - Diamonds (Further Than I Ever Was) - (192 Kbps).mp3",
  },
  {
    id: "tinlicker-because-you-move-me",
    title: "Because You Move Me",
    artist: "Tinlicker & Helsloot",
    audioUrl: "/audio/music/Tinlicker & Helsloot - Because You Move Me - (256 Kbps).mp3",
  },
  {
    id: "tinlicker-you-take-my-hand",
    title: "You Take My Hand (feat. Jamie Irrepressible)",
    artist: "Tinlicker",
    audioUrl: "/audio/music/Tinlicker - You Take My Hand (Feat. Jamie Irrepressible) [Official Video] - (320 Kbps).mp3",
  },
  {
    id: "silverr7-world-hold-on",
    title: "World Hold On",
    artist: "silverr7",
    audioUrl: "/audio/music/silverr7 - World Hold On - (320 Kbps) (2).mp3",
  },
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

export const TARGET_PLAYLIST_TRACKS: RadioTrack[] = DEFAULT_MUSIC_CATALOG;

export const TARGET_RADIO_SPOTS: RadioSpot[] = [
  {
    id: "spot-raio-1",
    title: "Rádio Tarhget FM — Abertura Oficial",
    subtitle: "Transição FM · Voz Francisca HD Animada + Trilha",
    audioUrl: "/audio/spots/target-spot-raio-1.mp3?v=3",
    durationSeconds: 10,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-raio-2",
    title: "Tarhget no Ar — Sintonia de Talentos",
    subtitle: "Transição FM · Voz Antônio FM Dinâmica + Trilha",
    audioUrl: "/audio/spots/target-spot-raio-2.mp3?v=3",
    durationSeconds: 9,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-bem-vindo-1",
    title: "Boas-Vindas ao Portal de Carreiras",
    subtitle: "Transição FM · Voz Thalita Ultra Realista + Trilha",
    audioUrl: "/audio/spots/target-spot-bem-vindo-1.mp3?v=3",
    durationSeconds: 10,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-bem-vindo-2",
    title: "Energia & Sucesso na Jornada",
    subtitle: "Transição FM · Voz Francisca HD Animada + Trilha",
    audioUrl: "/audio/spots/target-spot-bem-vindo-2.mp3?v=3",
    durationSeconds: 10,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-dica",
    title: "Dica Rápida dos Recrutadores",
    subtitle: "Transição FM · Voz Thalita Ultra Realista + Trilha",
    audioUrl: "/audio/spots/target-spot-dica.mp3?v=3",
    durationSeconds: 11,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-conecta",
    title: "Tarhget Conecta — Grandes Empresas",
    subtitle: "Transição FM · Voz Antônio FM Dinâmica + Trilha",
    audioUrl: "/audio/spots/target-spot-conecta.mp3?v=3",
    durationSeconds: 9,
    hasEmbeddedSfx: true,
  },
  {
    id: "spot-talentos",
    title: "Chamada Banco de Talentos",
    subtitle: "Transição FM · Voz Francisca HD Animada + Trilha",
    audioUrl: "/audio/spots/target-spot-talentos.mp3?v=3",
    durationSeconds: 9,
    hasEmbeddedSfx: true,
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
