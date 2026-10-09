/**
 * Format large numbers compactly: 741738 -> "741.7K", 6534237 -> "6.5M"
 */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toString()
}

/**
 * Format with full comma separation: 741738 -> "741,738"
 */
export function formatFull(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

/**
 * Format a percentage delta: 0.079 -> "+7.9%", -0.03 -> "-3.0%"
 */
export function formatDelta(ratio: number): string {
  const pct = (ratio * 100).toFixed(1)
  return ratio >= 0 ? `+${pct}%` : `${pct}%`
}

/**
 * Format a percentage from an already-computed integer: 24 -> "+24%"
 */
export function formatPctChange(pct: number): string {
  return pct >= 0 ? `+${Math.round(pct)}%` : `${Math.round(pct)}%`
}

/**
 * Format week label: 152 -> "W152"
 */
export function formatWeek(w: number): string {
  return `W${w}`
}

/**
 * Format Y-axis tick: 600000 -> "600k"
 */
export function formatAxisTick(val: number): string {
  if (val === 0) return '0'
  return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val)
}