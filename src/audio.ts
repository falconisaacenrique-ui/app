/**
 * Procedural soundscapes — rain, wind, and deep noise synthesized live
 * with the Web Audio API. No audio files anywhere.
 */

export type SoundKind = 'rain' | 'wind' | 'deep';

let ctx: AudioContext | null = null;
let running: { stop: () => void } | null = null;

function noiseBuffer(audio: AudioContext, brown = false): AudioBuffer {
  const length = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export function startSound(kind: SoundKind): void {
  stopSound();
  ctx = ctx ?? new AudioContext();
  void ctx.resume();
  const audio = ctx;
  const master = audio.createGain();
  master.gain.value = 0.25;
  master.connect(audio.destination);
  const stops: (() => void)[] = [() => master.disconnect()];

  const loop = (brown: boolean) => {
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(audio, brown);
    src.loop = true;
    return src;
  };

  if (kind === 'deep') {
    const src = loop(true);
    src.connect(master);
    src.start();
    stops.push(() => src.stop());
  } else if (kind === 'rain') {
    // steady hiss through a high shelf + random droplet taps
    const src = loop(false);
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const hiss = audio.createGain();
    hiss.gain.value = 0.5;
    src.connect(filter).connect(hiss).connect(master);
    src.start();
    const dropTimer = setInterval(() => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.frequency.value = 600 + Math.random() * 2400;
      g.gain.setValueAtTime(0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.06);
      osc.connect(g).connect(master);
      osc.start();
      osc.stop(audio.currentTime + 0.07);
    }, 140);
    stops.push(() => src.stop(), () => clearInterval(dropTimer));
  } else {
    // wind: band-passed noise with a slow LFO sweeping the band
    const src = loop(false);
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 400;
    band.Q.value = 1.2;
    const lfo = audio.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(band.frequency);
    src.connect(band).connect(master);
    src.start();
    lfo.start();
    stops.push(() => src.stop(), () => lfo.stop());
  }

  running = {
    stop: () => {
      for (const s of stops) {
        try {
          s();
        } catch {
          // already stopped
        }
      }
    },
  };
}

export function stopSound(): void {
  running?.stop();
  running = null;
}
