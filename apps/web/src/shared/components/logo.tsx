/**
 * FreightX logo system
 *
 * Each chevron is a tall, narrow hexagonal arrow (portrait, ~0.72:1 w:h).
 * Three overlap in sequence, rendered back→front so brightest is on top.
 *
 *   (nX, 0) ────── (bX, 0)
 *                        \
 *   (0, mid) ─────────── (tX, mid)   ← sharp tip
 *                        /
 *   (nX, H) ────── (bX, H)
 */

function chevronPts(x: number, nX: number, bX: number, tX: number, H: number) {
  const mid = H / 2;
  return `${x + nX},0 ${x + bX},0 ${x + tX},${mid} ${x + bX},${H} ${x + nX},${H} ${x},${mid}`;
}

function ChevronsSVG({ size }: { size: number }) {
  const H = 56; // height
  const nX = 11; // notch indent from xBase (left V depth)
  const bX = 30; // body right edge (where tip diagonal starts)
  const tX = 40; // total width to tip — 40/56 = 0.71:1 (narrow/tall like reference)
  const step = 22; // offset per chevron → 45% overlap

  const VW = 2 * step + tX; // 84

  return (
    <svg
      width={Math.round((VW / H) * size)}
      height={size}
      viewBox={`0 0 ${VW} ${H}`}
      fill="none"
      aria-hidden="true"
    >
      <polygon points={chevronPts(2 * step, nX, bX, tX, H)} fill="#4A200E" />
      <polygon points={chevronPts(step, nX, bX, tX, H)} fill="#7B3418" />
      <polygon points={chevronPts(0, nX, bX, tX, H)} fill="#CB521A" />
    </svg>
  );
}

export function LogoWordmark({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`} aria-label="FreightX">
      <ChevronsSVG size={height} />
      <span
        style={{
          fontSize: Math.round(height * 0.73),
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ color: '#FFFFFF' }}>FREIGHT</span>
        <span style={{ color: '#CB521A' }}>X</span>
      </span>
    </div>
  );
}

export function LogoEmblem({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      aria-label="FreightX"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: 'linear-gradient(145deg, #1A1008 0%, #0E0C0A 100%)',
        border: '1px solid rgba(203,82,26,0.3)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronsSVG size={Math.round(size * 0.55)} />
    </div>
  );
}
