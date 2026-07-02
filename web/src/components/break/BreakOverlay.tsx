import { useRef, useMemo } from 'react';
import { useTimerStore, formatTime } from '../../store/timerStore';
import { GRADIENT_PRESETS } from '../../constants/gradients';

const QUOTES = [
  "Rest is not idleness — it is the key to a better day ahead.",
  "Almost everything will work again if you unplug it for a few minutes.",
  "Your brain needs rest to consolidate what you just learned.",
  "The time to relax is when you don't have time for it.",
  "In the middle of every difficulty lies opportunity — but first, breathe.",
  "Sometimes the most productive thing you can do is relax.",
  "Solitude is where we place our chaos to rest.",
  "A rested mind is a creative mind.",
  "Take a breath. You've earned this.",
  "Silence is the sleep that nourishes wisdom.",
];

interface Props {
  gradientIndex: number;
  showQuotes: boolean;
}

export function BreakOverlay({ gradientIndex, showQuotes }: Props) {
  const phase = useTimerStore(s => s.phase);
  const timeRemaining = useTimerStore(s => s.timeRemaining);
  const skip = useTimerStore(s => s.skip);

  // Pick a new quote each time this component mounts (i.e. each new break)
  const quoteIndexRef = useRef(0);
  const quote = useMemo(() => {
    quoteIndexRef.current = Math.floor(Math.random() * QUOTES.length);
    return QUOTES[quoteIndexRef.current];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // All hooks must be called before any early returns
  if (phase.kind !== 'onBreak') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: GRADIENT_PRESETS[gradientIndex] }}
    >
      <div className="text-white text-center px-8">
        <p className="text-xs font-medium tracking-[0.3em] uppercase opacity-60 mb-8">
          Break Time
        </p>
        <p className="text-[5rem] font-thin tabular-nums leading-none">
          {formatTime(timeRemaining)}
        </p>
        {showQuotes && (
          <p className="mt-12 text-base opacity-40 max-w-sm mx-auto leading-relaxed italic">
            "{quote}"
          </p>
        )}
      </div>

      <button
        onClick={skip}
        className="absolute bottom-8 right-8 text-white opacity-25 hover:opacity-70 transition-opacity text-sm"
      >
        Skip Break →
      </button>
    </div>
  );
}
