import { useState } from 'react';
import type { Settings, UpdateSettings } from '../../hooks/useSettings';
import { GRADIENT_PRESETS, GRADIENT_NAMES, BACKGROUND_PRESETS, BACKGROUND_NAMES } from '../../constants/gradients';

interface Props {
  settings: Settings;
  update: UpdateSettings;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-blue-500' : 'bg-white/15'}`}
      aria-checked={on}
      role="switch"
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function DurationInput({ label, valueMinutes, onCommit, min, max }: {
  label: string;
  valueMinutes: number;
  onCommit: (minutes: number) => void;
  min: number;
  max: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(valueMinutes);

  function handleBlur() {
    const parsed = parseInt(displayed, 10);
    if (!isNaN(parsed)) {
      onCommit(Math.min(max, Math.max(min, parsed)));
    }
    setDraft(null);
  }

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={displayed}
          min={min}
          max={max}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-14 bg-white/10 text-white text-sm text-center rounded-lg py-1.5 outline-none focus:bg-white/20 focus:ring-1 focus:ring-white/30 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm text-white/40">min</span>
      </div>
    </div>
  );
}

export function SettingsView({ settings, update }: Props) {
  return (
    <div className="flex flex-col gap-7 text-white">
      {/* Durations */}
      <div className="flex flex-col gap-4">
        <p className="text-white/30 text-xs tracking-widest uppercase">Durations</p>
        <div className="flex flex-col gap-4">
          <DurationInput
            label="Focus Duration"
            valueMinutes={settings.workDuration / 60}
            min={5}
            max={120}
            onCommit={m => update('workDuration', m * 60)}
          />
          <DurationInput
            label="Break Duration"
            valueMinutes={settings.breakDuration / 60}
            min={1}
            max={60}
            onCommit={m => update('breakDuration', m * 60)}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-4">
        <p className="text-white/30 text-xs tracking-widest uppercase">Behavior</p>
        <div className="flex flex-col gap-4">
          {(
            [
              { key: 'autoStartBreak', label: 'Auto-start breaks' },
              { key: 'autoStartWork', label: 'Auto-start next focus' },
              { key: 'soundEnabled', label: 'Session end sound' },
              { key: 'enableNotifications', label: 'Notifications' },
              { key: 'showQuotes', label: 'Motivational quotes' },
            ] as { key: keyof Settings; label: string }[]
          ).map(({ key, label }) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-sm text-white/80">{label}</span>
              <Toggle on={settings[key] as boolean} onToggle={() => update(key, !settings[key])} />
            </div>
          ))}
        </div>
      </div>

      {/* Background picker */}
      <div className="flex flex-col gap-3">
        <p className="text-white/30 text-xs tracking-widest uppercase">App Background</p>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUND_PRESETS.map((bg, i) => (
            <button
              key={i}
              onClick={() => update('backgroundIndex', i)}
              className={`h-14 rounded-xl transition-all ${
                settings.backgroundIndex === i
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.04]'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{ background: bg }}
              title={BACKGROUND_NAMES[i]}
            />
          ))}
        </div>
      </div>

      {/* Break overlay picker */}
      <div className="flex flex-col gap-3">
        <p className="text-white/30 text-xs tracking-widest uppercase">Break Overlay</p>
        <div className="grid grid-cols-3 gap-2">
          {GRADIENT_PRESETS.map((gradient, i) => (
            <button
              key={i}
              onClick={() => update('overlayGradientIndex', i)}
              className={`h-14 rounded-xl transition-all ${
                settings.overlayGradientIndex === i
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.04]'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{ background: gradient }}
              title={GRADIENT_NAMES[i]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
