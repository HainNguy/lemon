import { Play, Pause, SkipForward, Square } from 'lucide-react';
import { useTimerStore } from '../../store/timerStore';

export function SessionControls() {
  const phase = useTimerStore(s => s.phase);
  const start = useTimerStore(s => s.start);
  const pause = useTimerStore(s => s.pause);
  const resume = useTimerStore(s => s.resume);
  const skip = useTimerStore(s => s.skip);
  const stop = useTimerStore(s => s.stop);

  const isIdle = phase.kind === 'idle';
  const isPaused = phase.kind === 'paused';
  const isRunning = phase.kind === 'working' || phase.kind === 'onBreak';

  return (
    <div className="flex items-center gap-5 mt-10">
      {isIdle && (
        <button
          onClick={start}
          className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center transition-colors"
          aria-label="Start"
        >
          <Play size={26} fill="white" color="white" />
        </button>
      )}

      {(isRunning || isPaused) && (
        <>
          <button
            onClick={isRunning ? pause : resume}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning
              ? <Pause size={22} color="white" />
              : <Play size={22} fill="white" color="white" />
            }
          </button>
          <button
            onClick={skip}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Skip"
          >
            <SkipForward size={18} color="white" />
          </button>
          <button
            onClick={stop}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Stop"
          >
            <Square size={18} color="white" />
          </button>
        </>
      )}
    </div>
  );
}
