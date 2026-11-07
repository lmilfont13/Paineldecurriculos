import "server-only";

import fs from "fs";
import path from "path";

import { DEFAULT_MUSIC_CATALOG, type RadioTrack } from "@/server/models/radio.model";
import {
  fillTemplate,
  subjectKey,
  toTemplate,
  type TemplateContext,
} from "@/server/models/message-templates.model";
import {
  findRadioPlaylistRaw,
  findRadioStationRaw,
  findTemplate,
  findTemplatesByCompany,
  saveRadioPlaylistRaw,
  saveRadioStationRaw,
  saveTemplate,
} from "@/server/repositories/message-template.repository";

export const MAX_SUBJECT_LENGTH = 80;
const MAX_BODY_LENGTH = 2000;

export interface RadioStationConfig {
  id: string;
  name: string;
  genre: string;
  url: string;
}

export function listMessageTemplates(companyId: string) {
  return findTemplatesByCompany(companyId);
}

/** Grava o recado enviado como modelo do assunto (nome/empresa/vaga viram marcadores). */
export async function rememberMessageTemplate(
  companyId: string,
  subject: string,
  text: string,
  ctx: TemplateContext
): Promise<void> {
  const cleanSubject = subject.trim().slice(0, MAX_SUBJECT_LENGTH).trim();
  const body = toTemplate(text.trim(), ctx).slice(0, MAX_BODY_LENGTH);
  if (!cleanSubject || !text.trim()) return;
  await saveTemplate(companyId, cleanSubject, subjectKey(cleanSubject), body);
}

/** Modelo salvo para o assunto, já preenchido para este candidato (null se não houver). */
export async function savedMessageForSubject(
  companyId: string,
  subject: string,
  ctx: TemplateContext
): Promise<string | null> {
  const key = subjectKey(subject.slice(0, MAX_SUBJECT_LENGTH));
  if (!key) return null;
  const saved = await findTemplate(companyId, key);
  return saved ? fillTemplate(saved.body, ctx) : null;
}

/** Guarda um modelo escrito pelo gestor, que já traz os marcadores {nome}, {vaga} e {empresa}. */
export async function saveMessageTemplate(
  companyId: string,
  subject: string,
  body: string
): Promise<void> {
  const cleanSubject = subject.trim().slice(0, MAX_SUBJECT_LENGTH).trim();
  const text = body.trim().slice(0, MAX_BODY_LENGTH);
  if (!cleanSubject || !text) return;
  await saveTemplate(companyId, cleanSubject, subjectKey(cleanSubject), text);
}

function isValidRadioUrl(url?: string): boolean {
  if (!url) return false;
  return url === "playlist:target" || url.startsWith("https://") || url.startsWith("/");
}

/** Lê a estação de rádio definida pelo admin (retorna null para usar a padrão). */
export async function getActiveRadioStation(
  companyId?: string | null
): Promise<RadioStationConfig | null> {
  try {
    const raw = await findRadioStationRaw(companyId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RadioStationConfig;
    if (isValidRadioUrl(parsed?.url) && parsed?.name) {
      return {
        id: String(parsed.id || parsed.url),
        name: String(parsed.name).slice(0, 80),
        genre: String(parsed.genre || "Rádio Online").slice(0, 40),
        url: String(parsed.url),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Salva a estação de rádio escolhida pelo admin. */
export async function setActiveRadioStation(
  companyId: string | null,
  station: RadioStationConfig
): Promise<{ ok: boolean }> {
  if (!isValidRadioUrl(station?.url) || !station?.name?.trim()) {
    return { ok: false };
  }
  const clean: RadioStationConfig = {
    id: String(station.id || station.url).slice(0, 120),
    name: station.name.trim().slice(0, 80),
    genre: (station.genre || "Rádio Online").trim().slice(0, 40),
    url: station.url.trim().slice(0, 500),
  };
  await saveRadioStationRaw(companyId, JSON.stringify(clean));
  return { ok: true };
}

/** Lê as músicas disponíveis no diretório public/audio/music combinadas com o catálogo padrão. */
export async function getMusicCatalog(): Promise<RadioTrack[]> {
  try {
    const musicDir = path.join(process.cwd(), "public", "audio", "music");
    if (!fs.existsSync(musicDir)) return DEFAULT_MUSIC_CATALOG;
    const files = fs
      .readdirSync(musicDir)
      .filter((f) => f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".wav"));

    const scanned: RadioTrack[] = files.map((file) => {
      const cleanName = file.replace(/\.[^/.]+$/, "").replace(/\s*-\s*\(\d+\s*Kbps\)/i, "");
      const parts = cleanName.split(/\s*-\s*/);
      let artist = "Tarhget Music";
      let title = cleanName;
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }
      return {
        id: "local-" + Buffer.from(file).toString("hex").slice(0, 16),
        title,
        artist,
        audioUrl: `/audio/music/${file}`,
      };
    });

    const map = new Map<string, RadioTrack>();
    for (const t of DEFAULT_MUSIC_CATALOG) map.set(t.audioUrl, t);
    for (const t of scanned) map.set(t.audioUrl, t);
    return Array.from(map.values());
  } catch {
    return DEFAULT_MUSIC_CATALOG;
  }
}

/** Lê a playlist da Rádio Tarhget configurada para a empresa ou padrão. */
export async function getActiveRadioPlaylist(
  companyId?: string | null
): Promise<RadioTrack[]> {
  try {
    const raw = await findRadioPlaylistRaw(companyId);
    if (!raw) return DEFAULT_MUSIC_CATALOG;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => ({
        id: String(item.id || item.audioUrl),
        title: String(item.title || "Música").slice(0, 80),
        artist: String(item.artist || "Rádio Tarhget").slice(0, 80),
        audioUrl: String(item.audioUrl),
      }));
    }
    return DEFAULT_MUSIC_CATALOG;
  } catch {
    return DEFAULT_MUSIC_CATALOG;
  }
}

/** Salva a playlist da Rádio Tarhget configurada pelo gestor. */
export async function setActiveRadioPlaylist(
  companyId: string | null,
  tracks: RadioTrack[]
): Promise<{ ok: boolean }> {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { ok: false };
  }
  const clean: RadioTrack[] = tracks.map((t) => ({
    id: String(t.id || t.audioUrl).slice(0, 120),
    title: String(t.title || "Música").trim().slice(0, 80),
    artist: String(t.artist || "Rádio Tarhget").trim().slice(0, 80),
    audioUrl: String(t.audioUrl).trim().slice(0, 500),
  }));
  await saveRadioPlaylistRaw(companyId, JSON.stringify(clean));
  return { ok: true };
}
