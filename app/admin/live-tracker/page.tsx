'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { GAMES, getPlayersForGame, getCurrentGame } from '@/lib/constants'
import { supabase, getInactivePlayersForGame } from '@/lib/supabase'

// ── IP helpers (thirds-of-an-inning, same convention as admin page) ──────────
function thirdsToIpDisplay(thirds: number): string {
  if (thirds === 0) return '0'
  const full = Math.floor(thirds / 3)
  const rem = thirds % 3
  return rem > 0 ? `${full}.${rem}` : `${full}`
}

// ── Stat definitions ─────────────────────────────────────────────────────────
const HITTING_STATS = [
  { key: 'hits',        label: 'Hits' },
  { key: 'rbis',        label: 'RBIs' },
  { key: 'runs',        label: 'Runs' },
  { key: 'errors',      label: 'Errors' },
  { key: 'strikeouts',  label: 'Ks (throw)' },
  { key: 'ab',          label: 'AB' },
  { key: 'homeruns',    label: 'HR' },
] as const

const PITCHING_STATS = [
  { key: 'ip',           label: 'IP' },
  { key: 'runs_allowed', label: 'Runs Allowed' },
] as const

type AnyStatKey = typeof HITTING_STATS[number]['key'] | typeof PITCHING_STATS[number]['key']
type PlayerStats = Record<AnyStatKey | string, number>
type AllStats = Record<string, PlayerStats>

// ── localStorage keys ────────────────────────────────────────────────────────
const lsKey = (gameNum: number, type: 'stats' | 'order' | 'finalized') =>
  `jungle_live_${type}_g${gameNum}`

const emptyPlayerStats = (): PlayerStats => ({
  hits: 0, rbis: 0, runs: 0, errors: 0, strikeouts: 0,
  ab: 0, homeruns: 0, ip: 0, runs_allowed: 0,
})

// ── Sub-components ────────────────────────────────────────────────────────────
function StatRow({
  label, value, statKey, onIncrement, onDecrement,
}: {
  label: string
  value: number
  statKey: string
  onIncrement: () => void
  onDecrement: () => void
}) {
  const display = statKey === 'ip' ? thirdsToIpDisplay(value) : String(value)
  const isZero = value === 0

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex-1 text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrement}
          className="w-11 h-11 rounded-xl border border-white/10 text-slate-200 text-xl font-bold active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          −
        </button>
        <span
          className="w-10 text-center font-bold text-base tabular-nums"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: isZero ? '#334155' : '#e2e8f0',
          }}
        >
          {display}
        </span>
        <button
          onClick={onIncrement}
          className="w-11 h-11 rounded-xl border border-white/10 text-slate-200 text-xl font-bold active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveTrackerPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState(() => getCurrentGame().number)
  const [gameId, setGameId] = useState<string | null>(null)
  const [playerOrder, setPlayerOrder] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [stats, setStats] = useState<AllStats>({})
  const [editingOrder, setEditingOrder] = useState(false)
  const [draftOrder, setDraftOrder] = useState<string[]>([])
  const [finalized, setFinalized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load game + restore draft from localStorage ──────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const savedPlayer = localStorage.getItem('jungle_player')
      setCurrentUser(savedPlayer)

      // Fetch game row from Supabase
      const { data: gameRow } = await supabase
        .from('jungle_games')
        .select('id, game_number')
        .eq('game_number', selectedGame)
        .single()

      if (!gameRow) { setLoading(false); return }
      setGameId(gameRow.id)

      // Active players for this game
      const inactive = await getInactivePlayersForGame(gameRow.id)
      const gamePlayers = getPlayersForGame(selectedGame).filter(p => !inactive.has(p))

      // Restore or build batting order
      const rawOrder = localStorage.getItem(lsKey(selectedGame, 'order'))
      let order: string[]
      if (rawOrder) {
        const saved = JSON.parse(rawOrder) as string[]
        // Keep saved order, add any new active players alphabetically at the end
        const gameSet = new Set(gamePlayers as string[])
        order = [
          ...saved.filter(p => gameSet.has(p)),
          ...(gamePlayers as string[]).filter(p => !saved.includes(p)).sort(),
        ]
      } else {
        order = [...gamePlayers].sort((a, b) => a.localeCompare(b))
      }
      setPlayerOrder(order)

      // Restore draft stats
      const rawStats = localStorage.getItem(lsKey(selectedGame, 'stats'))
      const initialStats: AllStats = {}
      gamePlayers.forEach(p => { initialStats[p] = emptyPlayerStats() })
      if (rawStats) {
        const saved = JSON.parse(rawStats) as AllStats
        gamePlayers.forEach(p => {
          if (saved[p]) {
            Object.keys(emptyPlayerStats()).forEach(k => {
              initialStats[p][k] = saved[p][k] ?? 0
            })
          }
        })
      }
      setStats(initialStats)

      // Restore finalized flag
      setFinalized(!!localStorage.getItem(lsKey(selectedGame, 'finalized')))

      setLoading(false)
    }

    load()
  }, [selectedGame])

  // ── Autosave draft to localStorage ───────────────────────────────────────
  const persistStats = useCallback((newStats: AllStats) => {
    localStorage.setItem(lsKey(selectedGame, 'stats'), JSON.stringify(newStats))
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved')
      idleTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1200)
    }, 250)
  }, [selectedGame])

  // ── Increment / decrement a stat ─────────────────────────────────────────
  const adjustStat = useCallback((player: string, stat: string, delta: number) => {
    setStats(prev => {
      const updated: AllStats = {
        ...prev,
        [player]: {
          ...prev[player],
          [stat]: Math.max(0, (prev[player]?.[stat] ?? 0) + delta),
        },
      }
      persistStats(updated)
      return updated
    })
  }, [persistStats])

  // ── Player navigation ─────────────────────────────────────────────────────
  const goNext = () => { if (playerOrder.length > 0) setSelectedIndex(i => (i + 1) % playerOrder.length) }
  const goPrev = () => { if (playerOrder.length > 0) setSelectedIndex(i => (i - 1 + playerOrder.length) % playerOrder.length) }

  // ── Batting order editing ─────────────────────────────────────────────────
  const openEditOrder = () => {
    setDraftOrder([...playerOrder])
    setEditingOrder(true)
  }

  const movePlayerInDraft = (index: number, direction: -1 | 1) => {
    const next = [...draftOrder]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraftOrder(next)
  }

  const saveOrder = () => {
    setPlayerOrder(draftOrder)
    localStorage.setItem(lsKey(selectedGame, 'order'), JSON.stringify(draftOrder))
    const currentPlayer = playerOrder[selectedIndex]
    const newIdx = draftOrder.indexOf(currentPlayer)
    setSelectedIndex(newIdx >= 0 ? newIdx : 0)
    setEditingOrder(false)
  }

  // ── Finalize: write draft to jungle_results ───────────────────────────────
  const handleFinalize = async () => {
    if (!gameId) return
    setSaveStatus('saving')

    const rows: { game_id: string; player: string; stat: string; value: number }[] = []
    for (const player of playerOrder) {
      const ps = stats[player]
      if (!ps) continue
      Object.entries(ps).forEach(([stat, value]) => {
        // Skip zeros — consistent with admin page (blank input = no row in DB).
        // Prevents ip:0 causing ERA division-by-zero on the stats page.
        if (value > 0) rows.push({ game_id: gameId, player, stat, value })
      })
    }

    // Delete existing results for this game first, then insert fresh
    const { error: delErr } = await supabase
      .from('jungle_results')
      .delete()
      .eq('game_id', gameId)

    if (delErr) {
      alert('Failed to clear old results: ' + delErr.message)
      setSaveStatus('idle')
      return
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from('jungle_results')
        .insert(rows)

      if (insErr) {
        alert('Failed to publish stats: ' + insErr.message)
        setSaveStatus('idle')
        return
      }
    }

    localStorage.setItem(lsKey(selectedGame, 'finalized'), '1')
    setFinalized(true)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
    alert('Stats published to stat board!')
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  if (currentUser !== 'joshua') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-2">Admin access restricted to Joshua.</p>
        <Link href="/" className="text-emerald-400 hover:underline text-sm">Go home</Link>
      </div>
    )
  }

  const currentPlayer = playerOrder[selectedIndex] ?? playerOrder[0]
  const gameLabel = GAMES.find(g => g.number === selectedGame)?.label ?? `Week ${selectedGame}`

  return (
    <div className="max-w-sm mx-auto space-y-4 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-200 text-sm shrink-0">
          ← Admin
        </Link>
        <h1 className="font-bold text-lg">Live Tracker</h1>
        {finalized && (
          <span className="ml-auto shrink-0 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            Published
          </span>
        )}
      </div>

      {/* ── Game selector ── */}
      <div className="week-selector">
        {GAMES.map(g => (
          <button
            key={g.number}
            onClick={() => { setSelectedGame(g.number); setSelectedIndex(0) }}
            className={`week-btn ${selectedGame === g.number ? 'active' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Player selector ── */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs uppercase tracking-widest text-slate-500">
            {gameLabel} · {playerOrder.length} players
          </span>
          <button
            onClick={openEditOrder}
            className="ml-auto text-xs text-slate-400 hover:text-slate-200 border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            Edit Order
          </button>
        </div>

        <select
          value={currentPlayer}
          onChange={e => setSelectedIndex(playerOrder.indexOf(e.target.value))}
          className="w-full glass-input rounded-xl px-3 py-3 text-sm capitalize font-medium"
        >
          {playerOrder.map((p, i) => (
            <option key={p} value={p} className="bg-gray-900 capitalize">
              {i + 1}. {p}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={goPrev} className="btn-secondary py-3 rounded-xl text-sm font-medium">
            ← Prev
          </button>
          <button onClick={goNext} className="btn-secondary py-3 rounded-xl text-sm font-medium">
            Next →
          </button>
        </div>
      </div>

      {/* ── Stats panel ── */}
      {currentPlayer && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base capitalize" style={{ color: 'var(--emerald-glow)' }}>
              {currentPlayer}
            </h2>
            <span
              className="text-xs transition-all"
              style={{
                color: saveStatus === 'saved' ? '#22c55e' : '#64748b',
                opacity: saveStatus === 'idle' ? 0 : 1,
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
            </span>
          </div>

          {/* Hitting */}
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Hitting</p>
          <div className="space-y-0.5">
            {HITTING_STATS.map(({ key, label }) => (
              <StatRow
                key={key}
                label={label}
                value={stats[currentPlayer]?.[key] ?? 0}
                statKey={key}
                onIncrement={() => adjustStat(currentPlayer, key, 1)}
                onDecrement={() => adjustStat(currentPlayer, key, -1)}
              />
            ))}
          </div>

          {/* Pitching */}
          <p className="text-xs uppercase tracking-widest text-slate-500 mt-4 mb-2">Pitching</p>
          <div className="space-y-0.5">
            {PITCHING_STATS.map(({ key, label }) => (
              <StatRow
                key={key}
                label={label}
                value={stats[currentPlayer]?.[key] ?? 0}
                statKey={key}
                onIncrement={() => adjustStat(currentPlayer, key, 1)}
                onDecrement={() => adjustStat(currentPlayer, key, -1)}
              />
            ))}
          </div>

          {/* Team totals */}
          <div
            className="mt-4 pt-3 space-y-1"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Team Totals</p>
            {(['rbis', 'runs'] as const).map(stat => {
              const total = playerOrder.reduce(
                (sum, p) => sum + (stats[p]?.[stat] ?? 0), 0
              )
              const label = stat === 'rbis' ? 'RBIs' : 'Runs'
              return (
                <div key={stat} className="flex items-center justify-between px-1">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: total === 0 ? '#334155' : '#e2e8f0',
                    }}
                  >
                    {total}
                  </span>
                </div>
              )
            })}
            {(() => {
              const totalRbis = playerOrder.reduce((s, p) => s + (stats[p]?.rbis ?? 0), 0)
              const totalRuns = playerOrder.reduce((s, p) => s + (stats[p]?.runs ?? 0), 0)
              const diff = Math.abs(totalRbis - totalRuns)
              if (diff === 0) return (
                <p className="text-xs text-emerald-500 pt-1">✓ RBIs = Runs</p>
              )
              return (
                <p className="text-xs text-amber-500 pt-1">⚠ Off by {diff}</p>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Finalize ── */}
      <button
        onClick={handleFinalize}
        className="w-full btn-accent py-4 rounded-2xl text-sm font-bold"
      >
        {finalized ? '✓ Re-Publish Stats' : 'Finalize & Publish to Stat Board'}
      </button>

      <p className="text-xs text-slate-600 text-center">
        Stats autosave locally. Nothing hits the stat board until you finalize.
      </p>

      {/* ── Edit Order Modal ── */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditingOrder(false)}
        >
          <div
            className="w-full max-w-sm glass-card rounded-t-3xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">Batting Order</h3>
              <button
                onClick={() => setEditingOrder(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Arrange to set batting / navigation order. Saved per game.
            </p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {draftOrder.map((player, i) => (
                <div
                  key={player}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-slate-600 text-xs w-5 text-center tabular-nums">{i + 1}</span>
                  <span className="flex-1 capitalize text-sm font-medium text-slate-200">{player}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => movePlayerInDraft(i, -1)}
                      disabled={i === 0}
                      className="w-8 h-8 rounded-lg text-slate-400 disabled:opacity-20 hover:text-slate-200 text-xs transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => movePlayerInDraft(i, 1)}
                      disabled={i === draftOrder.length - 1}
                      className="w-8 h-8 rounded-lg text-slate-400 disabled:opacity-20 hover:text-slate-200 text-xs transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveOrder}
              className="w-full btn-accent py-3 rounded-xl text-sm font-semibold"
            >
              Save Order
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
