export interface Session {
  id?: number;        // Dexie auto-increment primary key
  startTime: number;  // Date.now() timestamp (milliseconds)
  endTime: number;
  duration: number;   // seconds (planned duration, not elapsed)
  type: 'work' | 'break';
  completed: boolean; // false if skipped early
}
