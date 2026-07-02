import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export interface DayStat {
  label: string;
  hours: number;
}

export interface MonthDay {
  date: number;
  minutes: number;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useStatsStore() {
  const monthStart = startOfDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  const sessions = useLiveQuery(
    () => db.sessions.where('startTime').aboveOrEqual(monthStart).and(s => s.type === 'work').toArray(),
    [monthStart],
  );

  if (!sessions) {
    return { todayWorkTime: 0, todaySessionCount: 0, longestSession: 0, weeklyData: [] as DayStat[], monthlyData: [] as MonthDay[] };
  }

  const todayStart = startOfDay(new Date());
  const todaySessions = sessions.filter(s => s.startTime >= todayStart);
  const todayWorkTime = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const todaySessionCount = todaySessions.length;
  const longestSession = sessions.length > 0 ? Math.max(...sessions.map(s => s.duration)) : 0;

  // Last 7 days
  const weeklyData: DayStat[] = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = startOfDay(day);
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const hours = sessions
      .filter(s => s.startTime >= dayStart && s.startTime < dayEnd)
      .reduce((sum, s) => sum + s.duration, 0) / 3600;
    return { label: DAY_NAMES[day.getDay()], hours: Math.round(hours * 10) / 10 };
  });

  // Last 30 days for heatmap
  const monthlyData: MonthDay[] = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    const dayStart = startOfDay(day);
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const minutes = sessions
      .filter(s => s.startTime >= dayStart && s.startTime < dayEnd)
      .reduce((sum, s) => sum + s.duration, 0) / 60;
    return { date: day.getDate(), minutes: Math.round(minutes) };
  });

  return { todayWorkTime, todaySessionCount, longestSession, weeklyData, monthlyData };
}
