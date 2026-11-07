import "server-only";

import {
  DEFAULT_MUSIC_CATALOG,
  TARGET_RADIO_SPOTS,
  type RadioSpot,
  type RadioTrack,
} from "@/server/models/radio.model";
import {
  fillTemplate,
  subjectKey,
  toTemplate,
  type TemplateContext,
} from "@/server/models/message-templates.model";
import {
  findRadioPlaylistRaw,
  findRadioSpotIntervalRaw,
  findRadioSpotsRaw,
  findRadioStationRaw,
  findTemplate,
  findTemplatesByCompany,
  saveRadioPlaylistRaw,
  saveRadioSpotIntervalRaw,
  saveRadioSpotsRaw,
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

/** Lê o catálogo de músicas disponíveis da Rádio Tarhget. */
export async function getMusicCatalog(): Promise<RadioTrack[]> {
  return DEFAULT_MUSIC_CATALOG;
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

/** Lê o intervalo de spots/vinhetas da rádio configurado (em minutos; 0 = manual apenas). Padrão: 0 min (manual). */
export async function getActiveRadioSpotInterval(
  companyId?: string | null
): Promise<number> {
  try {
    const raw = await findRadioSpotIntervalRaw(companyId);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 120) {
      return parsed;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Salva o intervalo de spots/vinhetas da rádio configurado pelo gestor. */
export async function setActiveRadioSpotInterval(
  companyId: string | null,
  minutes: number
): Promise<{ ok: boolean }> {
  const safeMinutes = Math.max(0, Math.min(120, Math.round(minutes)));
  await saveRadioSpotIntervalRaw(companyId, String(safeMinutes));
  return { ok: true };
}

/** Lê os spots/vinhetas da rádio configurados para a empresa (incluindo ativos, desativados, criados ou lista vazia se o gestor apagou todos). */
export async function getActiveRadioSpots(
  companyId?: string | null
): Promise<RadioSpot[]> {
  try {
    const raw = await findRadioSpotsRaw(companyId);
    if (raw === null || raw === undefined) return TARGET_RADIO_SPOTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const defaultById = new Map(TARGET_RADIO_SPOTS.map((d) => [d.id, d]));
      return parsed
        .map((s: any) => {
          const id = String(s.id || "").slice(0, 100);
          const def = defaultById.get(id);
          const rawUrl = String(s.audioUrl || "").slice(0, 500_000);
          return {
            id,
            title: def && !s.isCustom ? def.title : String(s.title || "Vinheta").slice(0, 100),
            subtitle: def && !s.isCustom ? def.subtitle : String(s.subtitle || "").slice(0, 150),
            audioUrl: def && !s.isCustom ? def.audioUrl : rawUrl,
            durationSeconds:
              def && !s.isCustom
                ? def.durationSeconds
                : typeof s.durationSeconds === "number"
                  ? s.durationSeconds
                  : undefined,
            enabled: s.enabled !== false,
            isCustom: Boolean(s.isCustom),
            sfxPreset: s.sfxPreset ? String(s.sfxPreset).slice(0, 60) : undefined,
            hasEmbeddedSfx: def && !s.isCustom ? true : Boolean(s.hasEmbeddedSfx),
          };
        })
        // Remove qualquer vinheta customizada cujo base64 tenha sido truncado no passado (< 600 chars)
        .filter((s) => !s.audioUrl.startsWith("data:audio/") || s.audioUrl.length > 1000);
    }
    return TARGET_RADIO_SPOTS;
  } catch {
    return TARGET_RADIO_SPOTS;
  }
}

/** Salva a lista de spots/vinhetas da rádio selecionada pelo gestor (permite lista vazia quando todas são excluídas). */
export async function setActiveRadioSpots(
  companyId: string | null,
  spots: RadioSpot[]
): Promise<{ ok: boolean }> {
  if (!Array.isArray(spots)) {
    return { ok: false };
  }
  const clean: RadioSpot[] = spots.map((s) => ({
    id: String(s.id).slice(0, 100),
    title: String(s.title || "Vinheta").trim().slice(0, 100),
    subtitle: String(s.subtitle || "").trim().slice(0, 150),
    audioUrl: String(s.audioUrl).trim().slice(0, 500_000),
    durationSeconds:
      typeof s.durationSeconds === "number"
        ? Math.max(1, Math.min(120, s.durationSeconds))
        : undefined,
    enabled: s.enabled !== false,
    isCustom: Boolean(s.isCustom),
    sfxPreset: s.sfxPreset ? String(s.sfxPreset).slice(0, 60) : undefined,
    hasEmbeddedSfx: Boolean(s.hasEmbeddedSfx),
  }));
  await saveRadioSpotsRaw(companyId, JSON.stringify(clean));
  return { ok: true };
}
