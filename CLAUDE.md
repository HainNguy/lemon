# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Teaching Session

This project is being built as a guided lesson for a CS student with no prior web development experience.

### Phase 1 — Build ✅
Implement the web PWA exactly as specced in `PLAN-WEB.md`. No explanations during this phase — just a working app.

### Phase 2 — Teach (TODO)
Walk through the entire project as a university-style lecture series:
- Ground up: browser, HTML/CSS/JS, Node.js/npm, TypeScript
- Why each tool was chosen (React vs plain JS, Zustand vs Redux, Dexie vs localStorage, Tailwind vs plain CSS)
- Every file: what it does, why it's structured that way, how it connects
- Mental models: component trees, state management, reactivity, async/await, the module system
- Gotchas a beginner will hit when building their own project

**Student background:** Solid CS fundamentals (data structures, algorithms, OOP), zero hands-on web experience. Use analogies to CS concepts already known. Check for understanding before moving to the next major concept.

---

## Project Overview

**Flow** is a Pomodoro timer app. The web PWA is fully implemented under `web/`. A native macOS implementation is planned but not yet started.

- **Web PWA** (`web/`) — React 19 + Vite + Zustand + Dexie.js + Tailwind CSS v4 — **built and running**
- **Native macOS** (`Sources/Flow/`) — SwiftUI + SwiftData + Swift Charts, macOS 15+, Swift 6.3 — **not yet implemented**

The key differentiator is a full-screen "break enforcement" overlay that covers the viewport during breaks.

## Build & Run Commands

### Web (active)
```bash
cd web
npm install --legacy-peer-deps   # recharts 2.x has a React 19 peer dep warning
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # Production build → web/dist/
npm run preview      # Preview production build locally
npm run typecheck    # tsc --noEmit
```

### Native macOS (not yet implemented)
```bash
swift build          # compile-check (no Xcode required)
```
To run the app, open `Package.swift` in Xcode → add entitlements (App Sandbox + User Notifications) → ⌘R.

## Web Architecture

### File Structure
```
web/src/
├── main.tsx                        # React root
├── App.tsx                         # Mounts ContentView
├── index.css                       # @import "tailwindcss" + body reset
├── constants/gradients.ts          # 6 break overlay gradient presets
├── models/
│   ├── Session.ts                  # TypeScript interface for Dexie records
│   └── TimerPhase.ts               # Discriminated union: idle|working|onBreak|paused
├── db/database.ts                  # Dexie (IndexedDB) schema
├── hooks/useSettings.ts            # localStorage wrapper, typed Settings interface
├── services/notificationService.ts # Web Notifications API
├── store/
│   ├── timerStore.ts               # Zustand store + drift-corrected setInterval engine
│   └── statsStore.ts               # useLiveQuery hook over Dexie sessions
└── components/
    ├── ContentView.tsx             # Root layout, bottom tab bar (Timer/Stats/Settings)
    ├── timer/
    │   ├── TimerView.tsx
    │   ├── CircularProgress.tsx    # SVG arc with stroke-dashoffset animation
    │   └── SessionControls.tsx     # Play/Pause/Skip/Stop buttons
    ├── break/BreakOverlay.tsx      # fixed inset-0 z-[9999] overlay, shown on onBreak
    ├── statistics/
    │   ├── StatisticsView.tsx      # Day/Week/Month tabs, Recharts bar chart, heatmap
    │   └── ActivityRing.tsx        # SVG concentric progress rings
    └── settings/SettingsView.tsx   # Duration inputs, toggles, gradient picker
```

### Key Design Decisions

**Timer engine** — lives outside Zustand in module-level variables (`intervalId`, `expectedEndTime`, `sessionStartTime`). The 250ms `setInterval` computes remaining time as `(expectedEndTime - Date.now()) / 1000` for drift correction. Only `timeRemaining` and `progress` are written to the store on each tick.

**Settings** — `useSettings` hook reads/writes `localStorage`. The timer store reads settings directly from `localStorage` at session boundaries (not from React state), so settings don't need to flow through React to the store.

**Break overlay** — `BreakOverlay` is always in the React tree; returns `null` when `phase.kind !== 'onBreak'`. When active, `position: fixed; inset: 0; z-index: 9999` covers the full viewport.

**Session persistence** — fire-and-forget `db.sessions.add(...)` calls (no `await`) so state transitions are immediate. `statsStore` uses Dexie's `useLiveQuery` which re-renders automatically when IndexedDB changes.

**Duration inputs** — `SettingsView` uses a controlled `<input type="number">` with a local `draft` state. Value commits on `blur` or `Enter`, clamped to valid range. Invalid input (NaN) is silently discarded.

### Native → Web Mapping
| macOS Native | Web Equivalent |
|---|---|
| `@Model class Session` (SwiftData) | `Session` interface + Dexie `Table<Session>` (IndexedDB) |
| `@AppStorage` (UserDefaults) | `localStorage` via `useSettings` hook |
| `ObservableObject` + `@Published` | Zustand store |
| `Task.sleep` timer loop | drift-corrected `setInterval` (250ms) |
| `NSWindow` level `.screenSaver` | `position: fixed; inset: 0; z-index: 9999` div |
| `UNUserNotificationCenter` | Web Notifications API |
| `Swift Charts BarMark` | Recharts `<BarChart>` |
| `Canvas` / `Path.addArc` | SVG `stroke-dasharray` / `stroke-dashoffset` |
| `MenuBarExtra` | `document.title` live countdown |

## Environment Constraints

- macOS 26 (arm64)
- Swift 6.3 (CommandLineTools only — no full Xcode). `swift build` works; running requires Xcode from the App Store.
- Package.swift targets macOS 15+ minimum (required for SwiftData stability).
- `recharts@2.x` requires `--legacy-peer-deps` with React 19 (peer dep warning only, not a runtime issue).

## Swift 6 Concurrency (for future native impl)

All ViewModels are `@MainActor`. `NotificationService` methods are `async`, called via `Task { await ... }`. `BreakOverlayWindow` AppKit manipulation happens on `MainActor`. SwiftData handles `Sendable` internally for `@Model` types.
