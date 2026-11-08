// «Қошқар мүйіз» оюы: орталық сабақтан екі жаққа бұралған мүйіз.
const HORNS =
  'M32 30V20M32 20C32 13 26 8 19 8C12 8 8 12.5 8 17.5C8 22 11.5 25 15 25C18.5 25 20 22.5 20 20.5C20 18.5 18.5 17 16.5 17' +
  'M32 20C32 13 38 8 45 8C52 8 56 12.5 56 17.5C56 22 52.5 25 49 25C45.5 25 44 22.5 44 20.5C44 18.5 45.5 17 47.5 17'

export function Horns({ width = 64, className, strokeWidth = 2.6 }: { width?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={width} height={(width * 32) / 64} viewBox="0 0 64 32" fill="none" className={className} aria-hidden="true">
      <path d={HORNS} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Бренд белгісі: көк шаршы ішінде шафран мүйіз. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo">
      <rect width="48" height="48" rx="13" fill="var(--brand)" />
      <g transform="translate(6 12) scale(0.5625)">
        <path d={HORNS} fill="none" stroke="var(--saffron)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Бөлгіш сызық: ортасында кішкентай мүйіз. */
export function OrnamentRule({ className }: { className?: string }) {
  return (
    <div className={`orn-rule ${className ?? ''}`} aria-hidden="true">
      <span />
      <Horns width={36} strokeWidth={3} />
      <span />
    </div>
  )
}
