import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';

const RiveComponent = lazy(() =>
  import('@rive-app/react-canvas').then((mod) => ({ default: mod.default })),
);

interface RiveAnimationProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
  className?: string;
  style?: CSSProperties;
  /** Static fallback for reduced-motion preference */
  fallback?: React.ReactNode;
  /** Only play when visible in viewport */
  viewportPlay?: boolean;
}

export function RiveAnimation({
  src,
  stateMachine,
  artboard,
  className,
  style,
  fallback,
  viewportPlay = true,
}: RiveAnimationProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [inView, setInView] = useState(!viewportPlay);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Intersection observer for viewport-based playback
  useEffect(() => {
    if (!viewportPlay || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [viewportPlay]);

  if (prefersReducedMotion) {
    return <>{fallback ?? null}</>;
  }

  return (
    <div ref={containerRef} className={className} style={style}>
      {inView && (
        <Suspense fallback={fallback ?? null}>
          <RiveComponent
            src={src}
            stateMachines={stateMachine ? [stateMachine] : undefined}
            artboard={artboard}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      )}
    </div>
  );
}
