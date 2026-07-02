import Dexie, { type Table } from 'dexie';
import type { Session } from '../models/Session';

class LemonDatabase extends Dexie {
  sessions!: Table<Session>;

  constructor() {
    super('lemon');
    this.version(1).stores({
      sessions: '++id, startTime, type, completed',
    });
  }
}

export const db = new LemonDatabase();
