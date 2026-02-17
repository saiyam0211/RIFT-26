'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { getAdminToken } from '../../../src/lib/admin-auth'
import { MapPin, Plus, Grid3X3, Users, Film, Trash2, Save, LayoutGrid, DoorOpen, Square, Merge, Box, Circle, Monitor, Eye, X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MAX_GRID_ROWS = 20
const MAX_GRID_COLS = 28
const CELL_SIZE = 32
const CELL_GAP = 2

type WallRunH = { row: number; colStart: number; colEnd: number }
type WallRunV = { col: number; rowStart: number; rowEnd: number }
type PillarRunH = { row: number; colStart: number; colEnd: number }
type PillarRunV = { col: number; rowStart: number; rowEnd: number }

function isWallCorner(cells: Record<string, CellType>, r: number, c: number): boolean {
    if (cells[`${r},${c}`] !== 'wall') return false
    const hasH = cells[`${r},${c - 1}`] === 'wall' || cells[`${r},${c + 1}`] === 'wall'
    const hasV = cells[`${r - 1},${c}`] === 'wall' || cells[`${r + 1},${c}`] === 'wall'
    return hasH && hasV
}

function getWallRuns(cells: Record<string, CellType>, rows: number, cols: number) {
    const h: WallRunH[] = []
    const v: WallRunV[] = []
    for (let r = 1; r <= rows; r++) {
        let c = 1
        while (c <= cols) {
            if (cells[`${r},${c}`] !== 'wall') { c++; continue }
            let colStart = c
            while (c <= cols && cells[`${r},${c}`] === 'wall') {
                if (isWallCorner(cells, r, c) && c > colStart) {
                    if (c - 1 >= colStart) h.push({ row: r, colStart, colEnd: c - 1 })
                    colStart = c + 1
                }
                c++
            }
            if (c - 1 >= colStart) h.push({ row: r, colStart, colEnd: c - 1 })
        }
    }
    for (let c = 1; c <= cols; c++) {
        let r = 1
        while (r <= rows) {
            if (cells[`${r},${c}`] !== 'wall') { r++; continue }
            let rowStart = r
            while (r <= rows && cells[`${r},${c}`] === 'wall') {
                if (isWallCorner(cells, r, c) && r > rowStart) {
                    if (r - 1 >= rowStart) v.push({ col: c, rowStart, rowEnd: r - 1 })
                    rowStart = r + 1
                }
                r++
            }
            if (r - 1 >= rowStart) v.push({ col: c, rowStart, rowEnd: r - 1 })
        }
    }
    return { h, v }
}

function getPillarRuns(cells: Record<string, CellType>, rows: number, cols: number) {
    const h: PillarRunH[] = []
    const v: PillarRunV[] = []
    for (let r = 1; r <= rows; r++) {
        let c = 1
        while (c <= cols) {
            if (cells[`${r},${c}`] !== 'pillar') { c++; continue }
            const colStart = c
            while (c <= cols && cells[`${r},${c}`] === 'pillar') c++
            if (c - colStart >= 1) h.push({ row: r, colStart, colEnd: c - 1 })
        }
    }
    for (let c = 1; c <= cols; c++) {
        let r = 1
        while (r <= rows) {
            if (cells[`${r},${c}`] !== 'pillar') { r++; continue }
            const rowStart = r
            while (r <= rows && cells[`${r},${c}`] === 'pillar') r++
            if (r - rowStart >= 1) v.push({ col: c, rowStart, rowEnd: r - 1 })
        }
    }
    return { h, v }
}

interface Block {
    id: string
    name: string
    city: string
    display_order: number
    is_active: boolean
}

interface Room {
    id: string
    block_id: string
    name: string
    capacity: number
    current_occupancy: number
    display_order: number
}

interface Seat {
    id: string
    room_id: string
    row_number: number
    column_number: number
    seat_label: string
    team_size_preference: number | null
    seat_group_id: string | null
    is_available: boolean
}

type CellType = 'seat' | 'space' | 'entrance' | 'wall' | 'pillar' | 'screen'
interface LayoutGroup {
    id: string
    positions: string[]
    teamSize: 2 | 3 | 4
}

export default function SeatAllocationPage() {
    const [blocks, setBlocks] = useState<Block[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [seats, setSeats] = useState<Seat[]>([])
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [gridRows, setGridRows] = useState(5)
    const [gridCols, setGridCols] = useState(6)
    const [newBlockName, setNewBlockName] = useState('')
    const [newRoomName, setNewRoomName] = useState('')
    const [newRoomCapacity, setNewRoomCapacity] = useState(30)
    const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState<any>(null)
    // Visual grid builder: cell type per position "row,col" (1-based)
    const [layoutCells, setLayoutCells] = useState<Record<string, CellType>>({})
    const [layoutGroups, setLayoutGroups] = useState<LayoutGroup[]>([])
    const [showAddSection, setShowAddSection] = useState(false)
    const [sectionRows, setSectionRows] = useState(5)
    const [sectionCols, setSectionCols] = useState(6)
    const [sectionStartRow, setSectionStartRow] = useState(1)
    const [sectionStartCol, setSectionStartCol] = useState(1)
    const [drawTool, setDrawTool] = useState<CellType | 'erase'>('seat')
    const [mergeSelectMode, setMergeSelectMode] = useState(false)
    const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(new Set())
    const [canvasRows, setCanvasRows] = useState(14)
    const [canvasCols, setCanvasCols] = useState(22)
    const isDraggingRef = useRef(false)
    const [viewMode, setViewMode] = useState<'build' | 'view'>('build')
    const [roomViewData, setRoomViewData] = useState<{ room_name?: string; layout: { rows: number; cols: number; cells: Record<string, string>; groups: any[] } | null; allocations: { team_id: string; team_name: string; seat_label: string; positions: { row: number; col: number }[] }[] } | null>(null)
    const [hoveredAlloc, setHoveredAlloc] = useState<{ team_id: string; team_name: string; seat_label: string; positions: { row: number; col: number }[] } | null>(null)
    const [selectedAlloc, setSelectedAlloc] = useState<{ team_id: string; team_name: string; seat_label: string; positions: { row: number; col: number }[] } | null>(null)
    const [highlightTeamIds, setHighlightTeamIds] = useState<Set<string>>(new Set())
    const [roomDashboardData, setRoomDashboardData] = useState<Record<string, {
        teams2: number;
        teams3: number;
        teams4: number;
        totalParticipants: number;
        individualSeats: number;
        capacity: number;
    }>>({})

    const token = getAdminToken()

    useEffect(() => {
        fetchBlocks()
        fetchStats()
    }, [])

    useEffect(() => {
        if (selectedBlockId) fetchRooms(selectedBlockId)
        else setRooms([])
    }, [selectedBlockId])

    useEffect(() => {
        if (selectedRoomId) fetchSeats(selectedRoomId)
        else setSeats([])
    }, [selectedRoomId])

    // When switching room, clear builder and load saved layout if any
    useEffect(() => {
        setShowAddSection(false)
        setSelectedCellKeys(new Set())
        setViewMode('build')
        setRoomViewData(null)
        setHighlightTeamIds(new Set())
        if (!selectedRoomId) {
            setLayoutCells({})
            setLayoutGroups([])
            return
        }
        const loadLayout = async () => {
            try {
                const res = await axios.get(`${API}/admin/seat-allocation/rooms/${selectedRoomId}/layout`, { headers: { Authorization: `Bearer ${token}` } })
                const layout = res.data?.layout
                if (layout?.rows && layout?.cols) {
                    setCanvasRows(layout.rows)
                    setCanvasCols(layout.cols)
                    setLayoutCells(layout.cells || {})
                    setLayoutGroups((layout.groups || []).map((g: { id: string; positions: string[]; team_size: number }) => ({ id: g.id, positions: g.positions || [], teamSize: g.team_size })))
                } else {
                    setLayoutCells({})
                    setLayoutGroups([])
                }
            } catch {
                setLayoutCells({})
                setLayoutGroups([])
            }
        }
        loadLayout()
    }, [selectedRoomId])

    const fetchBlocks = async () => {
        try {
            const res = await axios.get(`${API}/admin/seat-allocation/blocks`, { headers: { Authorization: `Bearer ${token}` } })
            setBlocks(res.data || [])
        } catch (e) {
            console.error(e)
        }
    }

    const fetchRooms = async (blockId: string) => {
        try {
            const res = await axios.get(`${API}/admin/seat-allocation/rooms?block_id=${blockId}`, { headers: { Authorization: `Bearer ${token}` } })
            setRooms(res.data || [])
        } catch (e) {
            console.error(e)
        }
    }

    const fetchSeats = async (roomId: string) => {
        try {
            const res = await axios.get(`${API}/admin/seat-allocation/rooms/${roomId}/seats`, { headers: { Authorization: `Bearer ${token}` } })
            setSeats(res.data || [])
        } catch (e) {
            console.error(e)
        }
    }

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API}/admin/seat-allocation/stats`, { headers: { Authorization: `Bearer ${token}` } })
            setStats(res.data)
        } catch (e) {
            console.error(e)
        }
    }

    const createBlock = async () => {
        if (!newBlockName.trim()) return
        setLoading(true)
        try {
            await axios.post(`${API}/admin/seat-allocation/blocks`, { name: newBlockName.trim(), city: 'bengaluru' }, { headers: { Authorization: `Bearer ${token}` } })
            setNewBlockName('')
            fetchBlocks()
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create block')
        } finally {
            setLoading(false)
        }
    }

    const createRoom = async () => {
        if (!selectedBlockId || !newRoomName.trim()) return
        setLoading(true)
        try {
            await axios.post(`${API}/admin/seat-allocation/rooms`, { block_id: selectedBlockId, name: newRoomName.trim(), capacity: newRoomCapacity }, { headers: { Authorization: `Bearer ${token}` } })
            setNewRoomName('')
            fetchRooms(selectedBlockId)
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create room')
        } finally {
            setLoading(false)
        }
    }

    const createGrid = async () => {
        if (!selectedRoomId || gridRows < 1 || gridCols < 1) return
        setLoading(true)
        try {
            await axios.post(`${API}/admin/seat-allocation/seats/grid`, { room_id: selectedRoomId, rows: gridRows, cols: gridCols }, { headers: { Authorization: `Bearer ${token}` } })
            fetchSeats(selectedRoomId)
            fetchStats()
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to create seats')
        } finally {
            setLoading(false)
        }
    }

    const loadExistingLayout = () => {
        const cells: Record<string, CellType> = {}
        const groupsByGid: Record<string, { positions: string[]; teamSize: 2 | 3 | 4 }> = {}
        seats.forEach(s => {
            const key = `${s.row_number},${s.column_number}`
            cells[key] = 'seat'
            if (s.seat_group_id && s.team_size_preference && [2, 3, 4].includes(s.team_size_preference)) {
                const gid = s.seat_group_id
                if (!groupsByGid[gid]) groupsByGid[gid] = { positions: [], teamSize: s.team_size_preference as 2 | 3 | 4 }
                groupsByGid[gid].positions.push(key)
            }
        })
        setLayoutCells(cells)
        setLayoutGroups(Object.entries(groupsByGid).map(([id, g]) => ({ id, positions: g.positions.sort(), teamSize: g.teamSize })))
    }

    const addSectionToLayout = () => {
        const next = { ...layoutCells }
        for (let r = 0; r < sectionRows; r++) {
            for (let c = 0; c < sectionCols; c++) {
                const row = sectionStartRow + r
                const col = sectionStartCol + c
                if (row >= 1 && row <= canvasRows && col >= 1 && col <= canvasCols) next[`${row},${col}`] = 'seat'
            }
        }
        setLayoutCells(next)
        setShowAddSection(false)
    }

    const applyCell = useCallback((row: number, col: number) => {
        const key = `${row},${col}`
        if (drawTool === 'erase') {
            setLayoutCells(prev => {
                const next = { ...prev }
                delete next[key]
                return next
            })
            setLayoutGroups(prev => prev.filter(g => !g.positions.includes(key)))
            setSelectedCellKeys(prev => { const s = new Set(prev); s.delete(key); return s })
        } else {
            setLayoutCells(prev => ({ ...prev, [key]: drawTool }))
        }
    }, [drawTool])

    const handleCellPointerDown = (row: number, col: number) => {
        isDraggingRef.current = true
        applyCell(row, col)
    }
    const handleCellPointerEnter = (row: number, col: number) => {
        if (isDraggingRef.current) applyCell(row, col)
    }
    const handleCellPointerUp = () => {
        isDraggingRef.current = false
    }
    useEffect(() => {
        const up = () => { isDraggingRef.current = false }
        window.addEventListener('pointerup', up)
        return () => window.removeEventListener('pointerup', up)
    }, [])

    const toggleSelection = (row: number, col: number) => {
        const key = `${row},${col}`
        if (layoutCells[key] !== 'seat') return
        setSelectedCellKeys(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const fetchRoomView = useCallback(async () => {
        if (!selectedRoomId) return
        try {
            const res = await axios.get(`${API}/admin/seat-allocation/rooms/${selectedRoomId}/room-view`, { headers: { Authorization: `Bearer ${token}` } })
            setRoomViewData({
                room_name: res.data?.room_name,
                layout: res.data?.layout ? { 
                    rows: res.data.layout.rows || canvasRows, 
                    cols: res.data.layout.cols || canvasCols, 
                    cells: res.data.layout.cells || {},
                    groups: res.data.layout.groups || []
                } : null,
                allocations: res.data?.allocations || []
            })
            setHoveredAlloc(null)
            setSelectedAlloc(null)
            setViewMode('view')
        } catch (e) {
            console.error(e)
        }
    }, [selectedRoomId, token, canvasRows, canvasCols])

    const fetchRoomDashboardData = useCallback(async () => {
        try {
            // Try to fetch from API first
            const res = await axios.get(`${API}/admin/seat-allocation/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
            setRoomDashboardData(res.data?.rooms || {})
        } catch (e) {
            console.log('Dashboard API not available, calculating from existing data')
            // Fallback: Calculate dashboard data from existing room data
            const dashboardData: Record<string, any> = {}
            
            for (const room of rooms) {
                try {
                    // Fetch room view data to get allocations and layout
                    const roomRes = await axios.get(`${API}/admin/seat-allocation/rooms/${room.id}/room-view`, { headers: { Authorization: `Bearer ${token}` } })
                    const roomData = roomRes.data
                    
                    console.log(`Room ${room.name} data:`, roomData)
                    
                    let teams2 = 0, teams3 = 0, teams4 = 0, totalParticipants = 0
                    let individualSeats = 0
                    
                    // Calculate from allocations
                    if (roomData?.allocations && roomData.allocations.length > 0) {
                        console.log(`Room ${room.name} allocations:`, roomData.allocations)
                        for (const allocation of roomData.allocations) {
                            const teamSize = allocation.positions?.length || 0
                            console.log(`Allocation team size: ${teamSize}`, allocation)
                            if (teamSize === 2) {
                                teams2++
                                totalParticipants += 2
                            } else if (teamSize === 3) {
                                teams3++
                                totalParticipants += 3
                            } else if (teamSize === 4) {
                                teams4++
                                totalParticipants += 4
                            } else if (teamSize === 1) {
                                totalParticipants += 1
                            }
                        }
                    } else {
                        console.log(`Room ${room.name} has no allocations`)
                    }
                    
                    // Calculate individual seats from layout
                    if (roomData?.layout?.cells) {
                        const seatCells = Object.keys(roomData.layout.cells).filter(key => roomData.layout.cells[key] === 'seat')
                        const allocatedPositions = new Set(roomData.allocations?.flatMap((a: any) => a.positions?.map((p: any) => `${p.row},${p.col}`)) || [])
                        const groupPositions = new Set(roomData.layout.groups?.flatMap((g: any) => g.positions || []) || [])
                        
                        console.log(`Room ${room.name} layout analysis:`, {
                            totalSeatCells: seatCells.length,
                            allocatedPositions: allocatedPositions.size,
                            groupPositions: groupPositions.size,
                            groups: roomData.layout.groups?.length || 0
                        })
                        
                        // Individual seats = seat cells that are not in groups and not allocated
                        individualSeats = seatCells.filter(key => !groupPositions.has(key) && !allocatedPositions.has(key)).length
                        
                        // If no allocations but we have merged groups, count them as available teams
                        if (roomData.layout.groups && roomData.layout.groups.length > 0 && (!roomData.allocations || roomData.allocations.length === 0)) {
                            console.log(`Room ${room.name} has ${roomData.layout.groups.length} unallocated merged groups`)
                            // For demo purposes, let's show these as potential teams
                            for (const group of roomData.layout.groups) {
                                const groupSize = group.positions?.length || 0
                                if (groupSize === 2) teams2++
                                else if (groupSize === 3) teams3++
                                else if (groupSize === 4) teams4++
                            }
                        }
                    }
                    
                    const roomStats = {
                        teams2,
                        teams3,
                        teams4,
                        totalParticipants,
                        individualSeats,
                        capacity: room.capacity || 0
                    }
                    
                    console.log(`Room ${room.name} final stats:`, roomStats)
                    dashboardData[room.id] = roomStats
                } catch (roomError) {
                    console.log(`Failed to fetch data for room ${room.id}:`, roomError)
                    dashboardData[room.id] = {
                        teams2: 0,
                        teams3: 0,
                        teams4: 0,
                        totalParticipants: 0,
                        individualSeats: 0,
                        capacity: room.capacity || 0
                    }
                }
            }
            
            setRoomDashboardData(dashboardData)
        }
    }, [token, rooms])

    useEffect(() => {
        if (rooms.length > 0) {
            fetchRoomDashboardData()
        }
    }, [fetchRoomDashboardData, rooms.length])

    const mergeSelectedIntoGroup = (teamSize: 2 | 3 | 4) => {
        const sel = Array.from(selectedCellKeys)
        if (sel.length !== teamSize) {
            alert(`Select exactly ${teamSize} seat cells to merge for a team of ${teamSize}.`)
            return
        }
        const allSeats = sel.every(k => layoutCells[k] === 'seat')
        if (!allSeats) {
            alert('All selected cells must be seats.')
            return
        }
        const inGroup = layoutGroups.some(g => sel.some(p => g.positions.includes(p)))
        if (inGroup) {
            alert('Selected cells include one already in a group. Deselect or remove from group first.')
            return
        }
        setLayoutGroups(prev => [...prev, { id: crypto.randomUUID(), positions: sel.sort(), teamSize }])
        setSelectedCellKeys(new Set())
    }

    const clearLayout = () => {
        setLayoutCells({})
        setLayoutGroups([])
        setSelectedCellKeys(new Set())
    }

    const seatPositionKeys = () => Object.entries(layoutCells).filter(([, v]) => v === 'seat').map(([k]) => k)
    const positionsInGroups = () => new Set(layoutGroups.flatMap(g => g.positions))
    const singleSeatPositions = () => {
        const inGroups = positionsInGroups()
        return seatPositionKeys().filter(k => !inGroups.has(k))
    }

    const saveLayout = async () => {
        if (!selectedRoomId) return
        
        // Count all elements in the layout (seats, walls, pillars, etc.)
        const totalElements = Object.keys(layoutCells).length + layoutGroups.length
        if (totalElements === 0) return
        
        setLoading(true)
        try {
            // Prepare the complete layout payload with all cell types and merged groups
            const layoutPayload = {
                rows: canvasRows,
                cols: canvasCols,
                cells: layoutCells, // Contains all cell types: seat, wall, pillar, space, entrance, screen
                groups: layoutGroups.map(g => ({
                    id: g.id,
                    positions: g.positions,
                    team_size: g.teamSize
                }))
            }
            
            // Prepare seats data for backward compatibility
            const seatKeys = Object.keys(layoutCells).filter(key => layoutCells[key] === 'seat')
            const singleSeatKeys = seatKeys.filter(key => !layoutGroups.some(g => g.positions.includes(key)))
            
            const seatsPayload = singleSeatKeys.map(key => {
                const [r, c] = key.split(',').map(Number)
                return { row_number: r, column_number: c }
            })
            
            const groupsPayload = layoutGroups.map(g => ({
                team_size: g.teamSize,
                positions: g.positions.map(key => {
                    const [r, c] = key.split(',').map(Number)
                    return { row_number: r, column_number: c }
                })
            }))
            
            await axios.post(`${API}/admin/seat-allocation/seats/layout`, {
                room_id: selectedRoomId,
                seats: seatsPayload,
                groups: groupsPayload,
                layout: layoutPayload
            }, { headers: { Authorization: `Bearer ${token}` } })
            
            // Don't clear the layout - keep it for continued editing
            setSelectedCellKeys(new Set())
            fetchSeats(selectedRoomId)
            fetchStats()
            fetchRoomDashboardData()
            
            // Show success message
            alert('Layout saved successfully! All seats, merged groups, walls, pillars, spaces, entrances, and screens have been saved.')
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to save layout')
        } finally {
            setLoading(false)
        }
    }

    const totalSeatCount = singleSeatPositions().length + layoutGroups.reduce((acc, g) => acc + g.positions.length, 0)

    const markSeatsForTeamSize = async (teamSize: 2 | 3 | 4) => {
        if (selectedSeatIds.size === 0) return
        setLoading(true)
        try {
            await axios.put(`${API}/admin/seat-allocation/seats/mark-team-size`, { seat_ids: Array.from(selectedSeatIds), team_size: teamSize }, { headers: { Authorization: `Bearer ${token}` } })
            setSelectedSeatIds(new Set())
            if (selectedRoomId) fetchSeats(selectedRoomId)
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to update seats')
        } finally {
            setLoading(false)
        }
    }

    const toggleSeat = (id: string) => {
        setSelectedSeatIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const seatsByRow = seats.reduce((acc, s) => {
        const r = s.row_number
        if (!acc[r]) acc[r] = []
        acc[r].push(s)
        return acc
    }, {} as Record<number, Seat[]>)

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <MapPin className="text-red-500" />
                    Seat Allocation (Bengaluru)
                </h1>
                <p className="text-zinc-400 mt-1">Blocks, rooms and seating plan. Allocation is shared across all Bengaluru tables.</p>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm">Total seats</p>
                        <p className="text-2xl font-bold text-white">{stats.total_seats ?? 0}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm">Available</p>
                        <p className="text-2xl font-bold text-green-400">{stats.available_seats ?? 0}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm">Allocated</p>
                        <p className="text-2xl font-bold text-amber-400">{stats.allocated_seats ?? 0}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm">Participants allocated</p>
                        <p className="text-2xl font-bold text-white">{stats.total_participants_allocated ?? 0}</p>
                    </div>
                </div>
            )}

            {/* Comprehensive Room Dashboard */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <LayoutGrid className="text-blue-500" />
                        Room Dashboard - Team Allocation Overview
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchRoomDashboardData}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-2 transition"
                            title="Refresh dashboard data"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>
                
                {rooms.length > 0 ? (
                    <div className="space-y-4">
                        {/* Dashboard Header */}
                        <div className="grid grid-cols-7 gap-4 text-sm font-medium text-zinc-400 border-b border-zinc-700 pb-2">
                            <div>Room</div>
                            <div className="text-center">2-Member Teams</div>
                            <div className="text-center">3-Member Teams</div>
                            <div className="text-center">4-Member Teams</div>
                            <div className="text-center">Total Participants</div>
                            <div className="text-center">Individual Seats</div>
                            <div className="text-center">Capacity</div>
                        </div>
                        
                        {/* Room Data */}
                        {rooms.map(room => {
                            const roomStats = roomDashboardData[room.id] || {
                                teams2: 0,
                                teams3: 0, 
                                teams4: 0,
                                totalParticipants: 0,
                                individualSeats: 0,
                                capacity: room.capacity || 0
                            }
                            
                            return (
                                <div key={room.id} className={`grid grid-cols-7 gap-4 p-4 rounded-lg border transition-colors ${selectedRoomId === room.id ? 'bg-red-600/10 border-red-500/50' : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'}`}>
                                    <div className="font-medium text-white">
                                        {room.name}
                                        {selectedRoomId === room.id && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-red-600 text-white rounded">Selected</span>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-blue-400">{roomStats.teams2}</div>
                                        <div className="text-xs text-zinc-500">{roomStats.teams2 * 2} participants</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-green-400">{roomStats.teams3}</div>
                                        <div className="text-xs text-zinc-500">{roomStats.teams3 * 3} participants</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-purple-400">{roomStats.teams4}</div>
                                        <div className="text-xs text-zinc-500">{roomStats.teams4 * 4} participants</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-amber-400">{roomStats.totalParticipants}</div>
                                        <div className="text-xs text-zinc-500">total</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-zinc-300">{roomStats.individualSeats}</div>
                                        <div className="text-xs text-zinc-500">available</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">{roomStats.capacity}</div>
                                        <div className="text-xs text-zinc-500">
                                            {roomStats.capacity > 0 ? `${Math.round((roomStats.totalParticipants / roomStats.capacity) * 100)}% full` : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        
                        {/* Summary Row */}
                        <div className="grid grid-cols-7 gap-4 p-4 bg-zinc-800 rounded-lg border border-zinc-600 mt-4">
                            <div className="font-bold text-white">TOTAL</div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-blue-400">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.teams2, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">teams</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-green-400">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.teams3, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">teams</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-purple-400">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.teams4, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">teams</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-amber-400">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.totalParticipants, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">participants</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-zinc-300">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.individualSeats, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">available</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-white">
                                    {Object.values(roomDashboardData).reduce((sum, data) => sum + data.capacity, 0)}
                                </div>
                                <div className="text-xs text-zinc-400">total capacity</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-zinc-500">
                        <LayoutGrid size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No rooms created yet. Create a block and add rooms to see the dashboard.</p>
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Blocks */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Blocks</h2>
                    <div className="flex gap-2 mb-4">
                        <input
                            value={newBlockName}
                            onChange={e => setNewBlockName(e.target.value)}
                            placeholder="Block name (e.g. Block A)"
                            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                        />
                        <button onClick={createBlock} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                            <Plus size={18} /> Add
                        </button>
                    </div>
                    <div className="space-y-2">
                        {blocks.map(b => (
                            <button
                                key={b.id}
                                onClick={() => { setSelectedBlockId(b.id); setSelectedRoomId(null) }}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition ${selectedBlockId === b.id ? 'bg-red-600/20 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'}`}
                            >
                                {b.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rooms */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Rooms {selectedBlockId && `(Block)`}</h2>
                    {selectedBlockId ? (
                        <>
                            <div className="flex gap-2 mb-4">
                                <input
                                    value={newRoomName}
                                    onChange={e => setNewRoomName(e.target.value)}
                                    placeholder="Room name"
                                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    value={newRoomCapacity}
                                    onChange={e => setNewRoomCapacity(parseInt(e.target.value) || 30)}
                                    className="w-24 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                                />
                                <button onClick={createRoom} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                                    <Plus size={18} /> Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {rooms.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => setSelectedRoomId(r.id)}
                                        className={`w-full text-left px-4 py-3 rounded-lg border transition flex justify-between ${selectedRoomId === r.id ? 'bg-red-600/20 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'}`}
                                    >
                                        <span>{r.name}</span>
                                        <span className="text-zinc-500 text-sm">cap. {r.capacity}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-zinc-500">Select a block first</p>
                    )}
                </div>
            </div>

            {/* Visual seat grid builder (movie-theater style) */}
            {selectedRoomId && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                        <Film className="text-amber-400" size={22} />
                        Create seat layout
                    </h2>
                    <p className="text-zinc-400 text-sm mb-4">Set grid size, draw seats/spaces/entrances, add sections, or merge seats for teams of 2, 3, or 4. Teams are allocated only to matching seat types.</p>

                    {/* Grid size */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <span className="text-zinc-400 text-sm">Grid size:</span>
                        <div className="flex items-center gap-2">
                            <input type="number" min={4} max={MAX_GRID_ROWS} value={canvasRows} onChange={e => setCanvasRows(Math.min(MAX_GRID_ROWS, Math.max(4, parseInt(e.target.value) || 4)))} className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-sm" />
                            <span className="text-zinc-500">rows</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" min={4} max={MAX_GRID_COLS} value={canvasCols} onChange={e => setCanvasCols(Math.min(MAX_GRID_COLS, Math.max(4, parseInt(e.target.value) || 4)))} className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-sm" />
                            <span className="text-zinc-500">columns</span>
                        </div>
                    </div>

                    {/* Build vs View */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <button type="button" onClick={() => setViewMode('build')} className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'build' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                            Build layout
                        </button>
                        <button type="button" onClick={fetchRoomView} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${viewMode === 'view' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}>
                            <Eye size={18} /> View room (with teams)
                        </button>
                    </div>

                    {viewMode === 'build' && (
                        <>
                            {/* Draw tool + actions */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className="text-zinc-400 text-sm">Draw (click or drag):</span>
                                {(['seat', 'space', 'entrance', 'wall', 'pillar', 'screen', 'erase'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { setDrawTool(t); setMergeSelectMode(false) }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${drawTool === t
                                                ? t === 'seat' ? 'bg-amber-600 text-black' : t === 'space' ? 'bg-zinc-600 text-white' : t === 'entrance' ? 'bg-emerald-700 text-white' : t === 'wall' ? 'bg-stone-600 text-white' : t === 'pillar' ? 'bg-black text-white' : t === 'screen' ? 'bg-slate-600 text-white' : 'bg-red-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {t === 'seat' && <Square size={14} />}
                                        {t === 'space' && <span className="w-3 h-3 rounded bg-zinc-600" />}
                                        {t === 'entrance' && <DoorOpen size={14} />}
                                        {t === 'wall' && <Box size={14} />}
                                        {t === 'pillar' && <Circle size={14} />}
                                        {t === 'screen' && <Monitor size={14} />}
                                        {t === 'erase' && <Trash2 size={14} />}
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => { setMergeSelectMode(!mergeSelectMode); if (mergeSelectMode) setSelectedCellKeys(new Set()) }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${mergeSelectMode ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                >
                                    <Merge size={14} /> Select to merge
                                </button>
                                <button type="button" onClick={() => setShowAddSection(!showAddSection)} className="px-4 py-2 rounded-lg flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-black font-medium transition">
                                    <LayoutGrid size={18} /> Add section
                                </button>
                                {seats.length > 0 && (
                                    <button type="button" onClick={loadExistingLayout} className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition">
                                        Load current layout
                                    </button>
                                )}
                                <button type="button" onClick={clearLayout} disabled={totalSeatCount === 0} className="px-4 py-2 rounded-lg flex items-center gap-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50 transition">
                                    <Trash2 size={16} /> Clear all
                                </button>
                                <button type="button" onClick={() => { 
                                    if (selectedRoomId) {
                                        const loadLayout = async () => {
                                            try {
                                                const token = getAdminToken()
                                                const res = await axios.get(`${API}/admin/seat-allocation/rooms/${selectedRoomId}/layout`, { headers: { Authorization: `Bearer ${token}` } })
                                                const layout = res.data?.layout
                                                if (layout?.rows && layout?.cols) {
                                                    setCanvasRows(layout.rows)
                                                    setCanvasCols(layout.cols)
                                                    setLayoutCells(layout.cells || {})
                                                    setLayoutGroups((layout.groups || []).map((g: { id: string; positions: string[]; team_size: number }) => ({ id: g.id, positions: g.positions || [], teamSize: g.team_size })))
                                                    alert('Layout loaded successfully!')
                                                } else {
                                                    alert('No saved layout found for this room.')
                                                }
                                            } catch {
                                                alert('Failed to load layout.')
                                            }
                                        }
                                        loadLayout()
                                    }
                                }} disabled={!selectedRoomId || loading} className="px-4 py-2 rounded-lg flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition">
                                    <LayoutGrid size={18} /> Load current layout
                                </button>
                                <button type="button" onClick={saveLayout} disabled={Object.keys(layoutCells).length === 0 && layoutGroups.length === 0 || loading} className="px-4 py-2 rounded-lg flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 transition">
                                    <Save size={18} /> Save layout ({Object.keys(layoutCells).length + layoutGroups.length} elements)
                                </button>
                            </div>

                            {/* Merge selected */}
                            {mergeSelectMode && selectedCellKeys.size > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-zinc-800/80 rounded-lg">
                                    <span className="text-zinc-300 text-sm">{selectedCellKeys.size} selected — merge for:</span>
                                    {([2, 3, 4] as const).map(n => (
                                        <button key={n} type="button" onClick={() => mergeSelectedIntoGroup(n)} disabled={selectedCellKeys.size !== n} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium">
                                            Team of {n}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {showAddSection && (
                                <div className="mb-6 p-4 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-wrap items-end gap-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs mb-1">Rows</label>
                                        <input type="number" min={1} max={canvasRows} value={sectionRows} onChange={e => setSectionRows(Math.min(canvasRows, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-xs mb-1">Columns</label>
                                        <input type="number" min={1} max={canvasCols} value={sectionCols} onChange={e => setSectionCols(Math.min(canvasCols, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-xs mb-1">Start row</label>
                                        <input type="number" min={1} max={canvasRows} value={sectionStartRow} onChange={e => setSectionStartRow(Math.min(canvasRows, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-xs mb-1">Start column</label>
                                        <input type="number" min={1} max={canvasCols} value={sectionStartCol} onChange={e => setSectionStartCol(Math.min(canvasCols, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1.5 bg-zinc-950 border border-zinc-600 rounded text-white" />
                                    </div>
                                    <button type="button" onClick={addSectionToLayout} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black rounded font-medium">Add section</button>
                                    <button type="button" onClick={() => setShowAddSection(false)} className="px-3 py-1.5 text-zinc-400 hover:text-white">Cancel</button>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <div className="inline-block min-w-0 p-6 pt-4 bg-zinc-950 rounded-xl border border-zinc-800 relative">
                                    <div className="text-center mb-6">
                                        <div className="inline-block px-12 py-2 rounded-t-lg bg-gradient-to-b from-zinc-600 to-zinc-700 border border-zinc-600 shadow-inner">
                                            <span className="text-zinc-300 text-sm font-medium tracking-widest">SCREEN</span>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        {(() => {
                                            return (
                                                <>
                                                    {/* CSS Grid container for proper merged cell rendering */}
                                                    <div 
                                                        className="grid gap-0.5"
                                                        style={{
                                                            gridTemplateRows: `repeat(${canvasRows}, 32px)`,
                                                            gridTemplateColumns: `24px repeat(${canvasCols}, 32px)`,
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        {/* Row labels */}
                                                        {Array.from({ length: canvasRows }, (_, i) => i + 1).map(r => (
                                                            <span 
                                                                key={`label-${r}`} 
                                                                className="text-right text-zinc-500 text-xs font-medium select-none"
                                                                style={{ gridRow: r, gridColumn: 1 }}
                                                            >
                                                                {ROW_LABELS[r - 1] ?? r}
                                                            </span>
                                                        ))}
                                                        
                                                        {/* Individual cells (non-merged seats and all other cell types) */}
                                                        {Array.from({ length: canvasRows }, (_, i) => i + 1).map(r => 
                                                            Array.from({ length: canvasCols }, (_, j) => j + 1).map(col => {
                                                                const key = `${r},${col}`
                                                                const cellType = layoutCells[key]
                                                                const inGroup = layoutGroups.some(g => g.positions.includes(key))
                                                                const selected = selectedCellKeys.has(key)
                                                                const handlePointerDown = () => mergeSelectMode ? toggleSelection(r, col) : handleCellPointerDown(r, col)
                                                                const handlePointerEnter = () => !mergeSelectMode && handleCellPointerEnter(r, col)
                                                                
                                                                // Skip rendering individual cells for merged seats - they'll be rendered as groups
                                                                if (cellType === 'seat' && inGroup) return null
                                                                
                                                                return (
                                                                    <button
                                                                        key={key}
                                                                        type="button"
                                                                        onPointerDown={handlePointerDown}
                                                                        onPointerEnter={handlePointerEnter}
                                                                        onPointerUp={handleCellPointerUp}
                                                                        className={`w-8 h-8 rounded-md flex items-center justify-center text-center text-xs font-medium transition select-none border outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${selected
                                                                                ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-950 bg-blue-500/80 text-white'
                                                                                : cellType === 'wall'
                                                                                    ? 'bg-white border-none text-white'
                                                                                    : cellType === 'seat'
                                                                                        ? 'bg-amber-500/90 hover:bg-amber-400 text-black border-amber-500/50'
                                                                                        : cellType === 'space'
                                                                                            ? 'bg-zinc-700 border-zinc-600 text-zinc-500'
                                                                                            : cellType === 'entrance'
                                                                                                ? 'bg-emerald-700/80 border-emerald-500 text-white'
                                                                                                : cellType === 'screen'
                                                                                                    ? 'bg-slate-600 border-slate-500 text-white'
                                                                                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-500 border border-zinc-700'
                                                                            }`}
                                                                        style={{ gridRow: r, gridColumn: col + 1 }}
                                                                        title={cellType === 'seat' ? `Seat ${ROW_LABELS[r - 1] ?? ''}${col}` : cellType || 'Empty'}
                                                                    >
                                                                        <span className="inline-flex items-center justify-center w-full h-full leading-none">
                                                                            {cellType === 'wall' ? <img
                                                                                src="/wall.png"
                                                                                alt="Wall"
                                                                                className="w-5 h-5 mx-auto"
                                                                                style={{ objectFit: 'contain', pointerEvents: 'none' }}
                                                                            />
                                                                                : cellType === 'seat' ? (
                                                                                    <img
                                                                                        src="/seat.png"
                                                                                        alt="Seat"
                                                                                        className="w-5 h-5 mx-auto"
                                                                                        style={{ objectFit: 'contain', pointerEvents: 'none' }}
                                                                                    />
                                                                                )
                                                                                    : cellType === 'entrance' ? <img
                                                                                    src="/entrance.png"
                                                                                    alt="Entrance"
                                                                                    className="w-5 h-5 mx-auto"
                                                                                    style={{ objectFit: 'contain', pointerEvents: 'none' }}
                                                                                />
                                                                                        : cellType === 'screen' ? '▭'
                                                                                            : cellType === 'space' ? ''
                                                                                                : '+'}
                                                                        </span>
                                                                    </button>
                                                                )
                                                            })
                                                        )}
                                                        
                                                        {/* Merged seat groups as single elements */}
                                                        {layoutGroups.map((group, groupIndex) => {
                                                            const positions = group.positions.map(pos => {
                                                                const [r, c] = pos.split(',').map(Number)
                                                                return { row: r, col: c }
                                                            })
                                                            if (positions.length === 0) return null
                                                            
                                                            const minRow = Math.min(...positions.map(p => p.row))
                                                            const maxRow = Math.max(...positions.map(p => p.row))
                                                            const minCol = Math.min(...positions.map(p => p.col))
                                                            const maxCol = Math.max(...positions.map(p => p.col))
                                                            
                                                            // Check if any cell in this group is selected
                                                            const isSelected = positions.some(p => selectedCellKeys.has(`${p.row},${p.col}`))
                                                            
                                                            const handleGroupPointerDown = () => {
                                                                if (mergeSelectMode) {
                                                                    // Toggle all cells in the group
                                                                    positions.forEach(p => toggleSelection(p.row, p.col))
                                                                } else {
                                                                    // Handle as single cell click (use first position)
                                                                    handleCellPointerDown(minRow, minCol)
                                                                }
                                                            }
                                                            
                                                            const handleGroupPointerEnter = () => {
                                                                if (!mergeSelectMode) {
                                                                    handleCellPointerEnter(minRow, minCol)
                                                                }
                                                            }
                                                            
                                                            return (
                                                                <button
                                                                    key={`merged-group-${groupIndex}`}
                                                                    type="button"
                                                                    onPointerDown={handleGroupPointerDown}
                                                                    onPointerEnter={handleGroupPointerEnter}
                                                                    onPointerUp={handleCellPointerUp}
                                                                    className={`rounded-lg flex items-center justify-center text-center font-bold transition select-none border-2 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset ${isSelected
                                                                            ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-950 bg-blue-500/80 text-white border-blue-400'
                                                                            : 'bg-amber-600/95 border-amber-400 text-black hover:bg-amber-500'
                                                                        }`}
                                                                    style={{
                                                                        gridRow: `${minRow} / ${maxRow + 1}`,
                                                                        gridColumn: `${minCol + 1} / ${maxCol + 2}`,
                                                                    }}
                                                                    title={`Merged seats (${positions.length} seats)`}
                                                                >
                                                                    <span className="text-sm font-bold">
                                                                        {positions.length} SEAT{positions.length > 1 ? 'S' : ''}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </>
                                            )
                                        })()}
                                    </div>
                                    <div className="flex justify-center gap-1 mt-2 pl-8">
                                        {Array.from({ length: canvasCols }, (_, i) => i + 1).map(col => (
                                            <span key={col} className="w-8 text-center text-zinc-500 text-xs">{col}</span>
                                        ))}
                                    </div>
                                    <p className="text-zinc-500 text-xs mt-3 text-center">Walls & pillars merge into single lines/blocks. Draw: Seat, Space, Entrance, Wall, Pillar, Screen. Click or drag.</p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Room view: merged teams with names */}
                    {viewMode === 'view' && roomViewData && (
                        <div className="mt-8 p-6 bg-zinc-950 rounded-xl border border-zinc-700">
                            <h3 className="text-lg font-semibold text-white mb-2">Room view — allocated teams</h3>
                            <p className="text-zinc-400 text-sm mb-4">Merged cells show team name. Hover or click a cell to see full team details. Select teams below to highlight.</p>
                            {/* Hover tooltip */}
                            {hoveredAlloc && (
                                <div className="mb-3 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg text-left">
                                    <p className="text-amber-200 font-semibold text-sm">Team: {hoveredAlloc.team_name}</p>
                                    <p className="text-zinc-300 text-xs mt-1">Seat: {hoveredAlloc.seat_label}</p>
                                    {roomViewData?.room_name && <p className="text-zinc-400 text-xs">Room: {roomViewData.room_name}</p>}
                                </div>
                            )}
                            {/* Click-selected details card */}
                            {selectedAlloc && (
                                <div className="mb-3 p-4 bg-zinc-800 border border-amber-500/50 rounded-xl text-left flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-white font-bold">Team: {selectedAlloc.team_name}</p>
                                        <p className="text-zinc-300 text-sm mt-1">Seat: {selectedAlloc.seat_label}</p>
                                        {roomViewData?.room_name && <p className="text-zinc-400 text-sm mt-0.5">Room: {roomViewData.room_name}</p>}
                                        <p className="text-zinc-500 text-xs mt-2">Team size: {selectedAlloc.positions?.length || 1} seat(s)</p>
                                    </div>
                                    <button type="button" onClick={() => setSelectedAlloc(null)} className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300" aria-label="Close">
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                            {roomViewData.allocations.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <span className="text-zinc-400 text-sm">Highlight:</span>
                                    {roomViewData.allocations.map(a => (
                                        <button
                                            key={a.team_id}
                                            type="button"
                                            onClick={() => setHighlightTeamIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(a.team_id)) next.delete(a.team_id)
                                                else next.add(a.team_id)
                                                return next
                                            })}
                                            className={`px-3 py-1.5 rounded-lg text-sm truncate max-w-[140px] ${highlightTeamIds.has(a.team_id) ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                                            title={a.team_name}
                                        >
                                            {a.team_name || a.team_id.slice(0, 8)}
                                        </button>
                                    ))}
                                    {highlightTeamIds.size > 0 && (
                                        <button type="button" onClick={() => setHighlightTeamIds(new Set())} className="px-2 py-1 text-zinc-500 hover:text-white text-sm flex items-center gap-1">
                                            <X size={14} /> Clear
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="inline-block p-4 bg-zinc-900 rounded-lg">
                                <div 
                                    className="grid gap-0.5"
                                    style={{
                                        gridTemplateRows: `repeat(${roomViewData.layout?.rows || canvasRows}, 32px)`,
                                        gridTemplateColumns: `repeat(${roomViewData.layout?.cols || canvasCols}, 32px)`,
                                        alignItems: 'center'
                                    }}
                                >
                                    {(() => {
                                        const rows = roomViewData.layout?.rows || canvasRows
                                        const cols = roomViewData.layout?.cols || canvasCols
                                        const cells = roomViewData.layout?.cells || {}
                                        const groups = roomViewData.layout?.groups || []
                                        const allocSet = new Set(roomViewData.allocations.flatMap(a => a.positions.map(p => `${p.row},${p.col}`)))
                                        
                                        return (
                                            <>
                                                {/* Individual cells (non-merged seats and all other cell types) */}
                                                {Array.from({ length: rows }, (_, i) => i + 1).map(r => 
                                                    Array.from({ length: cols }, (_, j) => j + 1).map(c => {
                                                        const key = `${r},${c}`
                                                        const cellType = cells[key]
                                                        const isAlloc = allocSet.has(key)
                                                        const inGroup = groups.some((g: any) => g.positions?.includes(key))
                                                        
                                                        // Skip rendering individual cells for merged seats and allocated seats
                                                        if (cellType === 'seat' && (inGroup || isAlloc)) return null
                                                        
                                                        const style = cellType === 'wall'
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
                                                                className={`w-8 h-8 rounded ${style}`} 
                                                                style={{ gridRow: r, gridColumn: c }} 
                                                            />
                                                        )
                                                    })
                                                )}
                                                
                                                {/* Unallocated merged seat groups */}
                                                {groups.map((group: any, groupIndex: number) => {
                                                    const positions = group.positions || []
                                                    if (positions.length === 0) return null
                                                    
                                                    // Check if this group is allocated
                                                    const isGroupAllocated = positions.some((pos: string) => allocSet.has(pos))
                                                    if (isGroupAllocated) return null // Will be rendered as allocated team
                                                    
                                                    const groupPositions = positions.map((pos: string) => {
                                                        const [r, c] = pos.split(',').map(Number)
                                                        return { row: r, col: c }
                                                    })
                                                    
                                                    const minRow = Math.min(...groupPositions.map((p: { row: number; col: number }) => p.row))
                                                    const maxRow = Math.max(...groupPositions.map((p: { row: number; col: number }) => p.row))
                                                    const minCol = Math.min(...groupPositions.map((p: { row: number; col: number }) => p.col))
                                                    const maxCol = Math.max(...groupPositions.map((p: { row: number; col: number }) => p.col))
                                                    
                                                    return (
                                                        <div
                                                            key={`unalloc-group-${groupIndex}`}
                                                            className="rounded-lg bg-amber-500/30 border-2 border-amber-500/50 flex items-center justify-center text-xs font-bold text-amber-200"
                                                            style={{
                                                                gridRow: `${minRow} / ${maxRow + 1}`,
                                                                gridColumn: `${minCol} / ${maxCol + 1}`,
                                                            }}
                                                        >
                                                            <span className="text-center">
                                                                {positions.length} SEAT{positions.length > 1 ? 'S' : ''}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                                
                                                {/* Allocated teams (merged groups) */}
                                                {roomViewData.allocations.map((a: any) => {
                                                    const positions = a.positions || []
                                                    if (positions.length === 0) return null
                                                    
                                                    const minR = Math.min(...positions.map((p: any) => p.row))
                                                    const maxR = Math.max(...positions.map((p: any) => p.row))
                                                    const minC = Math.min(...positions.map((p: any) => p.col))
                                                    const maxC = Math.max(...positions.map((p: any) => p.col))
                                                    const highlight = highlightTeamIds.size === 0 || highlightTeamIds.has(a.team_id)
                                                    const dim = highlightTeamIds.size > 0 && !highlightTeamIds.has(a.team_id)
                                                    const isSelected = selectedAlloc?.team_id === a.team_id
                                                    
                                                    return (
                                                        <div
                                                            key={`alloc-${a.team_id}`}
                                                            role="button"
                                                            tabIndex={0}
                                                            onMouseEnter={() => setHoveredAlloc(a)}
                                                            onMouseLeave={() => setHoveredAlloc(null)}
                                                            onClick={() => setSelectedAlloc(prev => prev?.team_id === a.team_id ? null : a)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAlloc(prev => prev?.team_id === a.team_id ? null : a); } }}
                                                            className={`flex items-center justify-center rounded-lg border-2 font-semibold text-xs text-center overflow-hidden cursor-pointer transition-all ${highlight ? 'bg-amber-500/95 text-black border-amber-400' : 'bg-amber-500/80 text-black border-amber-600'} ${dim ? 'opacity-30' : ''} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'hover:ring-2 hover:ring-amber-300'}`}
                                                            style={{
                                                                gridRow: `${minR} / ${maxR + 1}`,
                                                                gridColumn: `${minC} / ${maxC + 1}`,
                                                            }}
                                                            title={`${a.team_name || 'Team'} — Seat: ${a.seat_label}${roomViewData?.room_name ? ` — Room: ${roomViewData.room_name}` : ''}`}
                                                        >
                                                            <span className="truncate px-1 block w-full text-[11px] sm:text-xs font-bold leading-tight">
                                                                {(a.team_name || a.seat_label || '—').length > 10 ? (a.team_name || a.seat_label || '—').slice(0, 10) + '…' : (a.team_name || a.seat_label || '—')}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                            <p className="text-zinc-500 text-xs mt-2">Merged blocks = one team. Use highlight to focus on specific teams.</p>
                        </div>
                    )}
                </div>
            )}

        </div>
    )
}
