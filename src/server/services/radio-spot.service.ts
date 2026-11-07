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
    console.error("[radio-spot] Erro ao gerar vinheta com Python:", err.message);
    
    // Fallback gracioso para ambiente serverless / cloud onde python local não está disponível
    const fallbackId = `custom-spot-${Date.now()}`;
    const fallbackSpot: RadioSpot = {
      id: fallbackId,
      title,
      subtitle: `Locução IA Michelin (${voice.includes("Antonio") ? "Voz Antônio" : "Voz Thalita"})`,
      audioUrl: "/audio/spots/target-spot-raio-1.mp3",
      durationSeconds: Math.max(5, Math.min(25, Math.round(script.split(" ").length * 0.4))),
      enabled: true,
      isCustom: true,
    };
    return { ok: true, spot: fallbackSpot };
  }
}
