# Flow — Lecture Notes

We're building up an understanding of the Flow app from absolute zero.
No prior web knowledge assumed. Every concept is explained before it's used.
Open the referenced files in your editor as you read — the code is the textbook.

---

## Lecture 0: How Software Is Designed

Before we look at any code, it's worth understanding *how* the Flow app was designed in the
first place — because the design process is more important than any individual tool or file.

### The Central Idea: Abstraction Layers

Think about how a car is designed. The car designer doesn't need to know how to manufacture a
spark plug. They just need to know the engine *needs* spark plugs and roughly what they do.
The spark plug engineer handles the details. The designer works at a higher level.

Software is designed the same way. You work from the top down:

```
What does the app need to DO?
        ↓
What are the big moving parts?
        ↓
What does each part need to know and produce?
        ↓
How does each part actually work internally?
```

You answer each question fully before moving to the next. The details of the bottom layer
don't need to exist yet when you're designing the top layer.

### Step 1: Start With What the App Needs to Do

Before a single line of code, the design started with a plain-English list of features:

- A timer that counts down work sessions and break sessions
- A circular progress ring that animates as time passes
- A full-screen overlay during breaks that can't easily be dismissed
- Session history that persists between page reloads
- Settings that are remembered across sessions
- Notifications when a session ends
- Works offline, installable on your phone

Notice: written entirely in terms of *user experience*. No mention of React, SVG, or
IndexedDB. The technical decisions come later.

### Step 2: Identify the Big Moving Parts

Once you know what the app needs to do, the natural divisions appear — each "box" has one
clear job:

| Box | Job |
|---|---|
| **Timer engine** | Count down; handle when time runs out |
| **State store** | Remember the timer's current phase; share it with any component that needs it |
| **Database** | Save completed sessions; let the stats view query them |
| **Settings** | Remember user preferences across page reloads |
| **Components** | Draw the UI based on what the store says |
| **Notification service** | Send browser notifications at the right moments |

Each box has a clear *boundary* — you can describe what goes in and what comes out without
knowing how it works inside. That boundary is called an **interface**. This is the same
concept as interfaces and abstract classes in OOP — define the contract, fill in the
implementation later.

### Step 3: Map the Problem, Don't Reinvent It

The most powerful technique used here: a native macOS version of Flow already existed.
Instead of designing the web version from scratch, every macOS concept was mapped to its
web equivalent. Open `PLAN-WEB.md` and you'll see this table:

| macOS | Web equivalent |
|---|---|
| SwiftData (sessions on disk) | IndexedDB via Dexie |
| UserDefaults (settings) | localStorage |
| `ObservableObject` (shared state) | Zustand store |
| `NSWindow` at screen-saver level | `position: fixed; z-index: 9999` div |
| Swift Charts bar chart | Recharts bar chart |
| Canvas arc drawing | SVG with `stroke-dashoffset` |

The design didn't require knowing *how* `stroke-dashoffset` works. It only required knowing
that "SVG can draw arcs" — a one-line fact you look up. The details get filled in when you
actually sit down to implement that one component.

### Step 4: Design Interfaces, Not Implementations

Next came defining what data flows *between* the boxes — without deciding how any box works
internally.

For example, the `Session` model was designed as a list of fields before any database code
existed. The question was simply: "When a session ends, what do I want to remember?"

```ts
interface Session {
  id?: number;
  startTime: number;
  endTime: number;
  duration: number;
  type: 'work' | 'break';
  completed: boolean;
}
```

Same for `TimerPhase` — it was designed as a discriminated union before any timer logic
existed. The question: "What states can the timer be in, and what extra information does
each state carry?" That can be answered without knowing anything about `setInterval`.

The interfaces came first. The implementations followed.

### Step 5: The File Structure Follows the Boxes

Once the boxes and interfaces were defined, the file structure fell out naturally:

```
models/     ← the shapes of data (Session, TimerPhase)
store/      ← shared state (timer, stats)
db/         ← database layer
hooks/      ← settings
components/ ← the UI
services/   ← notifications
```

One folder per box. A developer reading this structure knows where to find anything without
reading a single line of code.

### The Key Insight: "Good Enough to Start"

At no point during design did anyone need to know how `stroke-dashoffset` animates a circle,
how Dexie queries IndexedDB, or how a service worker enables offline support. Those are
**implementation details** — they only matter when you sit down to write that specific file.

During design, you only need to know a thing *is possible* and roughly what it costs. That
knowledge comes from experience. A designer who has built apps before can say "SVG can draw
circles" without stopping to research it. A first-time builder would spend hours on this at
design time. That's normal — and it's exactly what this lecture series is building toward.

### Where to See This in the Repo

Open `PLAN-WEB.md`. Notice the structure:
1. **Stack decisions** — tools chosen and *why*, one sentence each
2. **Native → Web mapping** — the translation table, no implementation detail
3. **Data layer** — interfaces only, no logic
4. **Store layer** — state shape and the *what* of the timer, not the *how*
5. **Component layer** — described in English, one key line of code only where non-obvious
6. **Verification** — a checklist for confirming everything works

The entire plan is written at just enough detail to start coding — not a line more. That's
intentional. Over-specifying wastes time because implementation always reveals things the
plan couldn't predict.

### One-Sentence Summary

Design top-down — describe *what* each piece does before deciding *how* it does it — and
you can plan an entire app without knowing any implementation details, because the details
live *inside* the boxes, not between them.

---

## Lecture 1: What Does a Browser Actually Do?

### The Browser is a Program That Reads Files

You use a browser every day, but let's think about what it actually *is*.

A browser (Chrome, Safari, Firefox) is a program on your computer. When you visit a website, the
browser downloads a bunch of files from a server — the same way you'd download a zip file, except
the browser reads those files and *draws something on your screen* based on them.

There are three types of files a browser knows how to read:

| File type | What it's for | Plain English |
|---|---|---|
| `.html` | Structure | A list of "what's on this page" |
| `.css` | Appearance | Rules for how things should look |
| `.js` | Behaviour | Instructions that run when the user does something |

Think of building a house:
- **HTML** is the blueprint — it says "there's a door here, a window there, a kitchen in this room"
- **CSS** is the interior design — "paint the walls blue, make the door 2 metres tall"
- **JavaScript** is the electricity — "when you flip this switch, that light turns on"

### HTML: Describing What's On the Page

HTML uses **tags** to describe pieces of content. A tag looks like a word wrapped in angle brackets:

```html
<p>This is a paragraph of text.</p>
<button>Click me</button>
<div>This is a box that groups things together</div>
```

Tags come in pairs: an opening tag `<p>` and a closing tag `</p>`. Everything between them is
the content of that element. An **element** is just one of these tag-and-content pairs.

Elements can be nested inside each other, which creates a **tree structure**:

```html
<div>
  <p>Hello</p>
  <button>Click</button>
</div>
```

Visualised as a tree:
```
div
├── p ("Hello")
└── button ("Click")
```

The browser reads this HTML and builds that tree in memory. This tree is called the **DOM**
(Document Object Model). Every element on the page is a node in that tree. The browser then
draws each node on screen.

### What Happens When You Open a Website

1. You type a URL and press Enter
2. The browser asks a server for a file (usually `index.html`)
3. The browser reads the HTML and builds the DOM tree
4. If the HTML mentions a CSS file, the browser fetches that and applies styles to each node
5. If the HTML mentions a JavaScript file, the browser fetches that and runs it
6. JavaScript can add, remove, or change nodes in the DOM tree — and the browser redraws whatever changed

That last point is the key to everything. JavaScript can *change the page after it loads*, which
is how interactive websites work — the timer counting down, the tab switching, the break overlay
appearing — all of that is JavaScript changing the DOM.

### The Entry Point of This App (`web/index.html`)

Open `web/index.html`. Here's what it contains:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#000000" />
    <title>Flow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Notice how empty this is. There's no timer, no buttons, no tab bar — just one `<div id="root">`
and a `<script>` tag. The script tag tells the browser "run this JavaScript file." That JavaScript
file (eventually) builds the entire UI. We'll see exactly how in Lecture 2.

A few things worth noting:
- `<head>` holds metadata about the page — stuff the browser needs to know but doesn't display
- `<body>` holds the visible content
- `id="root"` is a label on the div so JavaScript can find it later by name
- `<!DOCTYPE html>` at the very top just tells the browser "this is a modern HTML file"

---

## Lecture 2: Why React Exists

### The Problem: Keeping the Screen in Sync

Imagine you're building the Flow timer with nothing but plain JavaScript. You'd start by writing
HTML for the timer display and a start button:

```html
<div id="timer-display">25:00</div>
<button id="start-btn">Start</button>
```

Then JavaScript to make it count down:

```js
let secondsLeft = 1500;

document.getElementById('start-btn').addEventListener('click', function() {
  setInterval(function() {
    secondsLeft = secondsLeft - 1;
    document.getElementById('timer-display').textContent = formatTime(secondsLeft);
  }, 1000);
});
```

Let's unpack this:
- `document.getElementById('timer-display')` — finds the div with that id in the DOM tree
- `.textContent = ...` — changes the text inside it
- `addEventListener('click', ...)` — "when this button is clicked, run this function"
- `setInterval(fn, 1000)` — run this function every 1000 milliseconds (every second)

This works fine for a simple countdown. But now your product manager asks for new features:

- When the timer hits zero, show a break screen
- Add a pause button that changes to a resume button when paused
- Add a tab bar — when you click Stats, hide the timer and show a chart
- Add a full-screen overlay during breaks that covers everything
- Update the browser tab title with the remaining time
- Save each completed session to a database

Now you have dozens of places where you're manually reaching into the DOM and updating specific
elements. And here's the problem: **every piece of data lives in two places** — your JavaScript
variables AND the DOM. When `secondsLeft` changes, you have to remember to update every element
that displays or depends on it. Miss one, and the screen shows the wrong thing.

In a real app with hundreds of features, this becomes impossible to maintain. Bugs are everywhere
and they're nearly impossible to track down.

### React's Answer: Describe, Don't Command

React flips the whole model.

Instead of saying "find the timer element and change its text," you just describe what the screen
should look like right now, and React figures out what to change in the DOM.

The core idea is: **your UI is a function of your data.**

```
data → React → screen
```

Every time your data changes, React re-runs your description, compares it to what's currently on
screen, and applies the minimum set of changes needed. You never touch the DOM yourself.

Here's the same timer display written as a React **component**:

```jsx
function TimerDisplay({ secondsLeft }) {
  return <div>{formatTime(secondsLeft)}</div>;
}
```

When `secondsLeft` changes, React automatically re-runs this function and updates the div. You
don't write any update code — you only write the description.

### What is a Component?

A **component** is just a JavaScript function that returns a description of some UI. That's it.

```jsx
function Greeting() {
  return <div>Hello, world</div>;
}
```

You use components like custom HTML tags:

```jsx
<Greeting />
```

Components can receive data as input — these inputs are called **props** (short for properties):

```jsx
function Greeting({ name }) {
  return <div>Hello, {name}</div>;
}

// used like:
<Greeting name="Kyle" />
```

The `{name}` inside the HTML-looking code is where you drop in a JavaScript value. Curly braces
mean "evaluate this as JavaScript."

**One rule:** Component names must start with a capital letter. `<greeting />` would be treated
as a regular HTML tag. `<Greeting />` is a component.

### What is JSX?

The HTML-looking code inside JavaScript functions has a name: **JSX**. It's not real HTML — it's
a shorthand that gets converted to plain JavaScript before the browser ever sees it.

```jsx
// What you write (JSX):
<div className="timer">25:00</div>

// What it becomes (plain JavaScript):
React.createElement("div", { className: "timer" }, "25:00")
```

`React.createElement` creates a lightweight JavaScript object that *describes* a DOM node.
React collects all these descriptions into a tree, compares it to the previous tree, and only
updates the real DOM where something changed.

Two things that look different from regular HTML:
- Use `className` instead of `class` (because `class` is a reserved word in JavaScript)
- Event handlers are camelCase: `onclick` → `onClick`

### The Component Tree

Components nest inside each other, forming a tree — exactly like HTML elements:

```
<App>
  └── <ContentView>
        ├── <BreakOverlay>
        ├── <TimerView>
        │     ├── <CircularProgress>
        │     └── <SessionControls>
        ├── <StatisticsView>
        └── <SettingsView>
```

The root of the tree is `<App />`. Every component you see on screen is a node in this tree.
React renders the tree top-down: it calls `App()`, which returns `<ContentView />`, so React
calls `ContentView()`, and so on until the whole tree is resolved into real DOM elements.

### State: Data That Can Change

Not all data is static. The current tab, the seconds remaining, whether the timer is paused —
these change over time. In React, changing data is called **state**.

You declare state using `useState`:

```jsx
const [tab, setTab] = useState('timer');
```

This gives you two things:
- `tab` — the current value (`'timer'` to start)
- `setTab` — a function to change it

When you call `setTab('stats')`, React:
1. Updates the stored value to `'stats'`
2. Re-runs your component function
3. Produces a new description of the UI
4. Compares it to the old description
5. Updates only the DOM nodes that changed

The Stats view appears, the Timer view disappears — and you didn't write a single "find this
element and hide it" instruction.

### Exercise 2.1 — Trace a Tab Switch

Open `web/src/components/ContentView.tsx` and find these lines (around line 41):

```jsx
{tab === 'timer' && <TimerView />}
{tab === 'stats' && <StatisticsView />}
{tab === 'settings' && <SettingsView settings={settings} update={update} />}
```

`{tab === 'timer' && <TimerView />}` means: if `tab` equals `'timer'`, show `<TimerView />`.
Otherwise, show nothing. (`&&` is the "and" operator — if the left side is false, the right side
is never evaluated.)

**Your task:** Trace step by step what happens when a user clicks the Stats tab button. Start
from the click, end with what appears on screen. Write it out in plain English before reading on.

### The Mount Point (`web/src/main.tsx`)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Line by line:
- `import` — bring in code from another file or library (more on this in Lecture 4)
- `document.getElementById('root')` — find that empty `<div id="root">` from `index.html`
- `createRoot(...)` — tell React "you're in charge of this div"
- `.render(<App />)` — build the component tree starting from `<App />` and put it in that div
- `<StrictMode>` — a development helper that runs your components twice to catch bugs early;
  has zero effect when the app is deployed to users

After this one file runs, React owns everything inside `<div id="root">`. Open the browser
DevTools (right-click → Inspect), find `<div id="root">` and expand it — you'll see React built
a whole tree of HTML elements inside that single empty div.

### Exercise 2.2 — See React's Output

Run `npm run dev` in the `web/` folder. Open the app in your browser. Right-click anywhere on
the page and choose "Inspect" (or "Inspect Element"). In the panel that opens, find the Elements
tab. Look for `<div id="root">` and expand it.

**Your task:** Find the element that shows the timer numbers (like "25:00"). How many levels deep
is it nested from `<div id="root">`? What tags wrap it?

---

## Lecture 3: TypeScript — JavaScript With a Safety Net

### The Problem With JavaScript

JavaScript is very relaxed about data types. A type is just what *kind* of thing a value is —
a number, a piece of text, true/false, etc.

In JavaScript, you can do things like this and get no error:

```js
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return minutes + ':' + (seconds % 60);
}

formatDuration(1500);      // "25:0"  — works
formatDuration("1500");    // "25:0"  — accidentally works (JavaScript guessed)
formatDuration(undefined); // "NaN:NaN" — broken, but no error message
formatDuration();          // "NaN:NaN" — broken, but no error message
```

JavaScript just tries its best and gives you a wrong answer instead of telling you something went
wrong. In a timer app this is annoying. In a banking app it's catastrophic.

### TypeScript: Catching Mistakes Before They Happen

**TypeScript** is JavaScript with types added. You tell TypeScript what type each value should be,
and it checks your code *before* it runs — at the moment you save the file.

```ts
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes + ':' + (seconds % 60);
}

formatDuration(1500);      // fine
formatDuration("1500");    // ERROR — caught immediately, before you even run the app
formatDuration();          // ERROR — caught immediately
```

The `: number` after `seconds` means "this parameter must be a number." The `: string` after
the closing parenthesis means "this function returns a string." TypeScript verifies both.

Browsers don't understand TypeScript — they only understand plain JavaScript. So TypeScript is
compiled (converted) to JavaScript before the browser sees it. Think of it as a spell-checker
that runs before you send the email.

### Basic Types

Here are the types you'll see most often:

```ts
let age: number = 17;
let name: string = "Kyle";
let isRunning: boolean = false;
```

For a list of things, add `[]` after the type:

```ts
let scores: number[] = [95, 87, 100];
let names: string[] = ["Alice", "Bob"];
```

For functions, you annotate each parameter and the return value:

```ts
//              input type    return type
function double(n: number): number {
  return n * 2;
}
```

### Interfaces: Describing the Shape of an Object

An **interface** defines what fields an object must have and what types those fields are.

Here's the real `Session` interface from this app (`web/src/models/Session.ts`):

```ts
export interface Session {
  id?: number;
  startTime: number;
  endTime: number;
  duration: number;
  type: 'work' | 'break';
  completed: boolean;
}
```

This says: any `Session` object must have `startTime` (a number), `endTime` (a number),
`duration` (a number), `type` (either the text `'work'` or the text `'break'`), and
`completed` (true or false).

The `?` on `id` means it's optional — it can be missing. That's because the database
auto-generates the id when you save a session, so you don't have it yet when you create one.

If you try to create a `Session` object with the wrong shape, TypeScript stops you immediately.

**Exercise 3.1:** Which of these objects match the `Session` interface? Reason through each one:

```ts
// A
{ startTime: 1000, endTime: 2500, duration: 1500, type: 'work', completed: true }

// B
{ id: 1, startTime: 1000, endTime: 2500, duration: 1500, type: 'WORK', completed: true }

// C
{ id: 2, startTime: 1000, endTime: 2500, duration: "1500", type: 'break', completed: false }
```

### String Literal Unions: Exact Allowed Values

Look at the `type` field from the interface above: `'work' | 'break'`

The `|` means "or". This field can only be exactly the text `'work'` or exactly the text
`'break'`. Not `'WORK'`, not `'rest'`, not any other string. TypeScript will reject anything else.

This is much safer than just using `string`, which would accept literally any text.

This pattern has a name: a **string literal union**. You'll see it everywhere in this app.

```ts
// This is a named string literal union type:
type SessionType = 'work' | 'break';

let s: SessionType = 'work';   // fine
let s: SessionType = 'break';  // fine
let s: SessionType = 'lunch';  // ERROR
```

### Discriminated Unions: One Type, Many Shapes

#### The Problem They Solve

Imagine representing a **traffic light** in code. A traffic light is always in exactly one state:
red, yellow, or green. It can never be two at once.

A beginner might use three separate boolean variables:

```ts
let isRed = true;
let isYellow = false;
let isGreen = false;
```

Nothing in the language prevents this from happening:

```ts
let isRed = true;
let isYellow = true;  // red AND yellow simultaneously?
let isGreen = true;   // all three at once?
```

Your code is now in an **impossible state** — something that can't exist in reality, but your
program allows it. You'd have to manually check for contradictions everywhere. This gets messy
fast and is a common source of bugs.

#### The Fix: One Variable, One State at a Time

What if one variable held the entire state?

```ts
type TrafficLight = 'red' | 'yellow' | 'green';

let light: TrafficLight = 'red';
```

A variable can only hold one value at a time — so `'red'` and `'green'` simultaneously is
impossible by definition. Cleaner, but what if different states need to carry different data?

#### Different States, Different Data

Think about a **vending machine**. It goes through states, and each state has different
information attached to it:

- **Idle** — no transaction, nothing to track
- **Item selected** — need to know *which item* was picked
- **Payment pending** — need to know which item AND *how much is owed*
- **Dispensing** — need to know which item is being given out

With separate variables:

```ts
let isIdle = false;
let isItemSelected = true;
let selectedItem = 'B4';
let isPaymentPending = false;
let amountOwed = 0;
```

Five variables, all prone to contradicting each other. `amountOwed` having a value when
`isPaymentPending` is false makes no sense — but nothing stops it.

A **discriminated union** solves this:

```ts
type VendingState =
  | { kind: 'idle' }
  | { kind: 'itemSelected';    item: string }
  | { kind: 'paymentPending';  item: string; amountOwed: number }
  | { kind: 'dispensing';      item: string };
```

Now one variable holds the whole state, each variant carries exactly the fields that make sense
for it, and impossible combinations literally cannot be written:

```ts
let state: VendingState = { kind: 'idle' };
state = { kind: 'itemSelected', item: 'B4' };
state = { kind: 'paymentPending', item: 'B4', amountOwed: 1.50 };

// This is a compile-time error — 'amountOwed' doesn't exist on 'idle':
state = { kind: 'idle', amountOwed: 1.50 };  // ERROR
```

The `kind` field is called the **discriminant** — the tag that tells you which variant you have.
That's where the name "discriminated union" comes from.

#### The `switch` Statement Becomes Airtight

The real payoff is handling each state. TypeScript reads your `switch` and narrows the type
inside each `case` — it knows exactly which fields exist:

```ts
function display(state: VendingState): string {
  switch (state.kind) {
    case 'idle':
      return 'Welcome! Make a selection.';

    case 'itemSelected':
      return `You selected ${state.item}. Insert payment.`;
      //                    ^^^^^^^^^^
      //  TypeScript knows this field exists here

    case 'paymentPending':
      return `Insert $${state.amountOwed} for ${state.item}.`;
      //                ^^^^^^^^^^^^^^^^        ^^^^^^^^^^^
      //  Both fields exist here — TypeScript verified

    case 'dispensing':
      return `Dispensing ${state.item}...`;
  }
}
```

If you try to access `state.amountOwed` inside the `'idle'` case, TypeScript gives an error
immediately — in your editor, before you run anything. And if you add a new variant to the union
but forget to add a `case` for it in the `switch`, TypeScript warns you. You cannot forget a
case by accident.

#### Now Look at the Actual App

Open `web/src/models/TimerPhase.ts`:

```ts
export type SessionType = 'work' | 'break';

export type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'onBreak' }
  | { kind: 'paused'; resumingTo: SessionType };
```

The Flow timer has four states. Three carry no extra data — just knowing which state you're in
is enough. But `paused` needs one extra piece: when the user unpauses, should the timer resume
a work session or a break session? That's what `resumingTo` captures.

`resumingTo` only exists on `paused`. It makes no sense on `idle` or `working`. The type makes
that rule automatic and enforced — you can't accidentally set it on the wrong variant.

Now open `web/src/components/timer/TimerView.tsx`, lines 11–17:

```ts
const isBreak = phase.kind === 'onBreak';
const isPaused = phase.kind === 'paused';

const sessionLabel = isBreak
  ? 'Break'
  : isPaused
  ? (phase.resumingTo === 'break' ? 'Break — Paused' : 'Focus — Paused')
  : `Focus • Session ${completedWorkSessions + 1}`;
```

On the line `phase.resumingTo === 'break'` — this is only reached when `isPaused` is true,
meaning `phase.kind === 'paused'`. TypeScript follows that logic and knows that at that point
`phase` must be the `paused` variant, so `.resumingTo` is safe to access. Try to access it in
the `isBreak` branch and TypeScript gives an error — even though it's the same variable.

#### Exercise 3.2 — Design Your Own

**Don't write code yet — just think on paper.**

A music player has these states:
- Stopped — no song loaded
- Playing — a song is playing; you know which song and how many seconds in
- Paused — frozen at a position; same info as playing
- Buffering — loading a song; you know which song but not the position yet

Design a discriminated union for this. For each variant, decide the `kind` label and which extra
fields (if any) it needs. Write it out before reading the answer.

---

**One possible answer:**

```ts
type PlayerState =
  | { kind: 'stopped' }
  | { kind: 'playing';   songId: string; positionSeconds: number }
  | { kind: 'paused';    songId: string; positionSeconds: number }
  | { kind: 'buffering'; songId: string };
```

`positionSeconds` doesn't belong on `buffering` — you're still loading, the position isn't known.
`songId` appears on three variants because you always know *which* song you're dealing with, just
not when stopped.

#### Exercise 3.3 — Return Values

What does this function return for each call?

```ts
function describe(phase: TimerPhase): string {
  switch (phase.kind) {
    case 'idle':    return 'Not started';
    case 'working': return 'Focus time';
    case 'onBreak': return 'Rest';
    case 'paused':  return `Paused — will resume ${phase.resumingTo}`;
  }
}

describe({ kind: 'idle' });
describe({ kind: 'paused', resumingTo: 'work' });
describe({ kind: 'working' });
```

### Type Inference: TypeScript Guesses When It Can

You don't have to annotate every single thing. TypeScript is smart enough to figure out most
types on its own:

```ts
const count = 5;          // TypeScript knows: number
const label = "Focus";    // TypeScript knows: string
const done = false;       // TypeScript knows: boolean
```

You only annotate when TypeScript can't figure it out — mainly function parameters.

### The `!` Symbol — "Trust Me, This Exists"

Back to `main.tsx`:

```ts
createRoot(document.getElementById('root')!)
```

`document.getElementById('root')` might return `null` if no element with that id exists.
TypeScript sees this and says "I can't let you use this — it might be null and that would crash."

The `!` at the end is you telling TypeScript: "I know it's not null — trust me." It turns off
the warning for that one line. If you're wrong and it really is null, the app crashes at
runtime — which is worse than a TypeScript error. So only use `!` when you're genuinely certain.

The safer alternative is to check first:

```ts
const el = document.getElementById('root');
if (el) {
  createRoot(el).render(...);
}
```

The `!` is used here because we wrote `index.html` ourselves — we know `root` always exists.

---

## Lecture 4: The Module System & Build Tools

### The Problem: Browsers Can't Run Our Code Directly

The files we're writing use syntax that browsers don't understand natively:

- **TypeScript** — browsers only know JavaScript
- **JSX** (`<div>` inside `.ts` files) — browsers don't know what that means
- **`import` statements with package names** like `import { useState } from 'react'` — browsers
  don't know where to find "react" on your computer

We need something that takes our source files and transforms them into plain JavaScript that any
browser can run. That's what **Vite** does.

### Vite: Your Development Assistant

Vite (pronounced "veet") does two jobs:

**Job 1 — Development mode (`npm run dev`):**
- Starts a local web server at `http://localhost:5173`
- Watches your files for changes
- When you save a file, it transforms it instantly and pushes the change to your browser —
  without you having to refresh. This is called **Hot Module Replacement (HMR)**

**Job 2 — Production build (`npm run build`):**
- Takes all your source files
- Transforms and bundles them into a small set of plain `.js` and `.css` files in `web/dist/`
- These files are what you'd upload to a web server for real users to download

### Exercise 4.1 — See HMR Live

Make sure `npm run dev` is running in the `web/` folder, and the app is open in your browser.

Open `web/src/App.tsx`:

```tsx
import { ContentView } from './components/ContentView';

export default function App() {
  return <ContentView />;
}
```

Change line 4 to:
```tsx
  return <div>hello world</div>;
```

Save the file. Watch the browser — it updates instantly, no refresh needed. That's HMR.
Change it back and save again. The app is restored.

### npm: The Package Manager

A **package** is a bundle of code someone else wrote that you can use in your project. React,
for example, is a package. So is the charting library (Recharts) and the database library (Dexie).

**npm** (Node Package Manager) is the tool that downloads and manages these packages.

When you ran `npm install` at the start, npm read `package.json` — the project's manifest file
— and downloaded everything listed in it into a folder called `node_modules/`.

Open `web/package.json`:

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "zustand": "^5.0.2",
    "dexie": "^4.0.8",
    "recharts": "^2.14.1",
    ...
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    ...
  }
}
```

- **`dependencies`** — packages that are part of the app itself; they get bundled and sent to
  the user's browser
- **`devDependencies`** — tools that only run on your computer during development; never sent
  to users (TypeScript, Vite, etc.)

The `scripts` section defines shortcuts:
- `npm run dev` → runs `vite` (starts the dev server)
- `npm run build` → runs TypeScript type-checking, then bundles everything for production
- `npm run typecheck` → just runs the type-checker without building

### The Module System: How Files Talk to Each Other

In this project, every `.ts` and `.tsx` file is its own **module**. Nothing is shared
automatically — if a file needs something from another file, it has to explicitly ask for it.

You **export** something to make it available:

```ts
// In TimerPhase.ts
export type TimerPhase = ...
```

You **import** it where you need it:

```ts
// In some other file
import { TimerPhase } from './models/TimerPhase';
```

The path `'./models/TimerPhase'` means "look for a file called `TimerPhase.ts` inside a folder
called `models`, starting from where *this* file is." The `./` means "starting here."

Imports from packages (not your own files) use just the package name:

```ts
import { useState } from 'react';
```

npm put React in `node_modules/react/` — Vite knows to look there when it sees a bare name
with no `./`.

### Exercise 4.2 — Trace an Import Chain

Starting from `main.tsx`, follow the imports like a chain — open each file and look at what
*it* imports. No running code — just read.

1. `main.tsx` imports `App` from `'./App'`
2. `App.tsx` imports `ContentView` from `'./components/ContentView'`
3. Open `web/src/components/ContentView.tsx` — read the first 8 lines

Write down what each import on those first 8 lines is pulling in, and make your best guess at
what each one does just from its name. We'll verify your guesses together in Lecture 5.

---

*Next: Lecture 5 — Components & Props in Depth (picking up from Exercise 4.2)*

---

## Lecture 5: Components & Props in Depth

### Part 1 — A Component is a Recipe, Not a Meal

Here's a subtle thing about components that trips up beginners: **you never call a component
function yourself.** React calls it for you.

When you write `<CircularProgress progress={0.5} phase="work" />`, you are not calling the
`CircularProgress` function. You are handing React a description that says "I need a
`CircularProgress` here, with these inputs." React decides when to actually call the function
— when the component first appears, and every time its inputs change.

Think of it like a recipe card. You write the recipe once:

```
Recipe: CircularProgress
Ingredients: progress (a number), phase (work or break)
Result: an SVG ring showing that much progress in that colour
```

React is the chef. It calls the recipe whenever it needs to draw that ring, using whatever
ingredients the parent component handed down.

### Part 2 — Props: The Ingredients You Pass In

Props are just the inputs to a component function. Look at `CircularProgress.tsx`:

```ts
interface Props {
  progress: number;
  phase: 'work' | 'break';
  size?: number;
  strokeWidth?: number;
}

export function CircularProgress({ progress, phase, size = 260, strokeWidth = 10 }: Props) {
```

The `interface Props` block says: this component accepts four inputs:

- `progress: number` — a number between 0 and 1 (how full the ring is)
- `phase: 'work' | 'break'` — which colour to use (blue for work, green for break)
- `size?: number` — the `?` means optional; if not provided, defaults to `260`
- `strokeWidth?: number` — optional; defaults to `10`

The `{ progress, phase, size = 260, strokeWidth = 10 }` in the function signature is
**destructuring with defaults**. It's the same as writing:

```ts
function CircularProgress(props: Props) {
  const progress = props.progress;
  const phase = props.phase;
  const size = props.size ?? 260;       // use 260 if not provided
  const strokeWidth = props.strokeWidth ?? 10;
```

Just shorter. You pull each field out of the props object directly into named variables.

This component is used in `TimerView.tsx` like this:

```tsx
<CircularProgress progress={progress} phase={progressPhase} />
```

No `size` or `strokeWidth` passed — the component uses its defaults.

**Exercise 5.1:** Look at the `Props` interface for `BreakOverlay`:

```ts
interface Props {
  gradientIndex: number;
  showQuotes: boolean;
}
```

Now find where `BreakOverlay` is used in `ContentView.tsx` (line 31). What values are passed
in for `gradientIndex` and `showQuotes`? Where do those values come from?

### Part 3 — Two Ways a Component Gets Its Data

This is the most important distinction in this codebase. Compare these two components:

**`CircularProgress`** — gets everything through props:
```tsx
export function CircularProgress({ progress, phase, size = 260, strokeWidth = 10 }: Props) {
  // uses only what was passed in — knows nothing about the timer store
```

**`SessionControls`** — gets everything from the store directly:
```tsx
export function SessionControls() {
  const phase = useTimerStore(s => s.phase);
  const start = useTimerStore(s => s.start);
  // no props at all — reaches into the global store itself
```

Why the difference?

- **`CircularProgress`** is a pure display component. It draws a ring. It doesn't care about
  timers or sessions — it just needs a number and a colour. Making it prop-driven means you
  could reuse it anywhere. It's easy to test: give it `progress={0.5}` and it draws a
  half-full ring. Done.

- **`SessionControls`** is deeply tied to the timer. It needs the current phase AND five
  action functions (start, pause, resume, skip, stop). Having the parent pass all of that
  down as props would be messy — you'd have to thread six values through every component in
  between. Instead it reaches into the store directly.

The rule of thumb: if a component could be reused somewhere else with different data, use
props. If it's permanently tied to one specific piece of global state, read from the store.

### Part 4 — The Parent-Child Relationship

Every component has exactly one parent — the component that renders it. Data flows
**downward** through props, from parent to child. A child never pushes data up to its parent
directly.

Here's the flow for the timer ring:

```
timerStore
    │
    │  (useTimerStore reads progress and phase)
    ▼
TimerView
    │
    │  <CircularProgress progress={progress} phase={progressPhase} />
    ▼
CircularProgress
    │
    │  (does the SVG maths, draws the ring)
    ▼
  screen
```

`CircularProgress` knows nothing about the store. It only knows what `TimerView` told it.
`TimerView` is the middleman — it reads from the store and translates the data into the shape
`CircularProgress` expects.

This separation is intentional. `CircularProgress` can be understood and tested without
knowing anything about timers, Zustand, or the rest of the app.

### Part 5 — Reading a Component You've Never Seen

Given any component file you've never opened, you can understand it in under a minute by
answering four questions in order:

1. **What are the props?** Look for `interface Props` or the function signature.
2. **What does it read from the store?** Look for `useTimerStore(...)` or `useSettings(...)`.
3. **What does it return?** Skim the `return (...)` block — what's the top-level element?
4. **What child components does it render?** Look for `<CapitalLetterTags />` inside the return.

Let's apply this to `BreakOverlay.tsx`:

1. **Props:** `gradientIndex: number`, `showQuotes: boolean`
2. **Store:** reads `phase`, `timeRemaining`, and the `skip` action
3. **Returns:** a full-screen `<div>` with fixed position — or `null` if not on break
4. **Children:** no custom components, just HTML elements and a button

Line 37 is the most interesting line in the file:

```ts
if (phase.kind !== 'onBreak') return null;
```

If the timer isn't on a break, the component returns `null` — React renders nothing.
The component is always in the tree (see `ContentView.tsx` line 31), but it only draws
something when the phase is `'onBreak'`. This is the **early return pattern** for conditional
rendering — check the condition at the top, bail out early if it isn't met.

### Part 6 — The `children` Prop

There's one special prop you never have to define: `children`. It's whatever you put
*between* a component's opening and closing tags:

```tsx
<StrictMode>
  <App />
</StrictMode>
```

`<App />` is the `children` of `StrictMode`. React passes it automatically. `StrictMode`
wraps it, does its dev-mode checks, and renders the children. Most components in this app
use self-closing tags (`<CircularProgress />`), so you don't see `children` often — but it's
how any wrapper component works.

### Exercise 5.2 — Trace a Prop End to End

Open `ContentView.tsx`. On line 43:

```tsx
<SettingsView settings={settings} update={update} />
```

Three steps, no running code:

1. Where does `settings` come from in `ContentView`? (Hint: look at line 20.)
2. Open `web/src/components/settings/SettingsView.tsx`. What does its `Props` interface look like?
3. Find one place inside `SettingsView` where `settings.workDuration` is actually used.
   What is it doing with that value?

This is the core skill: following data from where it lives, through the component tree, to
where it appears on screen.

---

*Next: Lecture 6 — State & Re-rendering (`useState` in depth)*

---

## Lecture 6: State & Re-rendering

### Part 1 — What is State?

So far the components we've looked at just display things. But a real app changes over time
— the timer counts down, the active tab switches, a toggle turns on and off. Data that
changes over time is called **state**.

Think of a scoreboard at a football match. The score is state — it starts at 0–0 and changes
every time a goal is scored. Every time it changes, the scoreboard redraws to show the new
number. The scoreboard doesn't remember every previous score — it only knows the current one
and displays that.

React works exactly the same way. When state changes, React redraws the parts of the screen
that depend on it. You don't tell it *how* to redraw — it figures that out. You just update
the value and React handles the rest.

### Part 2 — `useState` Unpacked

Here is `useState` in action from `ContentView.tsx` line 20:

```tsx
const [tab, setTab] = useState<Tab>('timer');
```

Let's break every part of this down:

**`useState('timer')`** — calls the `useState` function with the starting value `'timer'`.
This is the initial state — what the value is when the component first appears on screen.

**`useState` returns an array of two things:**
- The current value
- A function to change it

**`const [tab, setTab] = ...`** — this is **array destructuring**. It's a shorthand for:

```tsx
const result = useState<Tab>('timer');
const tab = result[0];      // the current value
const setTab = result[1];   // the function to change it
```

The square brackets on the left are not creating an array — they're unpacking one.

**`<Tab>`** — this is the TypeScript annotation. It tells TypeScript that `tab` can only
ever be one of the three values defined in the `Tab` type (`'timer'`, `'stats'`,
`'settings'`). Without it, TypeScript would infer the type as `string`, which is too broad.

**The naming convention:** by tradition, if the value is called `x`, the setter is called
`setX`. You'll see this everywhere: `[tab, setTab]`, `[draft, setDraft]`, `[count, setCount]`.

### Part 3 — What Re-rendering Actually Means

"Re-render" is a word that sounds technical but describes something simple: React calls your
component function again.

Here's the step-by-step of what happens when a user clicks the Stats tab button:

1. The button's `onClick` fires: `() => setTab('stats')`
2. `setTab('stats')` tells React: "the value of `tab` has changed to `'stats'`"
3. React schedules a re-render of `ContentView`
4. React calls `ContentView()` again — the whole function runs from top to bottom
5. This time, `useState` returns `'stats'` as the current value (not `'timer'`)
6. The function returns new JSX — with `<StatisticsView />` instead of `<TimerView />`
7. React compares the new JSX to the previous JSX
8. It finds the difference: `<TimerView />` is gone, `<StatisticsView />` is new
9. React updates just those DOM nodes — everything else stays untouched
10. The screen shows the Statistics view

The key insight: **React calls your function, not you.** You never write "now redraw the
screen." You just call `setTab` and React handles steps 3–10 automatically.

### Part 4 — State is a Snapshot

Here's something that trips up almost every beginner. Each time React calls your component
function, the value of `tab` is frozen for that entire call. It doesn't update mid-function.

```tsx
const [tab, setTab] = useState<Tab>('timer');

// tab is 'timer' here

setTab('stats');

// tab is STILL 'timer' here — it doesn't change immediately
// the new value only appears in the NEXT time React calls this function
console.log(tab); // prints 'timer', not 'stats'
```

Think of it like a photograph. Each render is a photo of what the state looked like at that
moment. When you call `setTab`, you're not editing the current photo — you're telling React
to take a new photo with the updated value.

This is why state is called a "snapshot" — each render captures the state at that point in
time, and the function works with that frozen snapshot from start to finish.

### Part 5 — Multiple State Variables

A component can have as many state variables as it needs. Each `useState` call is
independent. Look at `DurationInput` in `SettingsView.tsx`:

```tsx
function DurationInput({ label, valueMinutes, onCommit, min, max }) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(valueMinutes);
  ...
}
```

This component has one state variable: `draft`. It stores what the user is currently typing
in the number input — before they've confirmed it by pressing Enter or clicking away.

Why is this needed? Because the real setting (stored in localStorage) should only update when
the user *finishes* typing, not on every single keystroke. If you typed `"2"` on your way
to `"25"`, you don't want the timer to temporarily become 2 minutes.

The `draft ?? String(valueMinutes)` line means: show the draft if one exists, otherwise show
the real saved value. The `??` operator means "if the left side is null, use the right side
instead."

When the user clicks away (the `onBlur` event), `handleBlur` runs:

```tsx
function handleBlur() {
  const parsed = parseInt(displayed, 10);
  if (!isNaN(parsed)) {
    onCommit(Math.min(max, Math.max(min, parsed)));
  }
  setDraft(null);  // clear the draft — go back to showing the real value
}
```

It parses the draft into a number, clamps it between `min` and `max`, commits it to the real
setting, then clears the draft. Clean and self-contained.

This pattern — a local `draft` state that shadows the real value while editing — is called
the **draft pattern** and appears in almost every form-based UI.

### Part 6 — State is Private to Each Instance

Each time a component appears in the tree, it gets its own independent state. This is easy
to miss because we only have one `DurationInput` visible at a time, but there are actually
two rendered in the settings — one for Focus Duration and one for Break Duration:

```tsx
<DurationInput label="Focus Duration" valueMinutes={settings.workDuration / 60} ... />
<DurationInput label="Break Duration" valueMinutes={settings.breakDuration / 60} ... />
```

Each one has its own `draft` state. Typing in the Focus input doesn't affect the Break
input's draft at all — they are completely separate, even though they're both `DurationInput`
components. The state belongs to the *instance*, not the component definition.

Think of a component definition as a cookie cutter, and each rendered instance as a separate
cookie. They have the same shape but are independent objects — changing one doesn't change
the others.

### Part 7 — How the Tab Highlight Works

Look at line 58–59 in `ContentView.tsx`:

```tsx
className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-colors ${
  tab === id ? 'bg-white/15 text-white' : 'text-white/25 hover:text-white/60'
}`}
```

The backtick string (`` ` `` characters) is a **template literal** — JavaScript's way of
building a string that contains variable values. The `${ }` inside it is where you drop in
a JavaScript expression.

`tab === id ? 'bg-white/15 text-white' : 'text-white/25 hover:text-white/60'` is a
**ternary expression** — a compact if/else on one line:

```
condition ? valueIfTrue : valueIfFalse
```

So the button for the currently active tab gets a light background and full white text.
The other two buttons get dim text. Every time `tab` changes, React re-renders `ContentView`,
this expression re-evaluates, and the CSS classes update automatically. No "find the active
button and add a class" code anywhere.

### Exercise 6.1 — Trace the Draft Pattern

Open `SettingsView.tsx` and read `DurationInput` carefully. Trace what happens step by step
when a user:

1. Clicks into the Focus Duration input (currently showing `25`)
2. Clears it and types `3`
3. Keeps typing to make it `30`
4. Presses Enter

For each step, what is the value of `draft`? What is `displayed`? What does the input show?

### Exercise 6.2 — What Would Break

Without running the code, predict what would happen if you changed line 30 in
`SettingsView.tsx` from:

```tsx
const [draft, setDraft] = useState<string | null>(null);
```

to:

```tsx
const [draft, setDraft] = useState<string | null>(String(valueMinutes));
```

What would be different about how the input behaves? Is this better or worse?

---

*Next: Lecture 7 — Side Effects (`useEffect` in depth)*
