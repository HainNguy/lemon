export type SessionType = 'work' | 'break';

export type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'onBreak' }
  | { kind: 'paused'; resumingTo: SessionType };
