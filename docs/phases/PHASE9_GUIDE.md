# Phase 9 — Apple Maps-Style Live Maps

**Status:** Complete

**Migrations:** None

**Key files added:**

- `apps/web/src/shared/components/map-view/` — Leaflet map with Stadia Alidade Smooth Dark tiles
- `apps/web/src/shared/components/fleet-map/` — fleet overview map with pulsing truck pins and count badge
- `apps/web/src/features/maps/components/load-pin.tsx` — SVG teardrop pin for load origin/destination markers
- `apps/web/src/features/maps/components/truck-marker.tsx` — animated truck marker with heading rotation
- `apps/web/src/features/maps/components/route-line.tsx` — dual-layer glow polyline (outer glow + inner solid line)
- `apps/web/src/features/maps/styles/map-styles.ts` — glass tooltips, fx-pulse-ring keyframes, dark container theme

**Features delivered:**

- Stadia Alidade Smooth Dark map tiles (Apple Maps dark aesthetic)
- SVG teardrop pins for load origin and destination markers
- Dual-layer route glow visualization (orange outer glow + inner solid line)
- Animated truck marker with direction indicator based on heading
- Frosted glass LIVE badge and glass-styled popup tooltips
- fx-pulse-ring CSS animation for pulsing availability indicators
- Fleet map with pulsing pins for available trucks and truck count badge
- Real-time truck availability updates on fleet map
- Bid Now button restored on carrier load board
- Independent carrier truck posting without requiring a company profile
