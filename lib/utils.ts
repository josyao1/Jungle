/**
 * utils.ts — Core utility functions for the Jungle Softball Sportsbook.
 *
 * calculateAveragedLine: Computes the consensus line from all player predictions
 *   using IQR-based outlier removal to prevent trolling.
 *
 * calculateScores: Simplified scoring — +1 for correct over, -0.5 for missed over.
 *   No prop bets, no exact-line bonuses.
 *
 * formatTimeRemaining: Human-readable countdown to game lock time.
 */

// Calculate averaged line with outlier removal using IQR method
export function calculateAveragedLine(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length === 1) return roundLine(values[0])
  if (values.length === 2) return roundLine((values[0] + values[1]) / 2)

  const sorted = [...values].sort((a, b) => a - b)

  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]

  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  const filtered = sorted.filter(v => v >= lowerBound && v <= upperBound)

  if (filtered.length === 0) {
    const mid = Math.floor(sorted.length / 2)
    return roundLine(sorted[mid])
  }

  const mean = filtered.reduce((sum, v) => sum + v, 0) / filtered.length
  return roundLine(mean)
}

export function roundLine(value: number): number {
  return Math.round(value)
}

export function formatTimeRemaining(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) return 'Locked'

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  // Under 24h — show HH:MM:SS
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Returns ms until lock, or 0 if already locked
export function msUntilLock(targetDate: Date): number {
  return Math.max(0, targetDate.getTime() - Date.now())
}

// Simplified scoring: right pick = +1, missed pick = -0.5, no bonuses
export function calculateScores(
  picks: Array<{ picker: string; player: string; stat: string; picked: boolean }>,
  lines: Array<{ player: string; stat: string; value: number }>,
  results: Array<{ player: string; stat: string; value: number }>,
): Map<string, { correctPicks: number; missedPicks: number; totalPoints: number }> {
  const scores = new Map<string, { correctPicks: number; missedPicks: number; totalPoints: number }>()

  const lineMap = new Map<string, number>()
  lines.forEach(l => lineMap.set(`${l.player}-${l.stat}`, l.value))

  const resultMap = new Map<string, number>()
  results.forEach(r => resultMap.set(`${r.player}-${r.stat}`, r.value))

  picks.forEach(pick => {
    if (!pick.picked) return

    const key = `${pick.player}-${pick.stat}`
    const line = lineMap.get(key)
    const result = resultMap.get(key)

    if (line === undefined || result === undefined) return

    const current = scores.get(pick.picker) || { correctPicks: 0, missedPicks: 0, totalPoints: 0 }

    if (result >= line) {
      current.correctPicks++
      current.totalPoints += 1
    } else {
      current.missedPicks++
      current.totalPoints -= 0.5
    }

    scores.set(pick.picker, current)
  })

  return scores
}
