/** The seven segments of a digit: top, upper right, lower right, bottom, lower left, upper left, middle. */
type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'

const SEGMENTS: Readonly<Record<string, readonly Segment[]>> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'd', 'c'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
  '-': ['g'],
  ' ': [],
}

const ALL: readonly Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

/** Each segment as a polygon in a 12 × 20 cell, with pointed ends as on real displays. */
const SHAPES: Readonly<Record<Segment, string>> = {
  a: '2.6,1.2 9.4,1.2 10.6,2.2 9.4,3.2 2.6,3.2 1.4,2.2',
  b: '10.8,2.6 11.8,3.8 11.8,8.8 10.8,9.8 9.8,8.8 9.8,3.8',
  c: '10.8,10.2 11.8,11.2 11.8,16.2 10.8,17.4 9.8,16.2 9.8,11.2',
  d: '2.6,16.8 9.4,16.8 10.6,17.8 9.4,18.8 2.6,18.8 1.4,17.8',
  e: '1.2,10.2 2.2,11.2 2.2,16.2 1.2,17.4 0.2,16.2 0.2,11.2',
  f: '1.2,2.6 2.2,3.8 2.2,8.8 1.2,9.8 0.2,8.8 0.2,3.8',
  g: '2.6,9 9.4,9 10.6,10 9.4,11 2.6,11 1.4,10',
}

const CELL = 13
const NARROW = 5

export interface LcdProps {
  /** Digits, spaces, minus signs, a colon or a point. */
  readonly value: string
  /** At least this many digit cells; unlit cells show as faint eights, as on a real display. */
  readonly digits?: number
  /** The color of lit segments, any CSS color. */
  readonly color?: string
  /** Height in pixels. */
  readonly size?: number
  readonly label?: string
}

/**
 * A number on a little LCD: seven-segment digits, slanted, glowing where lit, with the unlit
 * segments faintly visible behind them. Drawn in SVG, so it needs no font.
 */
export function Lcd({ value, digits = 0, color = 'var(--lcd)', size = 22, label }: LcdProps) {
  const cells = [...value]
  const digitCount = cells.filter((cell) => cell !== ':' && cell !== '.').length
  for (let pad = digitCount; pad < digits; pad++) cells.unshift(' ')
  let x = 0
  const parts = cells.map((cell, index) => {
    const at = x
    if (cell === ':' || cell === '.') {
      x += NARROW
      const lit = { fill: color }
      return cell === ':' ? (
        <g key={index} transform={`translate(${at} 0)`}>
          <rect x={1.6} y={5.5} width={1.8} height={1.8} rx={0.4} style={lit} />
          <rect x={1.2} y={12.5} width={1.8} height={1.8} rx={0.4} style={lit} />
        </g>
      ) : (
        <rect key={index} x={at + 1.2} y={17} width={1.8} height={1.8} rx={0.4} style={lit} />
      )
    }
    x += CELL
    const on = new Set(SEGMENTS[cell] ?? [])
    return (
      <g key={index} transform={`translate(${at} 0)`}>
        {ALL.map((segment) => (
          <polygon
            key={segment}
            points={SHAPES[segment]}
            class={on.has(segment) ? 'lcd-on' : 'lcd-off'}
            style={on.has(segment) ? { fill: color } : undefined}
          />
        ))}
      </g>
    )
  })
  const width = Math.max(1, x)
  return (
    <svg
      class="lcd"
      viewBox={`-1 0 ${width + 2} 20`}
      height={size}
      width={(size * (width + 2)) / 20}
      role="img"
      aria-label={label ? `${label}: ${value.trim()}` : value.trim()}
      style={{ color }}
    >
      <g transform="skewX(-7) translate(2.4 0)">{parts}</g>
    </svg>
  )
}
