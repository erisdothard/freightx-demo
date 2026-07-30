import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { IOSStatusBar } from '@/shared/components/ios-status-bar';

export default function SplashPage() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(170deg, #1E1208 0%, #160F08 30%, #100D0A 60%, #0D0D0D 100%)',
      }}
    >
      <IOSStatusBar />

      {/* Hero area — truck illustration */}
      <div className="relative flex-1 min-h-0">
        {/* Ambient orange haze from road */}
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% 100%, rgba(232,96,48,0.22) 0%, rgba(200,70,20,0.08) 50%, transparent 100%)',
          }}
        />

        {/* Truck SVG */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 380 260"
            className="w-full max-w-sm"
            style={{ filter: 'drop-shadow(0 16px 40px rgba(232,96,48,0.25))' }}
          >
            <defs>
              <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#261608" />
                <stop offset="100%" stopColor="#160D06" />
              </linearGradient>
              <linearGradient id="roadG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A1814" />
                <stop offset="100%" stopColor="#111010" />
              </linearGradient>
              <linearGradient id="cabG" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0%" stopColor="#F07040" />
                <stop offset="55%" stopColor="#E05828" />
                <stop offset="100%" stopColor="#B83818" />
              </linearGradient>
              <linearGradient id="trailerG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#CC4A18" />
                <stop offset="100%" stopColor="#A83010" />
              </linearGradient>
              <radialGradient id="headlightG" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF5D0" stopOpacity="1" />
                <stop offset="100%" stopColor="#FFD070" stopOpacity="0" />
              </radialGradient>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Sky */}
            <rect width="380" height="160" fill="url(#skyG)" />

            {/* Horizon glow */}
            <ellipse cx="190" cy="158" rx="220" ry="18" fill="#E86030" opacity="0.12" />

            {/* Mountain range */}
            <polygon
              points="0,158 50,108 90,130 130,95 175,120 215,88 255,118 295,92 340,115 380,105 380,158"
              fill="#1A0E06"
              opacity="0.9"
            />
            <polygon
              points="0,158 40,122 80,138 120,110 160,128 200,100 240,122 280,105 320,118 380,112 380,158"
              fill="#140B04"
              opacity="0.8"
            />

            {/* Road */}
            <rect x="0" y="158" width="380" height="102" fill="url(#roadG)" />
            {/* Road centerline dashes */}
            {[20, 80, 140, 200, 260, 320].map((x) => (
              <rect key={x} x={x} y="197" width="44" height="3" rx="1.5" fill="#2C2820" />
            ))}
            {/* Road edge line */}
            <rect x="0" y="190" width="380" height="2" fill="#201E1A" opacity="0.8" />

            {/* === TRAILER === */}
            <rect x="15" y="118" width="222" height="58" rx="4" fill="url(#trailerG)" />
            {/* Trailer top highlight */}
            <rect x="15" y="118" width="222" height="4" rx="2" fill="#F06038" opacity="0.35" />
            {/* Trailer ribs */}
            {[50, 85, 120, 155, 190, 220].map((x) => (
              <rect key={x} x={x} y="118" width="2" height="58" fill="#8A2808" opacity="0.5" />
            ))}
            {/* Trailer rear door lines */}
            <rect x="15" y="122" width="28" height="50" rx="2" fill="#982C0A" />
            {[130, 138, 146, 154, 162].map((y) => (
              <rect
                key={y}
                x="17"
                y={y}
                width="24"
                height="1"
                rx="0.5"
                fill="#7A2006"
                opacity="0.7"
              />
            ))}

            {/* === CAB === */}
            <rect x="237" y="106" width="98" height="70" rx="8" fill="url(#cabG)" />
            {/* Cab top highlight */}
            <rect x="237" y="106" width="98" height="6" rx="4" fill="#F88858" opacity="0.45" />
            {/* Windshield */}
            <rect x="252" y="112" width="64" height="40" rx="5" fill="#10101A" opacity="0.88" />
            {/* Windshield reflection */}
            <path d="M255 115 L275 115 L268 130 L255 130 Z" fill="white" opacity="0.04" />
            {/* Side window */}
            <rect x="239" y="116" width="10" height="22" rx="3" fill="#10101A" opacity="0.75" />
            {/* Exhaust pipe */}
            <rect x="328" y="88" width="7" height="22" rx="3" fill="#666" />
            {/* Smoke puffs */}
            {[82, 74, 66].map((cy, i) => (
              <circle
                key={cy}
                cx={332}
                cy={cy}
                r={4 + i * 2}
                fill="#444"
                opacity={0.35 - i * 0.1}
              />
            ))}
            {/* Grille area */}
            <rect x="333" y="126" width="18" height="32" rx="4" fill="#C04020" />
            {[128, 135, 142, 149, 156].map((y) => (
              <rect
                key={y}
                x="335"
                y={y}
                width="14"
                height="2"
                rx="1"
                fill="#8A2810"
                opacity="0.7"
              />
            ))}
            {/* Headlights */}
            <rect x="335" y="122" width="13" height="6" rx="3" fill="#FFF5D0" opacity="0.9" />
            {/* Headlight beam */}
            <ellipse cx="341" cy="156" rx="28" ry="8" fill="#FFF5D0" opacity="0.05" />
            <ellipse cx="341" cy="148" rx="18" ry="5" fill="#FFF5D0" opacity="0.04" />
            {/* Bumper */}
            <rect x="333" y="155" width="18" height="7" rx="3" fill="#A03010" />
            {/* Steps */}
            <rect x="241" y="168" width="14" height="6" rx="2" fill="#C04020" />

            {/* === WHEELS === */}
            {[65, 160, 258, 305].map((cx) => (
              <g key={cx}>
                {/* Tire shadow */}
                <ellipse cx={cx} cy={183} rx={16} ry={4} fill="black" opacity="0.4" />
                {/* Tire */}
                <circle cx={cx} cy={176} r={17} fill="#151412" />
                {/* Rim */}
                <circle cx={cx} cy={176} r={12} fill="#252220" />
                {/* Spokes */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                  const r = (angle * Math.PI) / 180;
                  return (
                    <line
                      key={angle}
                      x1={cx + 4 * Math.cos(r)}
                      y1={176 + 4 * Math.sin(r)}
                      x2={cx + 10 * Math.cos(r)}
                      y2={176 + 10 * Math.sin(r)}
                      stroke="#3A3632"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {/* Hub */}
                <circle cx={cx} cy={176} r={3.5} fill="#3A3632" />
                {/* Tire highlight */}
                <path
                  d={`M${cx - 14} ${176 - 7} A 14 14 0 0 1 ${cx + 8} ${176 - 12}`}
                  fill="none"
                  stroke="#2A2825"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Rear wheels double (trailer) */}
            {[143, 155].map((cx) => (
              <g key={`rear-${cx}`}>
                <circle cx={cx} cy={176} r={17} fill="#151412" />
                <circle cx={cx} cy={176} r={11} fill="#252220" />
                <circle cx={cx} cy={176} r={3} fill="#3A3632" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Bottom glass panel */}
      <div
        className="relative px-7 pb-12 pt-8 ios-blur"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <img src="/logo-user-1.svg" alt="FreightX" className="h-8 mb-5 opacity-90" />
        <p className="text-[22px] font-bold text-white leading-snug tracking-[-0.01em] mb-8">
          Our Logistics Services provide end-to-end solutions for all your shipping needs.
        </p>

        {/* Orange circular CTA */}
        <button
          onClick={() => navigate('/onboarding')}
          className="w-16 h-16 rounded-full bg-orange-gradient flex items-center justify-center mb-10 active-scale"
          style={{
            boxShadow: '0 0 0 8px rgba(232,96,48,0.15), 0 8px 32px rgba(232,96,48,0.4)',
          }}
        >
          <ArrowRight size={26} className="text-white" strokeWidth={2.5} />
        </button>

        <p className="text-[14px] text-fx-text-dim">
          Already have account?{' '}
          <button onClick={() => navigate('/login')} className="text-fx-orange font-semibold">
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
