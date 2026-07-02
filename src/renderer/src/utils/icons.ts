import type { LucideProps } from 'lucide-react'

/** Solid playback / navigation icons (Play, Pause, chevrons, etc.). */
export const filledIconProps: Pick<LucideProps, 'fill' | 'stroke' | 'strokeWidth'> = {
  fill: 'currentColor',
  stroke: 'currentColor',
  strokeWidth: 0
}

/** Stroke-based icons (gear, etc.) — do not use filledIconProps on these. */
export const outlineIconProps: Pick<LucideProps, 'fill' | 'stroke' | 'strokeWidth'> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.25
}
