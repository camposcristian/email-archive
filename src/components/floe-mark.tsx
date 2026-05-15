/**
 * Floe brand mark — stylized iceberg with a signal-flare summit.
 * The visible tip sits above a translucent submerged mass; the orange
 * dot is the signal flare (CTA-warm accent, on brand).
 *
 * Matches public/favicon.svg exactly so the tab favicon and the
 * in-app header mark render the same shape.
 */
interface FloeMarkProps {
  className?: string
}

export function FloeMark({ className }: FloeMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Floe"
    >
      {/* Submerged iceberg mass */}
      <path
        d="M3.4 13 L2.2 16 L3.6 19.4 L7.2 21 L13.2 21 L17.4 19.4 L18.8 16.5 L17.6 13.6 L15.8 13 Z"
        fill="#6b8ea6"
        fillOpacity=".55"
      />
      {/* Waterline */}
      <path d="M2 13 L22 13" stroke="#14181c" strokeWidth=".4" strokeOpacity=".35" />
      {/* Visible tip */}
      <path
        d="M5.8 13 L7.4 8.6 L10.4 5.6 L13.2 8.4 L14.8 13 Z"
        fill="#ffffff"
        stroke="#14181c"
        strokeWidth=".7"
      />
      {/* Ridge */}
      <path
        d="M7.4 8.6 L10.4 5.6 L13.2 8.4"
        fill="none"
        stroke="#14181c"
        strokeWidth=".5"
        strokeOpacity=".3"
      />
      {/* Signal-flare summit */}
      <circle cx="10.4" cy="5.6" r="1.1" fill="#d96a2b" />
    </svg>
  )
}
