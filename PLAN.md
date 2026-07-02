# Plan: Flow — Native macOS Pomodoro Timer App

## Context

Building a polished, Apple-HIG-aligned Pomodoro timer from scratch in the empty `/Users/bernstein/repos/flow/` directory. The app's key differentiator is a full-screen "break enforcement" overlay that appears when a work session ends, blocking productivity content and encouraging genuine rest. The app uses SwiftUI + SwiftData + Swift Charts as the primary Apple-native stack.

**Environment constraints discovered:**
- Swift 6.3 (CommandLineTools only — no full Xcode IDE installed yet)
- macOS 26 (arm64) — Apple's latest, allows newest APIs
- `swift build` works from CLI for compile-checking; Xcode is required to run the app
- **Action item for user before running:** Install Xcode from the App Store

---

## Project Scaffold

**Package.swift** — Swift Package Manager project, macOS 15+ minimum (ensures SwiftData stability, Swift Charts, latest SwiftUI).

```
flow/
├── Package.swift
└── Sources/
    └── Flow/
        ├── FlowApp.swift                  # @main App, ModelContainer, MenuBarExtra
        ├── Models/
        │   ├── Session.swift              # SwiftData @Model for recorded sessions
        │   └── TimerPhase.swift           # State machine enum
        ├── ViewModels/
        │   ├── TimerViewModel.swift       # Core timer engine (all state lives here)
        │   └── StatisticsViewModel.swift  # Aggregates sessions for charts
        ├── Views/
        │   ├── ContentView.swift          # Root: TimerView + toolbar buttons for Stats/Settings
        │   ├── Timer/
        │   │   ├── TimerView.swift
        │   │   ├── CircularProgressView.swift
        │   │   └── SessionControlsView.swift
        │   ├── Break/
        │   │   ├── BreakOverlayWindow.swift   # NSWindow subclass, level = .screenSaver
        │   │   └── BreakOverlayView.swift     # SwiftUI content inside overlay
        │   ├── Statistics/
        │   │   ├── StatisticsView.swift       # Tab container: Day / Week / Month
        │   │   └── ActivityRingView.swift     # Custom Canvas ring (Fitness-style)
        │   └── Settings/
        │       └── SettingsView.swift
        └── Services/
            └── NotificationService.swift
```

---

## Architecture

### Data Layer

**Session.swift** — SwiftData `@Model`, records every completed session:
```swift
@Model final class Session {
    var id: UUID
    var startTime: Date
    var endTime: Date
    var duration: TimeInterval    // seconds
    var type: String              // "work" | "break"
    var completed: Bool           // false if skipped early
}
```

**Settings** — stored via `@AppStorage` (UserDefaults, not SwiftData — no migration needed):
- `workDuration: Double` = 1500 (25 min)
- `breakDuration: Double` = 300 (5 min)
- `autoStartWork: Bool` = false
- `enableNotifications: Bool` = true
- `showQuotes: Bool` = true
- `overlayGradientIndex: Int` = 0

**TimerPhase.swift**:
```swift
enum TimerPhase: Equatable, Sendable {
    case idle
    case working
    case onBreak
    case paused(resumingTo: SessionType)
}
enum SessionType: String, Sendable { case work, breakTime }
```

### ViewModel Layer

**TimerViewModel** (`@MainActor`, `ObservableObject`) — the entire timer engine:
- `@Published phase: TimerPhase`
- `@Published timeRemaining: TimeInterval`, `totalTime: TimeInterval`
- `@Published completedWorkSessions: Int`
- `var progress: Double { 1 - timeRemaining / totalTime }`
- `var modelContext: ModelContext?` (injected from environment)

Timer loop uses `Task` + `Task.sleep` (wall-clock accurate, survives app backgrounding):
```swift
private func runLoop() {
    timerTask = Task {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            tick()
        }
    }
}
```

On session end (`timeRemaining == 0`):
- Saves `Session` to SwiftData
- Transitions phase (work → break or break → idle/work)
- Shows/hides `BreakOverlayWindow`
- Fires `NotificationService`

Methods: `start()`, `pause()`, `resume()`, `skip()`, `stop()`

**StatisticsViewModel** (`@MainActor`, `ObservableObject`):
- Takes `[Session]` via `@Query` passed in from parent view
- Computes: todayWorkTime, todaySessionCount, longestSession, weeklyData (7-day array), monthlyData
- weeklyData returns `[DayStat]` structs used directly by Swift Charts

### View Layer

**ContentView** — single window with `TimerView` as primary content; toolbar contains SF Symbol buttons opening Statistics and Settings as `.sheet` modals.

**TimerView** — centered layout:
```
[session label: "Focus • Session 3"]
[CircularProgressView — large ring]
[time label: "24:13"]
[SessionControlsView — play/pause | skip | stop]
```

**CircularProgressView** — `Canvas`-based arc:
- Draws a full background ring (gray, thin)
- Draws a progress arc using `Path.addArc`, stroked with a `.linearGradient`
- Work phase: blue → indigo gradient; Break phase: green → teal
- Animated with `.animation(.linear(duration: 1), value: progress)`

**BreakOverlayWindow** — NSWindow subclass shown/hidden by TimerViewModel:
```swift
class BreakOverlayWindow: NSWindow {
    init(timerVM: TimerViewModel) {
        super.init(contentRect: NSScreen.main!.frame,
                   styleMask: [.borderless], backing: .buffered, defer: false)
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isOpaque = false; backgroundColor = .clear
        isReleasedWhenClosed = false
        contentView = NSHostingView(rootView: BreakOverlayView().environmentObject(timerVM))
    }
}
```

**BreakOverlayView** — full-screen SwiftUI content:
- Dynamic gradient background (6 built-in presets; see below)
- Large countdown timer
- Motivational quote (rotated each break, ~20 quotes embedded)
- "Skip Break" button (calls `timerVM.skip()`) — subtle, bottom-right corner
- Fade-in/out animation on appear

**StatisticsView** — `TabView` with `.tabViewStyle(.segmentedControlTab)`:
- **Day tab**: today's total focus time, session count, longest session; `ActivityRingView` showing daily goal progress
- **Week tab**: Swift Charts `BarMark` chart, one bar per day, y = hours focused
- **Month tab**: calendar grid with color intensity per day (heat map via `LazyVGrid`)

**ActivityRingView** — custom `Canvas` drawing two concentric arcs (focus time ring + session count ring), modeled after Fitness app rings.

**SettingsView** — `Form` with:
- `Stepper` for work/break duration (5-min increments, range 5–120 min / 1–60 min)
- `Toggle` for auto-start next work session
- `Toggle` for notifications
- `Toggle` for motivational quotes
- Gradient picker (6 swatch buttons for overlay gradient)

**MenuBarExtra** (in FlowApp.swift):
```swift
MenuBarExtra {
    MenuBarContentView().environmentObject(timerVM)
} label: {
    Label(timerVM.menuBarTitle, systemImage: timerVM.menuBarIcon)
}
.menuBarExtraStyle(.window)
```
Shows mini countdown + play/pause button in menu bar popover.

### Services

**NotificationService** — wraps `UNUserNotificationCenter`:
- `requestPermission()` — called on first launch
- `notifyWorkComplete()` — "Time for a break!"
- `notifyBreakComplete()` — "Ready to focus again?"
- **Entitlement note:** User must add "App Sandbox" + "User Notifications" capability in Xcode Signing & Capabilities after opening the package.

---

## Gradient Presets (Break Overlay "Wallpapers")

Six built-in `LinearGradient` presets — no image assets needed, scales perfectly:

| Index | Name | Colors |
|-------|------|--------|
| 0 | Ocean | deep blue → teal |
| 1 | Sunset | orange → rose → purple |
| 2 | Forest | dark green → sage |
| 3 | Dusk | navy → indigo |
| 4 | Aurora | teal → green → blue |
| 5 | Midnight | near-black → deep purple |

User can additionally select any system color as a custom gradient.

---

## Swift 6 Concurrency Notes

- All ViewModels are `@MainActor` — no cross-actor mutation issues
- `Session` model needs `@Model` (SwiftData handles Sendable internally)
- `NotificationService` methods are `async`, called with `Task { await ... }`
- `BreakOverlayWindow` manipulation happens on `MainActor` (AppKit requirement satisfied)

---

## FlowApp.swift Structure

```swift
@main struct FlowApp: App {
    @StateObject private var timerVM = TimerViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(timerVM)
        }
        .modelContainer(for: Session.self)
        .commands { /* keyboard shortcuts */ }

        MenuBarExtra { ... } label: { ... }
    }
}
```

`modelContext` is pulled from `.environment(\.modelContext)` in `ContentView` and passed to `timerVM` via `onAppear`.

---

## Verification

1. **Compile check** (no Xcode needed): `cd /Users/bernstein/repos/flow && swift build`
2. **Install Xcode** from App Store → open `Package.swift` → Xcode auto-creates a scheme
3. **Add entitlements** in Xcode: Signing & Capabilities → + Capability → App Sandbox + Notifications
4. **Run** (⌘R) — verify timer starts, counts down, pauses/resumes
5. **Break overlay test**: temporarily set workDuration to 5 seconds in code, let it expire — verify full-screen overlay appears above all other apps
6. **Statistics test**: complete 2–3 sessions, open Statistics, verify counts and chart bars
7. **Menu bar test**: verify icon appears, shows countdown, play/pause works
8. **Notifications test**: approve prompt on first launch, let session end, verify system notification appears

---

## File Count & Scope

16 Swift source files + Package.swift. Estimated ~1,600 lines of production-quality SwiftUI/Swift. Covers all core requirements. Deferred to v2: iCloud sync, Apple Watch, Widgets, Siri Shortcuts, ambient sounds, session tags.
