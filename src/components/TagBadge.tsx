import { TAG_PARTITA } from '../db/schema'
import type { TagPartita } from '../db/schema'

export default function TagBadge({ tag }: { tag: TagPartita | undefined }) {
  if (!tag) return null
  const conf = TAG_PARTITA.find((t) => t.value === tag)
  if (!conf) return null
  return (
    <span
      className={`inline-block ${conf.coloreBg} ${conf.colore} text-xs font-semibold px-2.5 py-1 rounded-full`}
    >
      {tag}
    </span>
  )
}