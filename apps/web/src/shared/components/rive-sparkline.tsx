import { RiveAnimation } from './rive-animation';

interface RiveSparklineProps {
  className?: string;
  animated?: boolean;
}

/**
 * Animated sparkline for market index visualization.
 * Place sparkline.riv in /public/animations/
 * Falls back to a simple SVG sparkline shape.
 */
export function RiveSparkline({ className, animated = true }: RiveSparklineProps) {
  if (!animated) {
    return (
      <svg viewBox="0 0 60 20" className={className ?? 'w-14 h-5'} fill="none">
        <polyline
          points="0,15 10,12 20,14 30,8 40,10 50,5 60,7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-fx-orange"
        />
      </svg>
    );
  }

  return (
    <RiveAnimation
      src="/animations/sparkline.riv"
      stateMachine="State Machine 1"
      className={className ?? 'w-14 h-5'}
      fallback={
        <svg viewBox="0 0 60 20" className={className ?? 'w-14 h-5'} fill="none">
          <polyline
            points="0,15 10,12 20,14 30,8 40,10 50,5 60,7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-fx-orange"
          />
        </svg>
      }
    />
  );
}
