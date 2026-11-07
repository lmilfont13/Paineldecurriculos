import sys
import json
import asyncio
import os
import subprocess
import time
import re

async def generate_spot(title: str, script: str, voice: str = "pt-BR-AntonioNeural", sfx_preset: str = "raio-trovao"):
    import edge_tts
    
    # Normalização fonética da marca para pronúncia impecável de rádio ("Tárguet", como "target"/alvo em inglês)
    script_clean = re.sub(r'\b(Tarh?get|Tár-guet|Targuet)\b', 'Tárguet', script, flags=re.IGNORECASE)
    
    spot_id = f"custom-spot-{int(time.time())}"
    os.makedirs("public/audio/spots", exist_ok=True)
    os.makedirs("scratch", exist_ok=True)
    
    temp_voice = f"scratch/temp_voice_{spot_id}.mp3"
    out_mp3 = f"public/audio/spots/{spot_id}.mp3"
    public_url = f"/audio/spots/{spot_id}.mp3"
    
    # 1. Gera áudio da locução com tom firme e ritmo de rádio (+4% velocidade, +1Hz pitch)
    tts = edge_tts.Communicate(script_clean, voice, rate="+4%", pitch="+1Hz")
    await tts.save(temp_voice)
    
    # 2. Configura filtros de áudio profissionais estilo rádio FM ("Nível Michelin")
    # Equalizador com grave aveludado (warm bass @ 100Hz) + clareza no agudo (air @ 9.5kHz)
    # Compressor broadcast (-12dB) + Reverb/Echo de estúdio (aecho)
    if sfx_preset == "laser-sweep":
        af_filter = (
            "equalizer=f=90:width_type=h:width=100:g=4,"
            "equalizer=f=10000:width_type=h:width=2000:g=4,"
            "acompressor=threshold=-13dB:ratio=4:attack=5:release=45,"
            "aecho=0.8:0.7:30:0.3,"
            "afade=t=in:st=0:d=0.1"
        )
        subtitle = "Locução Rádio FM + Laser Sweep Futurista"
    elif sfx_preset == "acolhimento-suave":
        af_filter = (
            "equalizer=f=120:width_type=h:width=120:g=3,"
            "equalizer=f=8000:width_type=h:width=1500:g=2,"
            "acompressor=threshold=-10dB:ratio=3:attack=8:release=60,"
            "aecho=0.8:0.6:20:0.2"
        )
        subtitle = "Acolhimento Suave com Reverb Studio"
    elif sfx_preset == "comercial-limpo":
        af_filter = (
            "equalizer=f=100:width_type=h:width=100:g=4,"
            "equalizer=f=9000:width_type=h:width=1800:g=3,"
            "acompressor=threshold=-14dB:ratio=5:attack=4:release=40"
        )
        subtitle = "Locução Comercial FM Masterizada"
    else: # raio-trovao (padrão)
        af_filter = (
            "equalizer=f=80:width_type=h:width=80:g=6,"
            "equalizer=f=9500:width_type=h:width=2000:g=4,"
            "acompressor=threshold=-12dB:ratio=4.5:attack=4:release=50,"
            "aecho=0.8:0.75:25:0.28"
        )
        subtitle = "Efeito Raio, Trovão Sônico & Drop 808"

    cmd = [
        "ffmpeg", "-y",
        "-i", temp_voice,
        "-af", af_filter,
        "-b:a", "192k",
        out_mp3
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 3. Mede a duração com ffprobe
    duration_cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        out_mp3
    ]
    dur_out = subprocess.check_output(duration_cmd).decode().strip()
    duration_sec = max(3, round(float(dur_out)))
    
    # Limpa temp
    if os.path.exists(temp_voice):
        try: os.remove(temp_voice)
        except: pass
        
    result = {
        "ok": True,
        "spot": {
            "id": spot_id,
            "title": title.strip() or "✨ Nova Vinheta Oficial",
            "subtitle": subtitle,
            "audioUrl": public_url,
            "durationSeconds": duration_sec,
            "enabled": True,
            "isCustom": True
        }
    }
    print(json.dumps(result))

if __name__ == "__main__":
    import base64
    raw_input = ""
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        try:
            # Tenta decodificar base64 para evitar problemas de escape de shell
            raw_input = base64.b64decode(arg).decode("utf-8")
        except Exception:
            raw_input = arg
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
        title = data.get("title", "Nova Vinheta")
        script = data.get("script", "Você está sintonizado na Rádio Tár-guet!")
        voice = data.get("voice", "pt-BR-AntonioNeural")
        sfx = data.get("sfxPreset", "raio-trovao")
        asyncio.run(generate_spot(title, script, voice, sfx))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
