import { useId } from 'react'

/**
 * Drawn stand-ins for photography.
 *
 * A construction template ships without a client's project photographs, and the
 * usual answer — a grey rectangle, or worse, stock site imagery — undoes the
 * rest of the page. These are elevations and sections instead: flat, drafted,
 * in the page's own palette, so an empty template still reads as architecture.
 *
 * They take their colours from CSS variables, so the same plate sits correctly
 * on warm paper and on charcoal. Every project in content.js has an `image`
 * field; set it and the section uses that instead of the plate, which is the
 * whole migration path to real photography.
 */

const MASS = 'var(--plate-mass)'
const MASS_2 = 'var(--plate-mass-2)'
const MASS_3 = 'var(--plate-mass-3)'
const LINE = 'var(--plate-line)'
const ACCENT = 'var(--plate-accent)'

/** Thin repeating rule, used as a drafting hatch inside a mass. */
function Hatch({ id, angle = 45, gap = 7 }) {
  return (
    <pattern
      id={id}
      width={gap}
      height={gap}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line x1="0" y1="0" x2="0" y2={gap} stroke={LINE} strokeWidth="1" />
    </pattern>
  )
}

/** A dimension string: witness lines, a rule and two ticks. */
function Dim({ x1, x2, y }) {
  return (
    <g stroke={LINE} strokeWidth="1">
      <line x1={x1} y1={y - 6} x2={x1} y2={y + 6} />
      <line x1={x2} y1={y - 6} x2={x2} y2={y + 6} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
    </g>
  )
}

/** Evenly spaced vertical mullions across a face. */
function Mullions({ x, y, w, h, count }) {
  const out = []
  for (let i = 1; i < count; i += 1) {
    const cx = x + (w * i) / count
    out.push(<line key={i} x1={cx} y1={y} x2={cx} y2={y + h} stroke={LINE} strokeWidth="1" />)
  }
  return <g>{out}</g>
}

/** Stacked floor lines. */
function Floors({ x, y, w, h, count }) {
  const out = []
  for (let i = 1; i < count; i += 1) {
    const cy = y + (h * i) / count
    out.push(<line key={i} x1={x} y1={cy} x2={x + w} y2={cy} stroke={LINE} strokeWidth="1" />)
  }
  return <g>{out}</g>
}

function Ground({ y = 250 }) {
  return (
    <g>
      <line x1="0" y1={y} x2="400" y2={y} stroke={LINE} strokeWidth="1.5" />
      {Array.from({ length: 26 }, (_, i) => (
        <line
          key={i}
          x1={i * 16}
          y1={y}
          x2={i * 16 - 8}
          y2={y + 9}
          stroke={LINE}
          strokeWidth="1"
          opacity="0.7"
        />
      ))}
    </g>
  )
}

/* --------------------------------------------------------------- the plates */
const DRAWINGS = {
  /** Podium + tower over a service road. */
  tower: (h) => (
    <>
      <rect x="36" y="196" width="300" height="54" fill={MASS_3} />
      <rect x="58" y="74" width="128" height="122" fill={MASS} />
      <rect x="186" y="40" width="96" height="156" fill={MASS_2} />
      <rect x="282" y="118" width="46" height="78" fill={MASS_3} />
      <Floors x={58} y={74} w={128} h={122} count={6} />
      <Mullions x={186} y={40} w={96} h={156} count={7} />
      <rect x={186} y={40} width={96} height={156} fill={`url(#${h})`} opacity="0.5" />
      <rect x="196" y="18" width="34" height="22" fill={MASS} />
      <line x1="246" y1="40" x2="246" y2="8" stroke={LINE} strokeWidth="1.5" />
      <rect x="96" y="214" width="64" height="36" fill={ACCENT} opacity="0.9" />
      <Dim x1={58} x2={328} y={272} />
      <Ground />
    </>
  ),

  /** Long-span shed: portal frames and a saw-tooth roof. */
  works: (h) => (
    <>
      <rect x="20" y="132" width="348" height="118" fill={MASS_3} />
      <path
        d="M20 132 L68 96 L68 132 M92 132 L140 96 L140 132 M164 132 L212 96 L212 132 M236 132 L284 96 L284 132 M308 132 L356 96 L356 132"
        fill={MASS}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <rect x={20} y={132} width={348} height={118} fill={`url(#${h})`} opacity="0.35" />
      {[68, 140, 212, 284].map((x) => (
        <line key={x} x1={x} y1="132" x2={x} y2="250" stroke={LINE} strokeWidth="1.5" />
      ))}
      <rect x="150" y="196" width="88" height="54" fill={MASS_2} />
      <rect x="40" y="212" width="38" height="38" fill={ACCENT} opacity="0.85" />
      <Dim x1={20} x2={368} y={272} />
      <Ground />
    </>
  ),

  /** Section through a full-height atrium. */
  atrium: (h) => (
    <>
      <rect x="44" y="62" width="92" height="188" fill={MASS} />
      <rect x="264" y="62" width="92" height="188" fill={MASS} />
      <rect x="136" y="62" width="128" height="188" fill={MASS_3} />
      <rect x={136} y={62} width={128} height={188} fill={`url(#${h})`} opacity="0.42" />
      <Floors x={44} y={62} w={92} h={188} count={6} />
      <Floors x={264} y={62} w={92} h={188} count={6} />
      {[1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line x1="136" y1={62 + (188 * i) / 6} x2="168" y2={62 + (188 * i) / 6} stroke={LINE} strokeWidth="1" />
          <line x1="232" y1={62 + (188 * i) / 6} x2="264" y2={62 + (188 * i) / 6} stroke={LINE} strokeWidth="1" />
        </g>
      ))}
      <path d="M136 62 L200 34 L264 62" fill="none" stroke={LINE} strokeWidth="1.5" />
      <rect x="176" y="208" width="48" height="42" fill={ACCENT} opacity="0.85" />
      <Dim x1={44} x2={356} y={272} />
      <Ground />
    </>
  ),

  /** Restored colonnade with a new hall behind it. */
  civic: (h) => (
    <>
      <rect x="30" y="88" width="340" height="162" fill={MASS_3} />
      <rect x={30} y={88} width={340} height={162} fill={`url(#${h})`} opacity="0.3" />
      <rect x="52" y="118" width="296" height="132" fill={MASS} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={64 + i * 42} width="20" y="128" height="122" fill={MASS_2} />
      ))}
      <rect x="52" y="106" width="296" height="16" fill={MASS_2} />
      <path d="M52 106 L200 66 L348 106" fill={MASS} stroke={LINE} strokeWidth="1.5" />
      <rect x="188" y="214" width="24" height="36" fill={ACCENT} opacity="0.9" />
      <Dim x1={52} x2={348} y={272} />
      <Ground />
    </>
  ),

  /* ---- capability viewports: closer in, more diagram than elevation */
  precon: (h) => (
    <>
      <rect x="40" y="48" width="320" height="180" fill={MASS_3} />
      <rect x={40} y={48} width={320} height={180} fill={`url(#${h})`} opacity="0.28" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={40 + i * 64} y1="48" x2={40 + i * 64} y2="228" stroke={LINE} strokeWidth="1" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="40" y1={48 + i * 60} x2="360" y2={48 + i * 60} stroke={LINE} strokeWidth="1" />
      ))}
      <rect x="104" y="108" width="128" height="60" fill={MASS} />
      <rect x="232" y="48" width="64" height="60" fill={MASS_2} />
      <rect x="40" y="188" width="132" height="12" fill={ACCENT} opacity="0.9" />
      <Dim x1={40} x2={360} y={252} />
    </>
  ),

  manage: (h) => (
    <>
      <rect x="36" y="40" width="328" height="196" fill={MASS_3} />
      <rect x={36} y={40} width={328} height={196} fill={`url(#${h})`} opacity="0.3" />
      <rect x="36" y="176" width="328" height="60" fill={MASS} />
      <rect x="76" y="112" width="248" height="64" fill={MASS_2} />
      <rect x="116" y="60" width="168" height="52" fill={MASS} />
      {[76, 140, 204, 268, 324].map((x) => (
        <line key={x} x1={x} y1="60" x2={x} y2="236" stroke={LINE} strokeWidth="1.5" />
      ))}
      <rect x="300" y="60" width="14" height="176" fill={ACCENT} opacity="0.85" />
      <Dim x1={36} x2={364} y={256} />
    </>
  ),

  closeout: (h) => (
    <>
      <rect x="48" y="52" width="304" height="184" fill={MASS} />
      <rect x={48} y={52} width={304} height={184} fill={`url(#${h})`} opacity="0.22" />
      <Floors x={48} y={52} w={304} h={184} count={4} />
      <Mullions x={48} y={52} w={304} h={184} count={8} />
      <rect x="48" y="52" width="76" height="46" fill={MASS_2} />
      <rect x="276" y="190" width="76" height="46" fill={MASS_2} />
      <rect x="162" y="112" width="76" height="64" fill={ACCENT} opacity="0.9" />
      <Dim x1={48} x2={352} y={256} />
    </>
  ),

  /* ---- film-strip frames: simple, legible at small size */
  foundation: (h) => (
    <>
      <rect x="0" y="150" width="400" height="140" fill={MASS_3} />
      <rect x={0} y={150} width={400} height={140} fill={`url(#${h})`} opacity="0.4" />
      <rect x="48" y="118" width="304" height="34" fill={MASS} />
      {[76, 148, 220, 292].map((x) => (
        <rect key={x} x={x} y="76" width="18" height="42" fill={MASS_2} />
      ))}
      <line x1="0" y1="150" x2="400" y2="150" stroke={LINE} strokeWidth="1.5" />
      <rect x="24" y="196" width="52" height="14" fill={ACCENT} opacity="0.9" />
    </>
  ),

  structure: () => (
    <>
      <rect x="0" y="250" width="400" height="40" fill={MASS_3} />
      {[64, 136, 208, 280].map((x) => (
        <rect key={x} x={x} y="46" width="16" height="204" fill={MASS} />
      ))}
      {[92, 148, 204].map((y) => (
        <rect key={y} x="56" y={y} width="240" height="12" fill={MASS_2} />
      ))}
      <rect x="296" y="46" width="12" height="204" fill={ACCENT} opacity="0.8" />
      <line x1="0" y1="250" x2="400" y2="250" stroke={LINE} strokeWidth="1.5" />
    </>
  ),

  envelope: (h) => (
    <>
      <rect x="34" y="34" width="332" height="222" fill={MASS_3} />
      <rect x={34} y={34} width={332} height={222} fill={`url(#${h})`} opacity="0.34" />
      <Mullions x={34} y={34} w={332} h={222} count={9} />
      <Floors x={34} y={34} w={332} h={222} count={5} />
      <rect x="34" y="34" width="74" height="88" fill={MASS} />
      <rect x="292" y="168" width="74" height="88" fill={MASS_2} />
      <rect x="145" y="34" width="37" height="222" fill={ACCENT} opacity="0.55" />
    </>
  ),

  interiors: (h) => (
    <>
      <rect x="0" y="44" width="400" height="212" fill={MASS_3} />
      <rect x={0} y={44} width={400} height={212} fill={`url(#${h})`} opacity="0.2" />
      <rect x="0" y="214" width="400" height="42" fill={MASS} />
      <rect x="42" y="96" width="120" height="118" fill={MASS_2} />
      <rect x="196" y="128" width="92" height="86" fill={MASS} />
      <rect x="312" y="72" width="58" height="142" fill={MASS_2} />
      <line x1="0" y1="214" x2="400" y2="214" stroke={LINE} strokeWidth="1.5" />
      <rect x="196" y="112" width="92" height="10" fill={ACCENT} opacity="0.9" />
    </>
  ),

  handover: () => (
    <>
      <rect x="0" y="252" width="400" height="38" fill={MASS_3} />
      <rect x="56" y="70" width="132" height="182" fill={MASS} />
      <rect x="188" y="112" width="156" height="140" fill={MASS_2} />
      <Floors x={56} y={70} w={132} h={182} count={5} />
      <Mullions x={188} y={112} w={156} h={140} count={6} />
      <path d="M56 70 L122 40 L188 70" fill={MASS_2} stroke={LINE} strokeWidth="1.5" />
      <rect x="230" y="216" width="72" height="36" fill={ACCENT} opacity="0.9" />
      <line x1="0" y1="252" x2="400" y2="252" stroke={LINE} strokeWidth="1.5" />
    </>
  ),
}

function Plate({ kind, className = '' }) {
  const id = useId().replace(/:/g, '')
  const draw = DRAWINGS[kind] ?? DRAWINGS.tower
  return (
    <svg
      className={`plate ${className}`}
      viewBox="0 0 400 290"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <Hatch id={id} />
      </defs>
      <rect x="0" y="0" width="400" height="290" fill="var(--plate-bg)" />
      {draw(id)}
    </svg>
  )
}

export default Plate
