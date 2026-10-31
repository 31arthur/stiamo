import { cn } from '@/lib/utils'
import type { FileKind } from '@/domain/drive/Drive'

const COLOR: Record<FileKind, string> = {
  doc: '#4285F4',
  sheet: '#0F9D58',
  slides: '#F4B400',
  pdf: '#E5453B',
  word: '#2B579A',
  excel: '#1D6F42',
  image: '#8E5CE6',
  other: '#8A93A3',
}

/** What is drawn on the page: lines for text, a grid for sheets, a frame for slides, a letter for Office files. */
function Mark({ kind }: { kind: FileKind }) {
  const white = { fill: 'none', stroke: '#fff', strokeWidth: 1.8, strokeLinecap: 'round' as const }
  switch (kind) {
    case 'doc':
      return <path d="M9 18h14M9 23h14M9 28h9" {...white} />
    case 'sheet':
      return (
        <g {...white} strokeWidth={1.6}>
          <rect x="8.5" y="16.5" width="15" height="14" rx="1.5" />
          <path d="M8.5 21.2h15M8.5 25.8h15M16 16.5v14" />
        </g>
      )
    case 'slides':
      return <rect x="8.5" y="18" width="15" height="10.5" rx="1.8" {...white} />
    case 'image':
      return (
        <g fill="#fff">
          <circle cx="12.5" cy="20.5" r="2" />
          <path d="M8.5 30l5.2-6.4 3.4 4 2.6-2.6L23.5 30z" />
        </g>
      )
    case 'pdf':
      return (
        <text x="16" y="27.5" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif" letterSpacing="0.2">
          PDF
        </text>
      )
    case 'word':
    case 'excel':
      return (
        <text x="16" y="29" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
          {kind === 'word' ? 'W' : 'X'}
        </text>
      )
    default:
      return <path d="M9 21h14M9 26h8" {...white} opacity={0.7} />
  }
}

/** A page in the colour of what it holds, so a list of letters can be read at a glance. */
export function FileTypeIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const color = COLOR[kind]
  return (
    <svg viewBox="0 0 32 40" aria-hidden className={cn('shrink-0 drop-shadow-[0_1px_1.5px_rgb(0_0_0/18%)]', className)}>
      <path d="M5 1.5h14.5L28 10v26.5a2.5 2.5 0 0 1-2.5 2.5h-18A2.5 2.5 0 0 1 5 36.5v-33A2 2 0 0 1 5 1.5z" fill={color} />
      <path d="M19.5 1.5L28 10h-6.5a2 2 0 0 1-2-2V1.5z" fill="#fff" opacity={0.38} />
      <Mark kind={kind} />
    </svg>
  )
}
