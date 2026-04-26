'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { GAMES, getPlayersForGame, getCurrentGame } from '@/lib/constants'
import { supabase, getInactivePlayersForGame } from '@/lib/supabase'

function thirdsToIpDisplay(thirds: number): string {
  if (thirds === 0) return '0'
  const full = Math.floor(thirds / 3)
  const rem = thirds % 3
  return rem > 0 ? `${full}.${rem}` : `${full}`
}

const HITTING_STATS = [
  { key: 'hits',       label: 'Hits' },
  { key: 'rbis',       label: 'RBIs' },
  { key: 'runs',       label: 'Runs' },
  { key: 'errors',     label: 'Errors' },
  { key: 'strikeouts', label: 'Ks (throw)' },
  { key: 'ab',         label: 'AB' },
  { key: 'homeruns',   label: 'HR' },
] as const

const PITCHING_STATS = [
  { key: 'ip',           label: 'IP' },
  { key: 'runs_allowed', label: 'Runs Allowed' },
] as const

type AnyStatKey = typeof HITTING_STATS[number]['key'] | typeof PITCHING_STATS[number]['key']
type PlayerStats = Record<AnyStatKey | string, number>
type AllStats = Record<string, PlayerStats>

const lsKey = (gameNum: number, type: 'stats' | 'order' | 'pitcher' | 'finalized') =>
  `jungle_live_${type}_g${gameNum}`

const emptyPlayerStats = (): PlayerStats => ({
  hits: 0, rbis: 0, runs: 0, errors: 0, strikeouts: 0,
  ab: 0, homeruns: 0, ip: 0, runs_allowed: 0,
})

function StatRow({
  label, value, statKey, onIncrement, onDecrement,
}: {
  label: string; value: number; statKey: string
  onIncrement: () => void; onDecrement: () => void
}) {
  const display = statKey === 'ip' ? thirdsToIpDisplay(value) : String(value)
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex-1 text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrement}
          className="w-11 h-11 rounded-xl border border-white/10 text-slate-200 text-xl font-bold active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >−</button>
        <span
          className="w-10 text-center font-bold text-base tabular-nums"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: value === 0 ? '#334155' : '#e2e8f0' }}
        >{display}</span>
        <button
          onClick={onIncrement}
          className="w-11 h-11 rounded-xl border border-white/10 text-slate-200 text-xl font-bold active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >+</button>
      </div>
    </div>
  )
}

// ── Drag-reorderable list (works with mouse and touch) ────────────────────────
function DragList({
  items,
  onChange,
}: {
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const touchRef = useRef<{ index: number; startY: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commitDrop = (from: number, to: number) => {
    if (from === to) return
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  // HTML5 drag (desktop)
  const onDragStart = (i: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragIndex(i)
  }
  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverIndex(i)
  }
  const onDrop = (i: number) => () => {
    if (dragIndex !== null) commitDrop(dragIndex, i)
    setDragIndex(null)
    setDragOverIndex(null)
  }
  const onDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // Touch drag (mobile)
  const onTouchStart = (i: number) => (e: React.TouchEvent) => {
    touchRef.current = { index: i, startY: e.touches[0].clientY }
    setDragIndex(i)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current || !listRef.current) return
    e.preventDefault()
    const touchY = e.touches[0].clientY
    const rows = listRef.current.querySelectorAll('[data-row]')
    let over = items.length - 1
    for (let idx = 0; idx < rows.length; idx++) {
      const rect = rows[idx].getBoundingClientRect()
      if (touchY < rect.top + rect.height / 2) { over = idx; break }
    }
    setDragOverIndex(over)
  }
  const onTouchEnd = () => {
    if (touchRef.current !== null && dragOverIndex !== null) {
      commitDrop(touchRef.current.index, dragOverIndex)
    }
    touchRef.current = null
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div ref={listRef} className="space-y-1.5 max-h-72 overflow-y-auto" onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {items.map((player, i) => {
        const isDragging = dragIndex === i
        const isOver = dragOverIndex === i && dragIndex !== null && dragOverIndex !== dragIndex
        return (
          <div
            key={player}
            data-row
            draggable
            onDragStart={onDragStart(i)}
            onDragOver={onDragOver(i)}
            onDrop={onDrop(i)}
            onDragEnd={onDragEnd}
            onTouchStart={onTouchStart(i)}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 select-none"
            style={{
              background: isDragging ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
              border: isOver
                ? '2px solid rgba(34,197,94,0.5)'
                : '1px solid rgba(255,255,255,0.06)',
              opacity: isDragging ? 0.4 : 1,
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <span className="text-slate-600 text-sm" style={{ cursor: 'grab', userSelect: 'none' }}>⠿</span>
            <span className="text-slate-500 text-xs w-5 text-center tabular-nums">{i + 1}</span>
            <span className="flex-1 capitalize text-sm font-medium text-slate-200">{player}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveTrackerPage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState(() => getCurrentGame().number)
  const [gameId, setGameId] = useState<string | null>(null)

  // Batting order (for hitting stats navigation)
  const [battingOrder, setBattingOrder] = useState<string[]>([])
  const [battingIndex, setBattingIndex] = useState(0)

  // Pitcher rotation (independent from batting)
  const [pitcherOrder, setPitcherOrder] = useState<string[]>([])
  const [pitcherIndex, setPitcherIndex] = useState(0)

  const [stats, setStats] = useState<AllStats>({})
  const [finalized, setFinalized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [loading, setLoading] = useState(true)

  // Edit order modal
  const [editingOrder, setEditingOrder] = useState(false)
  const [editMode, setEditMode] = useState<'batting' | 'pitching'>('batting')
  const [draftBatting, setDraftBatting] = useState<string[]>([])
  const [draftPitching, setDraftPitching] = useState<string[]>([])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const savedPlayer = localStorage.getItem('jungle_player')
      setCurrentUser(savedPlayer)

      const { data: gameRow } = await supabase
        .from('jungle_games')
        .select('id, game_number')
        .eq('game_number', selectedGame)
        .single()

      if (!gameRow) { setLoading(false); return }
      setGameId(gameRow.id)

      const inactive = await getInactivePlayersForGame(gameRow.id)
      const gamePlayers = getPlayersForGame(selectedGame).filter(p => !inactive.has(p)) as string[]

      const restoreOrder = (key: string) => {
        const raw = localStorage.getItem(lsKey(selectedGame, key as any))
        if (!raw) return [...gamePlayers].sort((a, b) => a.localeCompare(b))
        const saved = JSON.parse(raw) as string[]
        const gameSet = new Set(gamePlayers)
        return [
          ...saved.filter(p => gameSet.has(p)),
          ...gamePlayers.filter(p => !saved.includes(p)).sort(),
        ]
      }

      setBattingOrder(restoreOrder('order'))
      setBattingIndex(0)
      setPitcherOrder(restoreOrder('pitcher'))
      setPitcherIndex(0)

      const rawStats = localStorage.getItem(lsKey(selectedGame, 'stats'))
      const initialStats: AllStats = {}
      gamePlayers.forEach(p => { initialStats[p] = emptyPlayerStats() })
      if (rawStats) {
        const saved = JSON.parse(rawStats) as AllStats
        gamePlayers.forEach(p => {
          if (saved[p]) Object.keys(emptyPlayerStats()).forEach(k => { initialStats[p][k] = saved[p][k] ?? 0 })
        })
      }
      setStats(initialStats)
      setFinalized(!!localStorage.getItem(lsKey(selectedGame, 'finalized')))
      setLoading(false)
    }
    load()
  }, [selectedGame])

  // ── Autosave ──────────────────────────────────────────────────────────────
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

  const adjustStat = useCallback((player: string, stat: string, delta: number) => {
    setStats(prev => {
      const updated: AllStats = {
        ...prev,
        [player]: { ...prev[player], [stat]: Math.max(0, (prev[player]?.[stat] ?? 0) + delta) },
      }
      persistStats(updated)
      return updated
    })
  }, [persistStats])

  // ── Order editing ─────────────────────────────────────────────────────────
  const openEditOrder = (mode: 'batting' | 'pitching') => {
    setEditMode(mode)
    setDraftBatting([...battingOrder])
    setDraftPitching([...pitcherOrder])
    setEditingOrder(true)
  }

  const saveOrder = () => {
    const curBatter = battingOrder[battingIndex]
    setBattingOrder(draftBatting)
    localStorage.setItem(lsKey(selectedGame, 'order'), JSON.stringify(draftBatting))
    setBattingIndex(Math.max(0, draftBatting.indexOf(curBatter)))

    const curPitcher = pitcherOrder[pitcherIndex]
    setPitcherOrder(draftPitching)
    localStorage.setItem(lsKey(selectedGame, 'pitcher'), JSON.stringify(draftPitching))
    setPitcherIndex(Math.max(0, draftPitching.indexOf(curPitcher)))

    setEditingOrder(false)
  }

  // ── Finalize ──────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!gameId) return
    setSaveStatus('saving')

    const allPlayers = [...new Set([...battingOrder, ...pitcherOrder])]
    const rows: { game_id: string; player: string; stat: string; value: number }[] = []
    for (const player of allPlayers) {
      const ps = stats[player]
      if (!ps) continue
      Object.entries(ps).forEach(([stat, value]) => {
        if (value > 0) rows.push({ game_id: gameId, player, stat, value })
      })
    }

    const { error: delErr } = await supabase.from('jungle_results').delete().eq('game_id', gameId)
    if (delErr) { alert('Failed to clear old results: ' + delErr.message); setSaveStatus('idle'); return }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('jungle_results').insert(rows)
      if (insErr) { alert('Failed to publish stats: ' + insErr.message); setSaveStatus('idle'); return }
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

  const currentBatter = battingOrder[battingIndex] ?? battingOrder[0]
  const currentPitcher = pitcherOrder[pitcherIndex] ?? pitcherOrder[0]
  const gameLabel = GAMES.find(g => g.number === selectedGame)?.label ?? `Week ${selectedGame}`

  const totalRbis = battingOrder.reduce((s, p) => s + (stats[p]?.rbis ?? 0), 0)
  const totalRuns = battingOrder.reduce((s, p) => s + (stats[p]?.runs ?? 0), 0)

  return (
    <div className="max-w-sm mx-auto space-y-4 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-200 text-sm shrink-0">← Admin</Link>
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
            onClick={() => { setSelectedGame(g.number); setBattingIndex(0); setPitcherIndex(0) }}
            className={`week-btn ${selectedGame === g.number ? 'active' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* ── Save status ── */}
      <div className="flex justify-end h-4">
        <span
          className="text-xs transition-all"
          style={{ color: saveStatus === 'saved' ? '#22c55e' : '#64748b', opacity: saveStatus === 'idle' ? 0 : 1 }}
        >
          {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
        </span>
      </div>

      {/* ── Batting card ── */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-slate-500 flex-1">
            {gameLabel} · Batting · {battingOrder.length} players
          </span>
          <button
            onClick={() => openEditOrder('batting')}
            className="text-xs text-slate-400 hover:text-slate-200 border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            Edit Order
          </button>
        </div>

        <select
          value={currentBatter}
          onChange={e => setBattingIndex(battingOrder.indexOf(e.target.value))}
          className="w-full glass-input rounded-xl px-3 py-3 text-sm capitalize font-medium"
        >
          {battingOrder.map((p, i) => (
            <option key={p} value={p} className="bg-gray-900 capitalize">{i + 1}. {p}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBattingIndex(i => (i - 1 + battingOrder.length) % battingOrder.length)}
            className="btn-secondary py-3 rounded-xl text-sm font-medium"
          >← Prev</button>
          <button
            onClick={() => setBattingIndex(i => (i + 1) % battingOrder.length)}
            className="btn-secondary py-3 rounded-xl text-sm font-medium"
          >Next →</button>
        </div>

        {currentBatter && (
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2" style={{ color: 'var(--emerald-glow)' }}>
              {currentBatter}
            </p>
            <div className="space-y-0.5">
              {HITTING_STATS.map(({ key, label }) => (
                <StatRow
                  key={key}
                  label={label}
                  value={stats[currentBatter]?.[key] ?? 0}
                  statKey={key}
                  onIncrement={() => adjustStat(currentBatter, key, 1)}
                  onDecrement={() => adjustStat(currentBatter, key, -1)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Pitching card ── */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-slate-500 flex-1">
            Pitching · {pitcherOrder.length} players
          </span>
          <button
            onClick={() => openEditOrder('pitching')}
            className="text-xs text-slate-400 hover:text-slate-200 border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            Edit Rotation
          </button>
        </div>

        <select
          value={currentPitcher}
          onChange={e => setPitcherIndex(pitcherOrder.indexOf(e.target.value))}
          className="w-full glass-input rounded-xl px-3 py-3 text-sm capitalize font-medium"
        >
          {pitcherOrder.map((p, i) => (
            <option key={p} value={p} className="bg-gray-900 capitalize">{i + 1}. {p}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPitcherIndex(i => (i - 1 + pitcherOrder.length) % pitcherOrder.length)}
            className="btn-secondary py-3 rounded-xl text-sm font-medium"
          >← Prev</button>
          <button
            onClick={() => setPitcherIndex(i => (i + 1) % pitcherOrder.length)}
            className="btn-secondary py-3 rounded-xl text-sm font-medium"
          >Next →</button>
        </div>

        {currentPitcher && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(129,140,248,0.9)' }}>
              {currentPitcher}
            </p>
            <div className="space-y-0.5">
              {PITCHING_STATS.map(({ key, label }) => (
                <StatRow
                  key={key}
                  label={label}
                  value={stats[currentPitcher]?.[key] ?? 0}
                  statKey={key}
                  onIncrement={() => adjustStat(currentPitcher, key, 1)}
                  onDecrement={() => adjustStat(currentPitcher, key, -1)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Team totals ── */}
      <div className="glass-card rounded-2xl p-4 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Team Totals</p>
        {(['rbis', 'runs'] as const).map(stat => {
          const total = battingOrder.reduce((sum, p) => sum + (stats[p]?.[stat] ?? 0), 0)
          return (
            <div key={stat} className="flex items-center justify-between px-1">
              <span className="text-sm text-slate-400">{stat === 'rbis' ? 'RBIs' : 'Runs'}</span>
              <span className="font-bold tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: total === 0 ? '#334155' : '#e2e8f0' }}>
                {total}
              </span>
            </div>
          )
        })}
        {Math.abs(totalRbis - totalRuns) === 0
          ? <p className="text-xs text-emerald-500 pt-1">✓ RBIs = Runs</p>
          : <p className="text-xs text-amber-500 pt-1">⚠ Off by {Math.abs(totalRbis - totalRuns)}</p>
        }
      </div>

      {/* ── Finalize ── */}
      <button onClick={handleFinalize} className="w-full btn-accent py-4 rounded-2xl text-sm font-bold">
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
            {/* Tabs */}
            <div className="flex items-center justify-between">
              <div className="toggle-group">
                <button
                  onClick={() => setEditMode('batting')}
                  className={`toggle-btn ${editMode === 'batting' ? 'active' : ''}`}
                >Batting Order</button>
                <button
                  onClick={() => setEditMode('pitching')}
                  className={`toggle-btn ${editMode === 'pitching' ? 'active' : ''}`}
                >Pitcher Rotation</button>
              </div>
              <button onClick={() => setEditingOrder(false)} className="text-slate-400 hover:text-slate-200 text-sm ml-2">
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-500">Drag ⠿ to reorder. Changes to one don't affect the other.</p>

            {editMode === 'batting'
              ? <DragList items={draftBatting} onChange={setDraftBatting} />
              : <DragList items={draftPitching} onChange={setDraftPitching} />
            }

            <button onClick={saveOrder} className="w-full btn-accent py-3 rounded-xl text-sm font-semibold">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
