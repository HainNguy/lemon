import { useState, useEffect } from 'react';
import { Timer, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { TimerView } from './timer/TimerView';
import { StatisticsView } from './statistics/StatisticsView';
import { SettingsView } from './settings/SettingsView';
import { BreakOverlay } from './break/BreakOverlay';
import { useSettings } from '../hooks/useSettings';
import { requestPermission } from '../services/notificationService';

type Tab = 'timer' | 'stats' | 'settings';

const TABS = [
  { id: 'timer' as Tab, icon: Timer, label: 'Timer' },
  { id: 'stats' as Tab, icon: BarChart2, label: 'Stats' },
  { id: 'settings' as Tab, icon: SettingsIcon, label: 'Settings' },
] as const;

export function ContentView() {
  const [tab, setTab] = useState<Tab>('timer');
  const { settings, update } = useSettings();

  useEffect(() => {
    if (settings.enableNotifications) {
      void requestPermission();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Break overlay sits at z-9999 and covers everything */}
      <BreakOverlay gradientIndex={settings.overlayGradientIndex} showQuotes={settings.showQuotes} />

      <div className="flex flex-col flex-1 w-full max-w-sm mx-auto px-5">
        {/* App wordmark */}
        <div className="pt-8 pb-2 text-center">
          <span className="text-white/15 text-xs tracking-[0.4em] uppercase select-none">Lemon</span>
        </div>

        {/* Page content */}
        <div className="flex-1 flex flex-col py-4">
          {tab === 'timer' && <TimerView />}
          {tab === 'stats' && <StatisticsView />}
          {tab === 'settings' && <SettingsView settings={settings} update={update} />}
        </div>

        {/* Bottom tab bar */}
        <div className="sticky bottom-0 pb-6 pt-2 bg-black">
          <div className="flex gap-1 bg-white/5 rounded-2xl p-1">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-colors ${
                  tab === id ? 'bg-white/15 text-white' : 'text-white/25 hover:text-white/60'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
