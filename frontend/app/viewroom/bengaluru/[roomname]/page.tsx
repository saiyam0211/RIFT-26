'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

type LayoutShape = {
  rows: number
  cols: number
  cells: Record<string, string>
  groups: { positions?: string[] }[]
}

type Allocation = {
  team_id: string
  team_name: string
  seat_label: string
  positions: { row: number; col: number }[]
}

export default function ViewRoomPage() {
  const params = useParams()
  const roomname = typeof params.roomname === 'string' ? params.roomname : ''
  const [data, setData] = useState<{
    room_name: string
    block_name?: string
    layout: LayoutShape | null
    allocations: Allocation[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomname) {
      setLoading(false)
      setError('Room name missing')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${API}/public/viewroom/bengaluru/${encodeURIComponent(roomname)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Room not found' : 'Failed to load room')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          setData({
            room_name: json.room_name || '',
            block_name: json.block_name,
            layout: json.layout || null,
            allocations: json.allocations || [],
          })
          if (typeof document !== 'undefined') {
            document.title = `${json.room_name || 'Room'} — Bengaluru | RIFT '26`
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [roomname])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading room…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-red-400">{error || 'Room not found'}</p>
      </div>
    )
  }

  const layout = data.layout
  const rows = layout?.rows ?? 10
  const cols = layout?.cols ?? 12
  const cells = layout?.cells ?? {}
  const groups = layout?.groups ?? []
  const allocations = data.allocations
  const allocSet = new Set(allocations.flatMap((a) => a.positions.map((p) => `${p.row},${p.col}`)))

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 text-center">
        <h1 className="text-lg font-bold text-white">
          {data.block_name ? `${data.block_name} — ` : ''}{data.room_name}
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">Bengaluru · Seating layout</p>
      </header>

      {/* Full-screen scrollable layout */}
      <main className="flex-1 overflow-auto p-4 flex justify-center items-start">
        <div
          className="inline-grid gap-0.5 bg-zinc-900 rounded-xl p-4 border border-zinc-800"
          style={{
            gridTemplateRows: `repeat(${rows}, minmax(32px, 48px))`,
            gridTemplateColumns: `repeat(${cols}, minmax(32px, 48px))`,
            alignItems: 'stretch',
            justifyItems: 'stretch',
          }}
        >
          {/* Individual cells */}
          {Array.from({ length: rows }, (_, i) => i + 1).map((r) =>
            Array.from({ length: cols }, (_, j) => j + 1).map((c) => {
              const key = `${r},${c}`
              const cellType = cells[key]
              const isAlloc = allocSet.has(key)
              const inGroup = groups.some((g) => g.positions?.includes(key))
              if (cellType === 'seat' && (inGroup || isAlloc)) return null
              const style =
                cellType === 'wall'
                  ? 'bg-stone-500 border border-stone-400'
                  : cellType === 'pillar'
                    ? 'bg-black border border-zinc-800'
                    : cellType === 'seat'
                      ? 'bg-amber-500/30 border border-amber-500/50'
                      : cellType === 'screen'
                        ? 'bg-slate-600'
                        : cellType === 'entrance'
                          ? 'bg-emerald-700/50'
                          : cellType === 'space'
                            ? 'bg-zinc-800'
                            : 'bg-zinc-800/50'
              return (
                <div
                  key={`cell-${key}`}
                  className={`min-w-[28px] min-h-[28px] rounded ${style}`}
                  style={{ gridRow: r, gridColumn: c }}
                />
              )
            })
          )}

          {/* Unallocated merged groups */}
          {groups.map((group: { positions?: string[] }, groupIndex: number) => {
            const positions = group.positions ?? []
            if (positions.length === 0) return null
            const isGroupAllocated = positions.some((pos) => allocSet.has(pos))
            if (isGroupAllocated) return null
            const groupPositions = positions.map((pos) => {
              const [r, c] = pos.split(',').map(Number)
              return { row: r, col: c }
            })
            const minRow = Math.min(...groupPositions.map((p) => p.row))
            const maxRow = Math.max(...groupPositions.map((p) => p.row))
            const minCol = Math.min(...groupPositions.map((p) => p.col))
            const maxCol = Math.max(...groupPositions.map((p) => p.col))
            return (
              <div
                key={`unalloc-${groupIndex}`}
                className="rounded-lg bg-amber-500/30 border-2 border-amber-500/50 flex items-center justify-center text-xs font-bold text-amber-200"
                style={{
                  gridRow: `${minRow} / ${maxRow + 1}`,
                  gridColumn: `${minCol} / ${maxCol + 1}`,
                }}
              >
                {positions.length} SEAT{positions.length > 1 ? 'S' : ''}
              </div>
            )
          })}

          {/* Allocated teams — full team names */}
          {allocations.map((a) => {
            const positions = a.positions ?? []
            if (positions.length === 0) return null
            const minR = Math.min(...positions.map((p) => p.row))
            const maxR = Math.max(...positions.map((p) => p.row))
            const minC = Math.min(...positions.map((p) => p.col))
            const maxC = Math.max(...positions.map((p) => p.col))
            return (
              <div
                key={`alloc-${a.team_id}`}
                className="rounded-lg bg-amber-500/95 border-2 border-amber-400 text-black flex items-center justify-center p-1 text-center overflow-hidden"
                style={{
                  gridRow: `${minR} / ${maxR + 1}`,
                  gridColumn: `${minC} / ${maxC + 1}`,
                }}
              >
                <span className="text-[10px] sm:text-xs font-semibold leading-tight break-words hyphens-auto" style={{ wordBreak: 'break-word' }}>
                  {a.team_name || a.seat_label || '—'}
                </span>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
