import { services } from '../services';

type SfxKey = 'battleHit' | 'reward' | 'floorTransition';

type WebAudioContext = AudioContext & {
  createGain(): GainNode;
};

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: WebAudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const audioWindow = window as AudioWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass() as WebAudioContext;
  return audioContext;
}

export function playSfx(key: SfxKey) {
  const definition = services.assets?.audio?.[key];
  if (!definition) return;
  window.dispatchEvent(new CustomEvent('mota:sfx', { detail: { key, synth: definition.synth } }));

  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }

  const volume = Math.max(0, Math.min(1, definition.volume));
  try {
    if (definition.synth === 'hit') playHit(context, volume);
    if (definition.synth === 'reward') playReward(context, volume);
    if (definition.synth === 'floor') playFloor(context, volume);
  } catch {
    // Audio is presentation-only; never let browser audio policy break input.
  }
}

function connectEnvelope(context: AudioContext, start: number, duration: number, volume: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(context.destination);
  return gain;
}

function playTone(context: AudioContext, frequency: number, duration: number, volume: number, type: OscillatorType, delay = 0) {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.connect(connectEnvelope(context, start, duration, volume));
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playHit(context: AudioContext, volume: number) {
  playTone(context, 180, 0.09, volume * 0.42, 'sawtooth');
  playTone(context, 760, 0.07, volume * 0.32, 'square', 0.012);
}

function playReward(context: AudioContext, volume: number) {
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    playTone(context, frequency, 0.12, volume * 0.28, 'triangle', index * 0.055);
  });
}

function playFloor(context: AudioContext, volume: number) {
  playTone(context, 220, 0.18, volume * 0.24, 'sine');
  playTone(context, 440, 0.2, volume * 0.18, 'triangle', 0.05);
}
