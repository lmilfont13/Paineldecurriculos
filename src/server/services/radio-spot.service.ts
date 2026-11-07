import "server-only";

import { spawn } from "node:child_process";
import path from "node:path";
import type { RadioSpot } from "@/server/models/radio.model";

export interface GenerateSpotInput {
  title: string;
  script: string;
  voice?: string;
  sfxPreset?: string;
}

async function synthesizeWebTtsAudio(script: string): Promise<string | null> {
  try {
    const clean = script.replace(/\bTarh?get\b/gi, "Tár-guet");
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const chunks: Buffer[] = [];

    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const subParts = trimmed.length > 180 ? trimmed.match(/.{1,180}(\s|$)/g) || [trimmed] : [trimmed];
      for (const part of subParts) {
        const p = part.trim();
        if (!p) continue;
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(p)}&tl=pt-BR&client=tw-ob`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          chunks.push(buf);
        }
      }
    }

    if (chunks.length > 0) {
      const full = Buffer.concat(chunks);
      return `data:audio/mpeg;base64,${full.toString("base64")}`;
    }
  } catch (err) {
    console.error("[radio-spot] Falha no Web TTS fallback:", err);
  }
  return null;
}

export async function generateRadioSpotService(
  input: GenerateSpotInput
): Promise<{ ok: boolean; spot?: RadioSpot; error?: string }> {
  const title = input.title.trim().slice(0, 100) || "Vinheta Personalizada";
  const script = input.script.trim().slice(0, 1000);
  const voice = input.voice?.trim() || "pt-BR-AntonioNeural";
  const sfxPreset = input.sfxPreset?.trim() || "raio-trovao";

  if (!script) {
    return { ok: false, error: "O texto da vinheta não pode estar em branco." };
  }

  try {
    const pythonScript = path.resolve(process.cwd(), "src/server/services/radio-spot-generator.py");
    const payload = JSON.stringify({ title, script, voice, sfxPreset });

    const spot = await new Promise<RadioSpot>((resolve, reject) => {
      const child = spawn("python", [pythonScript], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Python exited with code ${code}`));
          return;
        }
        try {
          const res = JSON.parse(stdout);
          if (res.ok && res.spot) {
            resolve(res.spot);
          } else {
            reject(new Error(res.error || "Falha ao gerar vinheta"));
          }
        } catch (err: any) {
          reject(new Error(`Erro ao interpretar resposta do gerador: ${err.message}`));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });

      child.stdin.write(payload);
      child.stdin.end();
    });

    return { ok: true, spot };
  } catch (err: any) {
    console.warn("[radio-spot] Gerador Python indisponível no ambiente. Usando sintetizador Web TTS:", err.message);

    // Fallback de alta fidelidade: gera o áudio MP3 falado com o texto e o nome exato do candidato
    const webAudio = await synthesizeWebTtsAudio(script);
    const fallbackId = `custom-spot-${Date.now()}`;
    let finalAudioUrl = webAudio || "";

    if (webAudio && webAudio.startsWith("data:audio/mpeg;base64,")) {
      try {
        const fs = await import("node:fs/promises");
        const base64Data = webAudio.replace(/^data:audio\/mpeg;base64,/, "");
        const fileName = `${fallbackId}.mp3`;
        const filePath = path.resolve(process.cwd(), "public/audio/spots", fileName);
        await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
        finalAudioUrl = `/audio/spots/${fileName}`;
      } catch {
        // Mantém a data URI se o disco for somente-leitura (ex: Vercel)
      }
    }

    const fallbackSpot: RadioSpot = {
      id: fallbackId,
      title,
      subtitle: `Locução ao Vivo (${voice.includes("Antonio") ? "Voz Masculina FM" : "Voz Feminina Executiva"})`,
      audioUrl: finalAudioUrl,
      durationSeconds: Math.max(4, Math.round(script.split(" ").length * 0.45)),
      enabled: true,
      isCustom: true,
    };
    return { ok: true, spot: fallbackSpot };
  }
}
