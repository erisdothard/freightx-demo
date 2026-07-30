import { Play, Pause } from 'lucide-react';

interface RouteReplaySliderProps {
  totalPoints: number;
  currentIndex: number;
  onIndexChange: (i: number) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  timestamp: number | null;
}

const SPEEDS = [1, 2, 4];

export function RouteReplaySlider({
  totalPoints,
  currentIndex,
  onIndexChange,
  playing,
  onPlay,
  onPause,
  speed,
  onSpeedChange,
  timestamp,
}: RouteReplaySliderProps) {
  if (totalPoints === 0) return null;

  const timeLabel = timestamp
    ? new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="bg-fx-surface border border-fx-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-fx-text-muted uppercase tracking-widest">
          Route Replay
        </p>
        <span className="text-xs text-fx-text-dim">
          {currentIndex + 1} / {totalPoints} points
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={totalPoints - 1}
        value={currentIndex}
        onChange={(e) => onIndexChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #e86030 ${(currentIndex / (totalPoints - 1)) * 100}%, rgba(255,255,255,0.08) ${(currentIndex / (totalPoints - 1)) * 100}%)`,
        }}
      />

      {/* Controls */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={playing ? onPause : onPlay}
          className="w-9 h-9 rounded-full bg-fx-orange/15 border border-fx-orange/25 flex items-center justify-center active-scale"
        >
          {playing ? (
            <Pause size={16} className="text-fx-orange" />
          ) : (
            <Play size={16} className="text-fx-orange" />
          )}
        </button>

        <span className="text-xs text-fx-text-dim font-medium">{timeLabel}</span>

        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                speed === s ? 'bg-fx-orange text-white' : 'bg-white/5 text-fx-text-dim'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
