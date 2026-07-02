import { create } from 'zustand';
import { db } from '../db/database';
import type { TimerPhase, SessionType } from '../models/TimerPhase';
import { notifyWorkComplete, notifyBreakComplete } from '../services/notificationService';

// Read settings directly from localStorage so the store doesn't depend on React hooks.
// These are called at the moment a session starts/ends, so they always reflect current settings.
function getWorkDuration(): number {
  const v = localStorage.getItem('workDuration');
  return v ? (JSON.parse(v) as number) : 1500;
}
function getBreakDuration(): number {
  const v = localStorage.getItem('breakDuration');
  return v ? (JSON.parse(v) as number) : 300;
}
function getAutoStartBreak(): boolean {
  const v = localStorage.getItem('autoStartBreak');
  return v ? (JSON.parse(v) as boolean) : true;
}
function getAutoStartWork(): boolean {
  const v = localStorage.getItem('autoStartWork');
  return v ? (JSON.parse(v) as boolean) : false;
}
function getSoundEnabled(): boolean {
  const v = localStorage.getItem('soundEnabled');
  return v ? (JSON.parse(v) as boolean) : true;
}

function playSessionEndSound(type: 'work' | 'break'): void {
  if (!getSoundEnabled()) return;
  try {
    const ctx = new AudioContext();
    // Ascending chime for work end (break starting), descending for break end (focus starting)
    const freqs = type === 'work' ? [660, 880] : [880, 660];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // AudioContext unavailable or blocked
  }
}

export function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Timer engine (lives outside Zustand so it doesn't cause re-renders on every tick) ---

let intervalId: ReturnType<typeof setInterval> | null = null;
let expectedEndTime: number | null = null;
let sessionStartTime: number | null = null;

function clearTimer(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    expectedEndTime = null;
  }
}

function startInterval(remainingSeconds: number, totalSeconds: number): void {
  clearTimer();
  expectedEndTime = Date.now() + remainingSeconds * 1000;
  intervalId = setInterval(() => {
    const remaining = Math.max(0, (expectedEndTime! - Date.now()) / 1000);
    useTimerStore.setState({
      timeRemaining: remaining,
      progress: 1 - remaining / totalSeconds,
    });
    if (remaining <= 0) {
      clearTimer();
      handleSessionEnd();
    }
  }, 250);
}

function handleSessionEnd(): void {
  const state = useTimerStore.getState();
  const now = Date.now();
  const start = sessionStartTime ?? now;

  if (state.phase.kind === 'working') {
    const breakDuration = getBreakDuration();
    notifyWorkComplete();
    playSessionEndSound('work');
    void db.sessions.add({ startTime: start, endTime: now, duration: state.totalTime, type: 'work', completed: true });

    if (getAutoStartBreak()) {
      sessionStartTime = now;
      useTimerStore.setState({
        phase: { kind: 'onBreak' },
        timeRemaining: breakDuration,
        totalTime: breakDuration,
        progress: 0,
        completedWorkSessions: state.completedWorkSessions + 1,
      });
      document.title = `${formatTime(breakDuration)} — Break`;
      startInterval(breakDuration, breakDuration);
    } else {
      sessionStartTime = null;
      useTimerStore.setState({
        phase: { kind: 'paused', resumingTo: 'break' },
        timeRemaining: breakDuration,
        totalTime: breakDuration,
        progress: 0,
        completedWorkSessions: state.completedWorkSessions + 1,
      });
      document.title = 'Lemon — Break Ready';
    }

  } else if (state.phase.kind === 'onBreak') {
    sessionStartTime = null;
    notifyBreakComplete();
    playSessionEndSound('break');

    // Persist completed break session
    void db.sessions.add({ startTime: start, endTime: now, duration: state.totalTime, type: 'break', completed: true });

    if (getAutoStartWork()) {
      const workDuration = getWorkDuration();
      sessionStartTime = now;
      useTimerStore.setState({
        phase: { kind: 'working' },
        timeRemaining: workDuration,
        totalTime: workDuration,
        progress: 0,
      });
      document.title = `${formatTime(workDuration)} — Focus`;
      startInterval(workDuration, workDuration);
    } else {
      const workDuration = getWorkDuration();
      useTimerStore.setState({
        phase: { kind: 'idle' },
        timeRemaining: workDuration,
        totalTime: workDuration,
        progress: 0,
      });
      document.title = 'Lemon';
    }
  }
}

// --- Zustand store ---

interface TimerState {
  phase: TimerPhase;
  timeRemaining: number;
  totalTime: number;
  completedWorkSessions: number;
  progress: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: { kind: 'idle' },
  timeRemaining: getWorkDuration(),
  totalTime: getWorkDuration(),
  completedWorkSessions: 0,
  progress: 0,

  start: () => {
    const workDuration = getWorkDuration();
    sessionStartTime = Date.now();
    set({ phase: { kind: 'working' }, timeRemaining: workDuration, totalTime: workDuration, progress: 0 });
    document.title = `${formatTime(workDuration)} — Focus`;
    startInterval(workDuration, workDuration);
  },

  pause: () => {
    const { phase } = get();
    if (phase.kind !== 'working' && phase.kind !== 'onBreak') return;
    clearTimer();
    const resumingTo: SessionType = phase.kind === 'working' ? 'work' : 'break';
    set({ phase: { kind: 'paused', resumingTo } });
    document.title = 'Lemon — Paused';
  },

  resume: () => {
    const { phase, timeRemaining, totalTime } = get();
    if (phase.kind !== 'paused') return;
    // sessionStartTime is null when resuming a break that wasn't auto-started
    if (sessionStartTime === null) sessionStartTime = Date.now();
    const newPhase: TimerPhase = phase.resumingTo === 'work' ? { kind: 'working' } : { kind: 'onBreak' };
    set({ phase: newPhase });
    document.title = `${formatTime(timeRemaining)} — ${phase.resumingTo === 'work' ? 'Focus' : 'Break'}`;
    startInterval(timeRemaining, totalTime);
  },

  skip: () => {
    const { phase, completedWorkSessions } = get();
    const now = Date.now();
    const elapsed = sessionStartTime ? (now - sessionStartTime) / 1000 : 0;
    clearTimer();

    const isWork = phase.kind === 'working' || (phase.kind === 'paused' && phase.resumingTo === 'work');

    if (isWork) {
      if (sessionStartTime) {
        void db.sessions.add({ startTime: sessionStartTime, endTime: now, duration: elapsed, type: 'work', completed: false });
      }
      const breakDuration = getBreakDuration();
      sessionStartTime = now;
      set({ phase: { kind: 'onBreak' }, timeRemaining: breakDuration, totalTime: breakDuration, progress: 0, completedWorkSessions: completedWorkSessions + 1 });
      document.title = `${formatTime(breakDuration)} — Break`;
      startInterval(breakDuration, breakDuration);
    } else {
      if (sessionStartTime) {
        void db.sessions.add({ startTime: sessionStartTime, endTime: now, duration: elapsed, type: 'break', completed: false });
      }
      sessionStartTime = null;
      const workDuration = getWorkDuration();
      set({ phase: { kind: 'idle' }, timeRemaining: workDuration, totalTime: workDuration, progress: 0 });
      document.title = 'Lemon';
    }
  },

  stop: () => {
    clearTimer();
    sessionStartTime = null;
    const workDuration = getWorkDuration();
    set({ phase: { kind: 'idle' }, timeRemaining: workDuration, totalTime: workDuration, progress: 0 });
    document.title = 'Lemon';
  },
}));
