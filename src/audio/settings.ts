export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
}

type AudioSettingKey = keyof AudioSettings;
type AudioSettingsListener = (settings: AudioSettings) => void;

const AUDIO_SETTINGS_KEY = 'mota-purple-trial-audio-settings';
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.32,
  sfxVolume: 0.78
};

let settings = loadAudioSettings();
const listeners = new Set<AudioSettingsListener>();

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

export function setAudioVolume(key: AudioSettingKey, value: number) {
  settings = {
    ...settings,
    [key]: clampVolume(value)
  };
  saveAudioSettings(settings);
  listeners.forEach((listener) => listener(getAudioSettings()));
}

export function subscribeAudioSettings(listener: AudioSettingsListener) {
  listeners.add(listener);
  listener(getAudioSettings());
  return () => listeners.delete(listener);
}

function loadAudioSettings(): AudioSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) ?? 'null') as Partial<AudioSettings> | null;
    return {
      musicVolume: clampVolume(parsed?.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
      sfxVolume: clampVolume(parsed?.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume)
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function saveAudioSettings(nextSettings: AudioSettings) {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(nextSettings));
  } catch {
    // Audio preferences are non-critical; ignore storage failures.
  }
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
