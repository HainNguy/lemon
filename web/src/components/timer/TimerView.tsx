import { useTimerStore, formatTime } from '../../store/timerStore';
import { CircularProgress } from './CircularProgress';
import { SessionControls } from './SessionControls';

export function TimerView() {
  const phase = useTimerStore(s => s.phase);
  const timeRemaining = useTimerStore(s => s.timeRemaining);
  const completedWorkSessions = useTimerStore(s => s.completedWorkSessions);
  const progress = useTimerStore(s => s.progress);

  const isBreak = phase.kind === 'onBreak';
  const isPaused = phase.kind === 'paused';
  const sessionLabel = isBreak
    ? 'Break'
    : isPaused
    ? (phase.resumingTo === 'break' ? 'Break — Paused' : `Focus — Paused`)
    : `Focus • Session ${completedWorkSessions + 1}`;

  const progressPhase = (phase.kind === 'onBreak' || (phase.kind === 'paused' && phase.resumingTo === 'break'))
    ? 'break'
    : 'work';

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
        {sessionLabel}
      </p>

      <div className="relative flex items-center justify-center">
        <CircularProgress progress={progress} phase={progressPhase} />
        <div className="absolute flex flex-col items-center gap-1">
          <span className="text-white text-[3.5rem] font-thin tabular-nums leading-none">
            {formatTime(timeRemaining)}
          </span>
          {isPaused && (
            <span className="text-white/30 text-xs tracking-widest uppercase">paused</span>
          )}
        </div>
      </div>

      <SessionControls />
    </div>
  );
}
