import { createContext, useContext } from 'react'

export type Direction = 'cinematic' | 'arcade' | 'liquid'

export const DIR_LABELS: Record<Direction, string> = {
  cinematic: 'Cinematic',
  arcade: 'Arcade',
  liquid: 'Liquid',
}

// Auto-scroll velocity multiplier per motion preset (from the design's _velFactor).
export const DIR_VEL: Record<Direction, number> = {
  cinematic: 0.7,
  arcade: 1.55,
  liquid: 1.05,
}

export interface ShellContextValue {
  direction: Direction
  setDirection: (d: Direction) => void
  /** Current auto-scroll velocity multiplier for rails. */
  velFactor: number
  /** True once the intro has finished (gates count-ups / reveals). */
  ready: boolean
  /** Show a transient toast message. */
  toast: (msg: string) => void
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used within AppShell')
  return ctx
}
