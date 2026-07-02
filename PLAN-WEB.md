# Plan: Flow Web — Browser-Based Pomodoro Timer

## Context

A web port of the native macOS Flow app (`PLAN.md`) delivering full feature parity in the browser. The app runs as an installable PWA (Progressive Web App), works fully offline, and preserves the same aesthetic and UX as the native version. The key challenge is replacing macOS-specific primitives (SwiftData, NSWindow, UNUserNotificationCenter) with web equivalents while keeping the same architecture shape.

---

## Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 19 + Vite** | Widest ecosystem, Zustand stores map cleanly to ObservableObject, most hireable |
| State | **Zustand** | Minimal boilerplate; store slices mirror TimerViewModel/StatisticsViewModel exactly |
| Styling | **Tailwind CSS v4** | Utility-first; dark mode via `dark:` classes; no CSS-in-JS overhead for a timer |
| Charts | **Recharts** | Declarative API closest to Swift Charts; React-native, good SVG output |
| Persistence | **Dexie.js** (IndexedDB) for sessions + **localStorage** for settings | Sessions need queryable history; settings are flat key/value |
| PWA | **Vite PWA plugin** (Workbox) | Offline-first, installable, tab badge via title |
| Language | **TypeScript 5** | Strict mode; interfaces replace `@Model` |

---

## Project Scaffold

Lives alongside the native plan in the same repo under `web/`:

```
flow/
├── PLAN.md
├── PLAN-WEB.md
└── web/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── public/
    │   ├── manifest.json          # PWA manifest
    │   └── icons/                 # 192×192, 512×512 app icons
    └── src/
        ├── main.tsx               # React root, mounts App
        ├── App.tsx                # Root component, tab routing
        ├── models/
        │   ├── Session.ts         # TypeScript interface (mirrors @Model Session)
        │   └── TimerPhase.ts      # Union type (mirrors TimerPhase enum)
        ├── store/
        │   ├── timerStore.ts      # Zustand (mirrors TimerViewModel)
        │   └── statsStore.ts      # Zustand (mirrors StatisticsViewModel)
        ├── db/
        │   └── database.ts        # Dexie class + table definitions
        ├── hooks/
        │   └── useSettings.ts     # localStorage wrapper with typed getters/setters
        ├── components/
        │   ├── ContentView.tsx    # Root layout + tab bar
        │   ├── timer/
        │   │   ├── TimerView.tsx
        │   │   ├── CircularProgress.tsx   # SVG arc (replaces Canvas/Path)
        │   │   └── SessionControls.tsx
        │   ├── break/
        │   │   └── BreakOverlay.tsx       # Fixed full-viewport div (replaces NSWindow)
        │   ├── statistics/
        │   │   ├── StatisticsView.tsx
        │   │   └── ActivityRing.tsx       # SVG concentric arcs
        │   └── settings/
        │       └── SettingsView.tsx
        └── services/
            └── notificationService.ts    # Web Notifications API wrapper
```

---

## Native → Web Mapping

| macOS Native | Web Equivalent |
|---|---|
| `@Model class Session` (SwiftData) | TypeScript `Session` interface + Dexie `Table<Session>` |
| `@AppStorage` (UserDefaults) | `localStorage` via `useSettings` hook |
| `ObservableObject` + `@Published` | Zustand store with `set()` / `subscribe()` |
| `Task.sleep` timer loop | `setInterval` (250ms) + `Date.now()` drift correction |
| `NSWindow` level `.screenSaver` | `position: fixed; inset: 0; z-index: 9999` overlay div |
| `UNUserNotificationCenter` | `Notification` Web API |
| `Swift Charts BarMark` | `Recharts <BarChart>` |
| `Canvas` / `Path.addArc` | SVG `<circle>` with `stroke-dasharray` / `stroke-dashoffset` |
| `MenuBarExtra` | `document.title` updated with countdown (e.g. `"24:13 — Focus"`) |
| `@Query` (SwiftData live query) | Dexie `useLiveQuery` React hook |
| `@Environment(\.modelContext)` | Dexie `db` instance imported directly into stores |

---

## Data Layer

### Session model (`src/models/Session.ts`)
```typescript
export interface Session {
  id?: number;           // Dexie auto-increment
  startTime: number;     // Date.now() timestamp
  endTime: number;
  duration: number;      // seconds
  type: 'work' | 'break';
  completed: boolean;    // false if skipped
}
```

### Dexie schema (`src/db/database.ts`)
```typescript
import Dexie, { type Table } from 'dexie';
import type { Session } from '../models/Session';

class FlowDatabase extends Dexie {
  sessions!: Table<Session>;
  constructor() {
    super('flow');
    this.version(1).stores({
      sessions: '++id, startTime, type, completed',
    });
  }
}
export const db = new FlowDatabase();
```

### Settings hook (`src/hooks/useSettings.ts`)

Wraps `localStorage` with typed defaults. Settings keys match the macOS `@AppStorage` keys 1-to-1:
- `workDuration` (number, default 1500)
- `breakDuration` (number, default 300)
- `autoStartWork` (boolean, default false)
- `enableNotifications` (boolean, default true)
- `showQuotes` (boolean, default true)
- `overlayGradientIndex` (number, default 0)

### TimerPhase type (`src/models/TimerPhase.ts`)
```typescript
export type SessionType = 'work' | 'break';

export type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'onBreak' }
  | { kind: 'paused'; resumingTo: SessionType };
```

---

## Store Layer

### timerStore (`src/store/timerStore.ts`)

```typescript
interface TimerState {
  phase: TimerPhase;
  timeRemaining: number;   // seconds
  totalTime: number;
  completedWorkSessions: number;
  progress: number;        // 0–1, derived
  // actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
}
```

**Timer accuracy** — drift-corrected approach (never naive decrement):
```typescript
const TICK_MS = 250;
let intervalId: ReturnType<typeof setInterval> | null = null;
let expectedEndTime: number | null = null;

function startInterval() {
  intervalId = setInterval(() => {
    const remaining = Math.max(0, (expectedEndTime! - Date.now()) / 1000);
    useTimerStore.setState({ timeRemaining: remaining, progress: 1 - remaining / totalTime });
    if (remaining <= 0) handleSessionEnd();
  }, TICK_MS);
}
```

`handleSessionEnd()`:
1. Cancels interval
2. Writes completed `Session` to Dexie
3. Transitions `phase` (work → onBreak, onBreak → idle or working per `autoStartWork`)
4. Calls `notificationService.notify()`
5. Updates `document.title`

### statsStore (`src/store/statsStore.ts`)

Reads from Dexie via `useLiveQuery` hook, exposes:
- `todayWorkTime: number` (seconds)
- `todaySessionCount: number`
- `longestSession: number`
- `weeklyData: DayStat[]` — 7 entries, each `{ label: string; hours: number }`
- `monthlyData: MonthDay[]` — for calendar heatmap

---

## Component Layer

### ContentView (`src/components/ContentView.tsx`)

Single-page layout with three tabs rendered via React state (no router needed for this scale):
- Timer (default)
- Statistics (opens as modal sheet over timer)
- Settings (opens as modal sheet)

Tab bar uses SF Symbol equivalents from **Lucide React** (`timer`, `bar-chart-2`, `settings`).

### TimerView

Identical layout to macOS:
```
[session label: "Focus • Session 3"]
[CircularProgress — large SVG ring]
[time label: "24:13"]
[SessionControls — play/pause | skip | stop]
```

### CircularProgress (`src/components/timer/CircularProgress.tsx`)

SVG-based ring using `stroke-dasharray` / `stroke-dashoffset` (standard CSS technique, no Canvas needed):
```tsx
const circumference = 2 * Math.PI * radius;
const offset = circumference * (1 - progress);
<circle
  stroke="url(#progressGradient)"
  strokeDasharray={circumference}
  strokeDashoffset={offset}
  style={{ transition: 'stroke-dashoffset 0.25s linear' }}
/>
```
Work gradient: blue → indigo. Break gradient: green → teal. Matches macOS exactly.

### BreakOverlay (`src/components/break/BreakOverlay.tsx`)

Full-viewport fixed overlay — the web equivalent of `NSWindow` at `.screenSaver` level:
```tsx
<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
     style={{ background: GRADIENT_PRESETS[gradientIndex] }}>
  <BreakCountdown />
  <MotivationalQuote />
  <SkipButton className="absolute bottom-8 right-8 opacity-40 hover:opacity-100" />
</div>
```

**Fullscreen API**: On break start, attempt `document.documentElement.requestFullscreen()` if the user has previously interacted with the page. Silently ignored if permission is denied — the fixed overlay still covers the full viewport.

### StatisticsView

`TabView`-equivalent using segmented control (custom CSS tabs):
- **Day**: totals + `ActivityRing` SVG component
- **Week**: `<BarChart>` from Recharts, one `<Bar>` per day
- **Month**: `<LazyVGrid>` equivalent using CSS grid, colored cells by intensity

### SettingsView

HTML `<form>` using native `<input type="range">` for durations, `<input type="checkbox">` for toggles, 6 gradient swatch `<button>` elements. Saves to `localStorage` on every change via `useSettings`.

---

## Gradient Presets

Same 6 presets as macOS, expressed as CSS `linear-gradient` strings:

```typescript
export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #1a3a5c, #0d9488)',           // Ocean
  'linear-gradient(135deg, #f97316, #f43f5e, #a855f7)',  // Sunset
  'linear-gradient(135deg, #14532d, #6b9e6e)',            // Forest
  'linear-gradient(135deg, #1e3a5f, #4f46e5)',            // Dusk
  'linear-gradient(135deg, #0d9488, #22c55e, #3b82f6)',  // Aurora
  'linear-gradient(135deg, #0a0a1a, #3b0764)',            // Midnight
];
```

---

## Notification Service (`src/services/notificationService.ts`)

```typescript
export async function requestPermission(): Promise<void> {
  if ('Notification' in window) await Notification.requestPermission();
}

export function notifyWorkComplete(): void {
  if (Notification.permission === 'granted')
    new Notification('Flow', { body: 'Work session complete. Time for a break.' });
}

export function notifyBreakComplete(): void {
  if (Notification.permission === 'granted')
    new Notification('Flow', { body: 'Break complete. Ready to focus again?' });
}
```

Tab title updated on every tick: `document.title = \`\${formatTime(timeRemaining)} — \${label}\``.

---

## PWA Configuration

**`public/manifest.json`**:
```json
{
  "name": "Flow",
  "short_name": "Flow",
  "description": "Pomodoro timer with break enforcement",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**`vite.config.ts`** uses `@vite-pwa/vite-plugin` with Workbox `generateSW` strategy — caches all assets for offline use. The timer runs entirely in-browser with no network dependency.

---

## Build & Dev Commands

```bash
cd web
npm install
npm run dev          # Vite dev server, http://localhost:5173, HMR
npm run build        # Production build → web/dist/
npm run preview      # Preview production build locally
npm run typecheck    # tsc --noEmit (no emit, types only)
```

---

## Verification

1. `npm run dev` → open `localhost:5173`, verify timer UI renders
2. Start timer → let work session complete (temporarily set `workDuration = 5` in store) → verify break overlay covers full viewport
3. Allow notifications when prompted → verify browser notification fires on session end
4. Complete 2–3 sessions → open Statistics → verify bar chart and totals update
5. Change settings (duration, gradient) → verify persisted after page reload
6. `npm run build && npm run preview` → verify production build works identically
7. Open Chrome DevTools → Application → Service Workers → verify PWA registered
8. Disable network in DevTools (Offline mode) → verify timer still runs and sessions persist to IndexedDB
9. Install as PWA from Chrome address bar → verify app opens standalone (no browser chrome)
10. Verify `document.title` shows live countdown when app is in background tab

---

## File Count & Scope

~18 TypeScript/TSX files + config. Estimated ~1,400 lines. Full feature parity with the macOS plan. Deferred to v2: iCloud-equivalent sync (Supabase or Firebase), Siri/keyboard shortcuts, ambient sounds, session tags, Apple Watch (no web equivalent).
