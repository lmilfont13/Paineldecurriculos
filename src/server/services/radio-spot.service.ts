import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { RadioSpot } from "@/server/models/radio.model";

const execFileAsync = promisify(execFile);

export interface GenerateSpotInput {
  title: string;
  script: string;
  voice?: string;
  sfxPreset?: string;
}

interface VoiceProfile {
  azureVoice: string;
  rate: string;
  pitch: string;
  label: string;
}

/**
 * Resolve o perfil de voz neural para locução de rádio FM ultra-realista e animada.
 * Garante nomes válidos no catálogo Microsoft Edge Neural TTS (evitando fallback robótico).
 */
export function resolveBroadcastVoiceProfile(voiceChoice?: string): VoiceProfile {
  const v = (voiceChoice || "pt-BR-FranciscaNeural").trim();

  if (v.includes("Francisca")) {
    return {
      azureVoice: "pt-BR-FranciscaNeural",
      rate: "+16%",
      pitch: "+3Hz",
      label: "Francisca FM (Comercial & Ultra Animada)",
    };
  }
  if (v.includes("Thalita")) {
    return {
      azureVoice: "pt-BR-ThalitaMultilingualNeural",
      rate: "+14%",
      pitch: "+2Hz",
      label: "Thalita HD (Ultra Realista & Acolhedora)",
    };
  }
  if (v.includes("Fabio") || v.includes("Jovem")) {
    return {
      azureVoice: "pt-BR-AntonioNeural",
      rate: "+18%",
      pitch: "+5Hz",
      label: "Lucas FM (Jovem & Dinâmico)",
    };
  }
  return {
    azureVoice: "pt-BR-AntonioNeural",
    rate: "+15%",
    pitch: "+2Hz",
    label: "Antônio FM (Locutor Impacto & Energia)",
  };
}

/**
 * Sintetizador de Voz Neural Humana de Estúdio (96kbps HD) com prosódia animada de rádio FM.
 */
async function synthesizeNeuralSpeechBuffer(
  script: string,
  profile: VoiceProfile
): Promise<Buffer | null> {
  let ttsInstance: any = null;
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const clean = script
      .replace(/\bTarh?get\b/gi, "Tár-guet")
      .replace(/\s+/g, " ")
      .trim();

    const tts = new MsEdgeTTS();
    ttsInstance = tts;

    await tts.setMetadata(
      profile.azureVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const { audioStream } = tts.toStream(clean, {
      rate: profile.rate,
      pitch: profile.pitch,
      volume: "+15%",
    });

    const chunks: Buffer[] = [];
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
    });

    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  } catch (err: any) {
    console.warn("[radio-spot] Falha no sintetizador neural MsEdgeTTS:", err?.message);
  } finally {
    try {
      ttsInstance?.close?.();
    } catch {
      // Ignora erro ao fechar socket
    }
  }
  return null;
}

/**
 * Quando ffmpeg está disponível no ambiente, masteriza a locução com:
 * - Efeito de transição FM de entrada (sfx-fm-transition-in.mp3)
 * - Trilha musical de fundo com ducking (corte de médios para destacar a voz)
 * - Equalização + Compressão broadcast FM na voz
 * - Efeito de transição FM de saída (sfx-fm-transition-out.mp3)
 */
async function tryMasterWithFfmpeg(
  voiceBuffer: Buffer,
  sfxPreset: string = "raio-trovao"
): Promise<{ buffer: Buffer; durationSeconds: number } | null> {
  const tmpId = `spot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpVoice = path.join(os.tmpdir(), `${tmpId}_vox.mp3`);
  const tmpOut = path.join(os.tmpdir(), `${tmpId}_master.mp3`);

  try {
    await fs.writeFile(tmpVoice, voiceBuffer);

    const sfxIn = path.resolve(process.cwd(), "public/audio/sfx/sfx-fm-transition-in.mp3");
    const sfxOut = path.resolve(process.cwd(), "public/audio/sfx/sfx-fm-transition-out.mp3");
    const bedFile =
      sfxPreset === "acolhimento-suave"
        ? path.resolve(
            process.cwd(),
            "public/audio/music/Tinlicker & Helsloot - Because You Move Me - (256 Kbps).mp3"
          )
        : path.resolve(
            process.cwd(),
            "public/audio/music/Tinlicker - Fractal - (320 Kbps).mp3"
          );

    const { stdout: durStdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      tmpVoice,
    ]);

    const voiceDur = parseFloat(durStdout.trim()) || 5.5;
    const totalDur = +(voiceDur + 1.35).toFixed(2);
    const outroStartMs = Math.round((voiceDur + 0.35) * 1000);
    const fadeOutStart = +(totalDur - 0.55).toFixed(2);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      sfxIn,
      "-ss",
      "48",
      "-t",
      String(totalDur),
      "-i",
      bedFile,
      "-i",
      tmpVoice,
      "-i",
      sfxOut,
      "-filter_complex",
      `[0:a]volume=0.95[intro];` +
        `[1:a]afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.55,equalizer=f=1200:width_type=h:width=1600:g=-4,volume=0.22[bed];` +
        `[2:a]highpass=f=75,equalizer=f=110:width_type=h:width=90:g=3.5,equalizer=f=3500:width_type=h:width=1500:g=3,equalizer=f=9500:width_type=h:width=2000:g=4,acompressor=threshold=-16dB:ratio=4:attack=5:release=50:makeup=5dB,aecho=0.8:0.75:18:0.12,adelay=420|420,volume=1.55[vox];` +
        `[3:a]adelay=${outroStartMs}|${outroStartMs},volume=0.90[outro];` +
        `[intro][bed][vox][outro]amix=inputs=4:duration=longest:normalize=0,alimiter=limit=0.95`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "128k",
      tmpOut,
    ]);

    const mastered = await fs.readFile(tmpOut);
    return {
      buffer: mastered,
      durationSeconds: Math.max(3, Math.round(totalDur)),
    };
  } catch {
    return null;
  } finally {
    await fs.unlink(tmpVoice).catch(() => {});
    await fs.unlink(tmpOut).catch(() => {});
  }
}

export async function generateRadioSpotService(
  input: GenerateSpotInput
): Promise<{ ok: boolean; spot?: RadioSpot; error?: string }> {
  const title = input.title.trim().slice(0, 100) || "Vinheta Rádio FM";
  const script = input.script.trim().slice(0, 1000);
  const sfxPreset = input.sfxPreset?.trim() || "raio-trovao";

  if (!script) {
    return { ok: false, error: "O texto da vinheta não pode estar em branco." };
  }

  const profile = resolveBroadcastVoiceProfile(input.voice);

  // 1. Sintetiza voz neural humana com prosódia animada de rádio FM
  const voiceBuffer = await synthesizeNeuralSpeechBuffer(script, profile);

  if (!voiceBuffer) {
    return {
      ok: false,
      error: "Não foi possível sintetizar a locução neural no momento. Tente novamente.",
    };
  }

  // 2. Tenta masterizar com efeitos de transição FM + trilha via ffmpeg (se disponível)
  const mastered = await tryMasterWithFfmpeg(voiceBuffer, sfxPreset);
  const finalBuffer = mastered ? mastered.buffer : voiceBuffer;
  const hasEmbeddedSfx = Boolean(mastered);

  const spotId = `custom-spot-${Date.now()}`;
  let finalAudioUrl = `data:audio/mpeg;base64,${finalBuffer.toString("base64")}`;

  // Se o ambiente local permitir gravação em public/audio/spots, salva arquivo estático também
  try {
    const fileName = `${spotId}.mp3`;
    const filePath = path.resolve(process.cwd(), "public/audio/spots", fileName);
    await fs.writeFile(filePath, finalBuffer);
    // Mantemos data URI se for <= 350KB para funcionar tanto em serverless quanto local sem 404
    if (finalBuffer.length > 350_000) {
      finalAudioUrl = `/audio/spots/${fileName}`;
    }
  } catch {
    // Em produção serverless (Vercel), usa data:audio/mpeg;base64 diretamente
  }

  const durationSeconds = mastered
    ? mastered.durationSeconds
    : Math.max(4, Math.round(script.split(/\s+/).length * 0.38) + 2);

  const spot: RadioSpot = {
    id: spotId,
    title,
    subtitle: `Transição FM · ${profile.label}`,
    audioUrl: finalAudioUrl,
    durationSeconds,
    enabled: true,
    isCustom: true,
    sfxPreset,
    hasEmbeddedSfx,
  };

  return { ok: true, spot };
}
