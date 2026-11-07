/**
 * Utilitário de Síntese de Fala de Alta Fidelidade para a Rádio Tarhget
 * Permite reproduzir a locução ao vivo diretamente no navegador com controle
 * de tom (grave FM / comercial), velocidade, pronúncia fonética e seleção de vozes pt-BR.
 */

export function playVoiceSpeech(
  text: string,
  voiceChoice: string = "pt-BR-AntonioNeural",
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  // Normalização fonética da marca para pronúncia impecável em português
  const cleanText = text.replace(/\bTarh?get\b/gi, "Tárguet");

  // Se já estiver falando, cancela a fala anterior
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = "pt-BR";

  // Busca vozes instaladas no navegador / sistema operacional
  const allVoices = window.speechSynthesis.getVoices();
  const ptVoices = allVoices.filter(
    (v) =>
      v.lang.startsWith("pt") ||
      v.lang.toLowerCase().replace(/_/g, "-").includes("pt-br")
  );

  const isDeepMale = voiceChoice.includes("Antonio");
  const isYoungMale = voiceChoice.includes("Fabio");
  const isMale = isDeepMale || isYoungMale;

  // Equalização sonora de locução:
  if (isDeepMale) {
    utter.pitch = 0.86; // Tom encorpado de locutor FM
    utter.rate = 0.98;
  } else if (isYoungMale) {
    utter.pitch = 1.0;
    utter.rate = 1.05;
  } else {
    // Thalita / Francisca (Feminina Acolhedora / Comercial)
    utter.pitch = 1.14;
    utter.rate = 1.02;
  }

  // Tenta atribuir a melhor voz nativa disponível
  if (ptVoices.length > 0) {
    if (isMale) {
      const maleVoice = ptVoices.find((v) =>
        /daniel|felipe|antonio|ricardo|male|homem|brazil male/i.test(v.name)
      );
      utter.voice = maleVoice || ptVoices[0];
    } else {
      const femaleVoice = ptVoices.find((v) =>
        /maria|luciana|francisca|thalita|female|mulher|brazil female|google português/i.test(v.name)
      );
      utter.voice = femaleVoice || ptVoices[0];
    }
  }

  utter.onstart = () => {
    onStart?.();
  };

  utter.onend = () => {
    onEnd?.();
  };

  utter.onerror = (e) => {
    console.warn("[speech] Erro na síntese de voz:", e);
    onEnd?.();
  };

  // Timeout para evitar o bug do Chromium onde cancel() imediato engole o speak()
  setTimeout(() => {
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      onEnd?.();
    }
  }, 40);

  return true;
}

/** Cancela qualquer fala ativa do navegador imediatamente. */
export function stopVoiceSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

