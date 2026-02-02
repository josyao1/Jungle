// Calculate averaged line with outlier removal using IQR method
export function calculateAveragedLine(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length === 1) return roundLine(values[0])
  if (values.length === 2) return roundLine((values[0] + values[1]) / 2)

  // Sort values
  const sorted = [...values].sort((a, b) => a - b)

  // Calculate Q1 and Q3
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]

  // Calculate IQR and bounds
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  // Filter outliers
  const filtered = sorted.filter(v => v >= lowerBound && v <= upperBound)

  // If all values are outliers, just use the median
  if (filtered.length === 0) {
    const mid = Math.floor(sorted.length / 2)
    return roundLine(sorted[mid])
  }

  // Calculate mean of filtered values
  const mean = filtered.reduce((sum, v) => sum + v, 0) / filtered.length

  return roundLine(mean)
}

// Round to nearest whole number
export function roundLine(value: number): number {
  return Math.round(value)
}

// Format time remaining
export function formatTimeRemaining(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) return 'Locked'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }

  return `${hours}h ${minutes}m`
}

// Calculate scores for a game
export function calculateScores(
  picks: Array<{ picker: string; player: string; stat: string; picked: boolean }>,
  lines: Array<{ player: string; stat: string; value: number }>,
  results: Array<{ player: string; stat: string; value: number }>,
  predictions: Array<{ submitter: string; player: string; stat: string; value: number }>,
  propPicks: Array<{ picker: string; prop_type: string; player_picked: string }>,
  propResults: Record<string, string>
): Map<string, { correctPicks: number; missedPicks: number; exactLines: number; propWins: number; propMisses: number; totalPoints: number }> {
  const scores = new Map<string, { correctPicks: number; missedPicks: number; exactLines: number; propWins: number; propMisses: number; totalPoints: number }>()

  // Create lookup maps
  const lineMap = new Map<string, number>()
  lines.forEach(l => lineMap.set(`${l.player}-${l.stat}`, l.value))

  const resultMap = new Map<string, number>()
  results.forEach(r => resultMap.set(`${r.player}-${r.stat}`, r.value))

  // Calculate pick scores (only overs - did they hit the line?)
  picks.forEach(pick => {
    if (!pick.picked) return // They didn't pick this line

    const key = `${pick.player}-${pick.stat}`
    const line = lineMap.get(key)
    const result = resultMap.get(key)

    if (line === undefined || result === undefined) return

    const current = scores.get(pick.picker) || { correctPicks: 0, missedPicks: 0, exactLines: 0, propWins: 0, propMisses: 0, totalPoints: 0 }

    // Check if they hit (result >= line, since we're being supportive)
    if (result >= line) {
      current.correctPicks++
      current.totalPoints += 1
    } else {
      // Missed the over - penalty
      current.missedPicks++
      current.totalPoints -= 0.5
    }

    scores.set(pick.picker, current)
  })

  // Calculate exact line bonus
  predictions.forEach(pred => {
    const key = `${pred.player}-${pred.stat}`
    const result = resultMap.get(key)

    if (result === undefined) return

    const current = scores.get(pred.submitter) || { correctPicks: 0, missedPicks: 0, exactLines: 0, propWins: 0, propMisses: 0, totalPoints: 0 }

    // Exact match bonus
    if (pred.value === result) {
      current.exactLines++
      current.totalPoints += 1
    }

    scores.set(pred.submitter, current)
  })

  // Calculate prop bet scores (no penalty for misses)
  propPicks.forEach(prop => {
    const current = scores.get(prop.picker) || { correctPicks: 0, missedPicks: 0, exactLines: 0, propWins: 0, propMisses: 0, totalPoints: 0 }

    const winner = propResults[prop.prop_type]
    if (winner) {
      if (prop.player_picked === winner) {
        current.propWins++
        current.totalPoints += 1
      }
      // No penalty for wrong prop picks
    }

    scores.set(prop.picker, current)
  })

  return scores
}
