import { useState, useEffect, useRef, useCallback } from 'react';
import { getBreadcrumbsForLoad } from '@/services/breadcrumbs.service';
import type { BreadcrumbPoint } from '@freightx/shared';

interface UseBreadcrumbTrailResult {
  trail: BreadcrumbPoint[];
  loading: boolean;
  /** Current replay index (0..trail.length-1) */
  replayIndex: number;
  setReplayIndex: (i: number) => void;
  playing: boolean;
  play: () => void;
  pause: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  /** Position at current replay index */
  replayPosition: [number, number] | null;
  /** Timestamp at current replay index */
  replayTimestamp: number | null;
}

export function useBreadcrumbTrail(loadNumber: string | null): UseBreadcrumbTrailResult {
  const [trail, setTrail] = useState<BreadcrumbPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loadNumber) return;
    setLoading(true);
    getBreadcrumbsForLoad(loadNumber)
      .then((points) => {
        setTrail(points);
        setReplayIndex(0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [loadNumber]);

  // Playback timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (playing && trail.length > 0) {
      const ms = Math.max(50, 200 / speed);
      intervalRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= trail.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, ms);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, trail.length]);

  const play = useCallback(() => {
    if (replayIndex >= trail.length - 1) setReplayIndex(0);
    setPlaying(true);
  }, [replayIndex, trail.length]);

  const pause = useCallback(() => setPlaying(false), []);

  const current = trail[replayIndex] ?? null;

  return {
    trail,
    loading,
    replayIndex,
    setReplayIndex,
    playing,
    play,
    pause,
    speed,
    setSpeed,
    replayPosition: current ? [current.lat, current.lng] : null,
    replayTimestamp: current?.ts ?? null,
  };
}
