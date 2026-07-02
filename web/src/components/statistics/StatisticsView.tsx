import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStatsStore } from '../../store/statsStore';
import { ActivityRing } from './ActivityRing';

type Tab = 'day' | 'week' | 'month';

const DAILY_GOAL_SECONDS = 4 * 3600; // 4-hour daily focus goal

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StatisticsView() {
  const [tab, setTab] = useState<Tab>('day');
  const { todayWorkTime, todaySessionCount, longestSession, weeklyData, monthlyData } = useStatsStore();

  return (
    <div className="flex flex-col gap-6 text-white">
      {/* Segmented tab control */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['day', 'week', 'month'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'day' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Focus Time', value: fmtDuration(todayWorkTime) },
              { label: 'Sessions', value: String(todaySessionCount) },
              { label: 'Longest', value: fmtDuration(longestSession) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-xl font-light">{value}</p>
                <p className="text-white/30 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-10 pt-2">
            <ActivityRing
              progress={todayWorkTime / DAILY_GOAL_SECONDS}
              color="#3b82f6"
              label="Daily Goal"
              value={`${Math.min(100, Math.round((todayWorkTime / DAILY_GOAL_SECONDS) * 100))}%`}
            />
            <ActivityRing
              progress={todaySessionCount / 8}
              color="#10b981"
              label="Sessions"
              value={String(todaySessionCount)}
            />
          </div>
        </div>
      )}

      {tab === 'week' && (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                itemStyle={{ color: '#3b82f6', fontSize: 12 }}
                formatter={(v: number) => [`${v}h`, 'Focus']}
              />
              <Bar dataKey="hours" fill="#3b82f6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'month' && (
        <div className="flex flex-col gap-3">
          <p className="text-white/30 text-xs text-center">Last 30 days</p>
          <div className="grid grid-cols-6 gap-1.5">
            {monthlyData.map((day, i) => {
              const intensity = Math.min(1, day.minutes / 120); // saturates at 2h
              return (
                <div
                  key={i}
                  className="aspect-square rounded-md"
                  style={{
                    backgroundColor: intensity > 0
                      ? `rgba(59, 130, 246, ${0.15 + intensity * 0.85})`
                      : 'rgba(255,255,255,0.04)',
                  }}
                  title={`Day ${day.date}: ${day.minutes}m`}
                />
              );
            })}
          </div>
          <p className="text-white/20 text-xs text-center">Darker = more focus time</p>
        </div>
      )}
    </div>
  );
}
