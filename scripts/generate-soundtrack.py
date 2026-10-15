import math
import struct
import wave
import os

SAMPLE_RATE = 44100
DURATION = 60.0  # seconds
TOTAL_SAMPLES = int(SAMPLE_RATE * DURATION)
BPM = 124.0
BEAT_DUR = 60.0 / BPM  # ~0.48387 seconds per beat

print(f"Generating 60s soundtrack at {SAMPLE_RATE}Hz, {BPM} BPM...")

# Left and Right channel sample buffers
left = [0.0] * TOTAL_SAMPLES
right = [0.0] * TOTAL_SAMPLES

def add_sample(i, l_val, r_val):
    if 0 <= i < TOTAL_SAMPLES:
        left[i] += l_val
        right[i] += r_val

# 1. GENERATE BEATS (Kicks, Snares, Hi-Hats)
total_beats = int(DURATION / BEAT_DUR)

for beat in range(total_beats):
    t_start = beat * BEAT_DUR
    idx_start = int(t_start * SAMPLE_RATE)
    
    # 4-on-the-floor Kick drum (starts at beat 8 / ~3.8s, stops briefly at breakdowns)
    is_breakdown = (beat >= 32 and beat < 36) or (beat >= 68 and beat < 72) or (beat >= 116)
    if beat >= 8 and not is_breakdown:
        kick_dur = 0.28
        kick_samples = int(kick_dur * SAMPLE_RATE)
        for s in range(kick_samples):
            ts = s / SAMPLE_RATE
            # Pitch drop from 140Hz down to 42Hz
            freq = 42.0 + 98.0 * math.exp(-ts * 28.0)
            phase = 2.0 * math.pi * freq * ts
            env = math.exp(-ts * 14.0)
            val = math.sin(phase) * env * 0.75
            add_sample(idx_start + s, val, val)

    # Snare / Cyber Clap on beats 2 and 4 (beat % 4 == 1 or 3)
    if beat >= 16 and not is_breakdown and (beat % 4 == 1 or beat % 4 == 3):
        snare_dur = 0.22
        snare_samples = int(snare_dur * SAMPLE_RATE)
        for s in range(snare_samples):
            ts = s / SAMPLE_RATE
            env = math.exp(-ts * 18.0)
            # Pseudo noise + tonal 180Hz body
            noise = ((math.sin(s * 12345.67) * 43758.5453) % 1.0) * 2.0 - 1.0
            tone = math.sin(2.0 * math.pi * 185.0 * ts) * math.exp(-ts * 30.0)
            val = (noise * 0.6 + tone * 0.4) * env * 0.4
            add_sample(idx_start + s, val * 0.9, val * 1.1)

    # Hi-Hats on 8th notes (and 16th rolling hats in intense sections)
    if beat >= 16 and not is_breakdown:
        for sub in [0, 1]:  # 8th notes
            hat_t = t_start + sub * (BEAT_DUR / 2.0)
            hat_idx = int(hat_t * SAMPLE_RATE)
            hat_dur = 0.06 if sub == 0 else 0.08
            hat_samples = int(hat_dur * SAMPLE_RATE)
            for s in range(hat_samples):
                ts = s / SAMPLE_RATE
                env = math.exp(-ts * 55.0)
                noise = ((math.sin((hat_idx + s) * 9876.54) * 31415.92) % 1.0) * 2.0 - 1.0
                val = noise * env * (0.18 if sub == 1 else 0.12)
                pan = 0.3 if sub == 1 else -0.3
                add_sample(hat_idx + s, val * (1.0 - pan), val * (1.0 + pan))

# 2. CHORD PADS (D minor progression: Dm -> Bb -> F -> C)
# Dm: D3 (146.83), F3 (174.61), A3 (220.0)
# Bb: Bb2 (116.54), D3 (146.83), F3 (174.61)
# F:  F2 (87.31), A3 (220.0), C4 (261.63)
# C:  C3 (130.81), E3 (164.81), G3 (196.0)

chords = [
    ([146.83, 174.61, 220.00], 4.0 * BEAT_DUR), # Dm
    ([116.54, 146.83, 174.61], 4.0 * BEAT_DUR), # Bb
    ([174.61, 220.00, 261.63], 4.0 * BEAT_DUR), # F
    ([130.81, 164.81, 196.00], 4.0 * BEAT_DUR), # C
]

chord_cycle_dur = 16.0 * BEAT_DUR
for i in range(TOTAL_SAMPLES):
    t = i / SAMPLE_RATE
    if t >= 58.0:
        continue # Fade out
    
    # Global fade in and out
    master_env = 1.0
    if t < 2.0:
        master_env = t / 2.0
    elif t > 56.0:
        master_env = max(0.0, (59.0 - t) / 3.0)
        
    chord_t = t % chord_cycle_dur
    curr_t = 0.0
    curr_freqs = chords[0][0]
    for c_freqs, c_dur in chords:
        if curr_t <= chord_t < curr_t + c_dur:
            curr_freqs = c_freqs
            break
        curr_t += c_dur
        
    pad_val = 0.0
    for idx, f in enumerate(curr_freqs):
        # Detuned saw/sine mixture with slight chorus
        w1 = math.sin(2.0 * math.pi * f * t)
        w2 = math.sin(2.0 * math.pi * (f * 1.004) * t)
        w3 = math.sin(2.0 * math.pi * (f * 0.996) * t)
        pad_val += (w1 + 0.6 * w2 + 0.6 * w3) * 0.05
    
    add_sample(i, pad_val * master_env * 0.85, pad_val * master_env * 1.15)

# 3. 808 SUB-BASSLINE
root_notes = [73.42, 58.27, 87.31, 65.41] # D2, Bb1, F2, C2
for i in range(TOTAL_SAMPLES):
    t = i / SAMPLE_RATE
    if t < 4.0 or t >= 57.0:
        continue
    c_idx = int((t % chord_cycle_dur) / (4.0 * BEAT_DUR)) % 4
    rf = root_notes[c_idx]
    
    # Pulsing 8th note sub bass
    sub_phase = (t % (BEAT_DUR / 2.0)) / (BEAT_DUR / 2.0)
    sub_env = math.exp(-sub_phase * 3.5)
    bass_val = math.sin(2.0 * math.pi * rf * t) * sub_env * 0.35
    add_sample(i, bass_val, bass_val)

# 4. CYBER ARPEGGIO MELODY (High tech synth lead)
arp_notes = [293.66, 349.23, 440.0, 523.25, 587.33, 440.0, 349.23, 293.66] # D4, F4, A4, C5, D5...
step_dur = BEAT_DUR / 4.0 # 16th notes
for step in range(int(DURATION / step_dur)):
    t_step = step * step_dur
    if t_step < 8.0 or t_step >= 56.0:
        continue
    idx_s = int(t_step * SAMPLE_RATE)
    f_arp = arp_notes[step % len(arp_notes)]
    note_samples = int(step_dur * SAMPLE_RATE)
    
    for s in range(note_samples):
        ts = s / SAMPLE_RATE
        env = math.exp(-ts * 22.0)
        # Crystal pluck tone
        val = (math.sin(2.0 * math.pi * f_arp * ts) + 0.4 * math.sin(2.0 * math.pi * f_arp * 2.0 * ts)) * env * 0.14
        pan = math.sin(step * 0.8) * 0.5
        add_sample(idx_s + s, val * (1.0 - pan), val * (1.0 + pan))

# 5. CINEMATIC IMPACTS & RISERS (Scene Transitions)
transition_times = [0.1, 8.2, 18.0, 28.0, 38.0, 48.0, 55.0]

# Sub-drops / Impacts
for trans_t in transition_times:
    idx_tr = int(trans_t * SAMPLE_RATE)
    impact_dur = 1.8
    imp_samples = int(impact_dur * SAMPLE_RATE)
    for s in range(imp_samples):
        ts = s / SAMPLE_RATE
        # Deep pitch drop 90Hz -> 28Hz
        f_sub = 28.0 + 62.0 * math.exp(-ts * 4.0)
        sub_wave = math.sin(2.0 * math.pi * f_sub * ts) * math.exp(-ts * 2.2) * 0.65
        # Impact transient click
        click = ((math.sin(s * 876.5) * 1234.5) % 1.0) * math.exp(-ts * 80.0) * 0.3
        val = sub_wave + click
        add_sample(idx_tr + s, val, val)

# Risers / Whooshes leading up to transitions
for trans_t in transition_times[1:]:
    riser_dur = 2.2
    t_start_r = trans_t - riser_dur
    if t_start_r < 0:
        continue
    idx_r = int(t_start_r * SAMPLE_RATE)
    r_samples = int(riser_dur * SAMPLE_RATE)
    for s in range(r_samples):
        ts = s / SAMPLE_RATE
        prog = ts / riser_dur
        # Filtered rising noise
        noise = ((math.sin((idx_r + s) * 543.21) * 9876.5) % 1.0) * 2.0 - 1.0
        pitch_rise = math.sin(2.0 * math.pi * (150.0 + 800.0 * (prog ** 2)) * ts) * 0.2
        val = (noise * 0.7 + pitch_rise) * (prog ** 2.5) * 0.3
        pan = (prog * 2.0) - 1.0
        add_sample(idx_r + s, val * max(0.0, 1.0 - pan), val * max(0.0, 1.0 + pan))

# 6. MASTERING & SOFT LIMITER
os.makedirs("public/video", exist_ok=True)
wav_path = "public/video/soundtrack_60s.wav"

with wave.open(wav_path, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2) # 16-bit
    wf.setframerate(SAMPLE_RATE)
    
    out_frames = bytearray()
    for i in range(TOTAL_SAMPLES):
        l = left[i]
        r = right[i]
        # Soft saturation tanh limiter
        l_clamped = math.tanh(l)
        r_clamped = math.tanh(r)
        
        l_int = int(max(-32767, min(32767, l_clamped * 32000)))
        r_int = int(max(-32767, min(32767, r_clamped * 32000)))
        
        out_frames.extend(struct.pack("<hh", l_int, r_int))
        
    wf.writeframes(out_frames)

print(f"Soundtrack generated successfully: {wav_path} ({os.path.getsize(wav_path)} bytes)")
