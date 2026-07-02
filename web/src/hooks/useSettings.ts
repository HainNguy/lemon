import { useState } from 'react';

export interface Settings {
  workDuration: number;       // seconds (default 1500 = 25 min)
  breakDuration: number;      // seconds (default 300 = 5 min)
  autoStartBreak: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  enableNotifications: boolean;
  showQuotes: boolean;
  overlayGradientIndex: number;
  backgroundIndex: number;
}

const DEFAULTS: Settings = {
  workDuration: 1500,
  breakDuration: 300,
  autoStartBreak: true,
  autoStartWork: false,
  soundEnabled: true,
  enableNotifications: true,
  showQuotes: true,
  overlayGradientIndex: 0,
  backgroundIndex: 6,
};

function loadSetting<K extends keyof Settings>(key: K): Settings[K] {
  const raw = localStorage.getItem(key);
  if (raw === null) return DEFAULTS[key];
  try {
    return JSON.parse(raw) as Settings[K];
  } catch {
    return DEFAULTS[key];
  }
}

export type UpdateSettings = (key: keyof Settings, value: Settings[keyof Settings]) => void;

export function useSettings(): { settings: Settings; update: UpdateSettings } {
  const [settings, setSettings] = useState<Settings>(() => ({
    workDuration: loadSetting('workDuration'),
    breakDuration: loadSetting('breakDuration'),
    autoStartBreak: loadSetting('autoStartBreak'),
    autoStartWork: loadSetting('autoStartWork'),
    soundEnabled: loadSetting('soundEnabled'),
    enableNotifications: loadSetting('enableNotifications'),
    showQuotes: loadSetting('showQuotes'),
    overlayGradientIndex: loadSetting('overlayGradientIndex'),
    backgroundIndex: loadSetting('backgroundIndex'),
  }));

  const update: UpdateSettings = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, update };
}
