'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  getVolunteerAdminToken,
  getVolunteerAdminUser,
  clearVolunteerAdminAuth,
} from '../../../src/lib/volunteer-admin-auth'
import {
  ShieldCheck,
  Users,
  History,
  MapPin,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

type Tab = 'volunteers' | 'checkins' | 'seats'

interface VolunteerRow {
  id: string
  email: string
  city: string
  table_name?: string
  table_number?: string
  is_active: boolean
}

interface CheckInRow {
  id: string
  team_id: string
  team_name: string
  volunteer_email: string
  participant_name?: string
  participant_role?: string
  checked_in_at: string
}

interface CheckedInTeamRow {
  team_id: string
  team_name: string
  team_size: number
  room_name?: string | null
  table_name?: string | null  // event table/counter from volunteer who checked in
  volunteer_email?: string    // volunteer who checked in this team
  latest_checkin_at: string
}

// Backend returns snake_case: block_name, room_name, capacity, current_occupancy, available_seats
interface RoomStat {
  block_name?: string
  room_name?: string
  capacity?: number
  current_occupancy?: number
  available_seats?: number
}

interface SeatStats {
  total_seats?: number
  allocated_seats?: number
  available_seats?: number
  teams_by_size?: Record<string, number>
  available_slots_by_team_size?: Record<string, number>
  room_stats?: RoomStat[]
  [key: string]: unknown
}

export default function VolunteerAdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('volunteers')
  const [user, setUser] = useState<{ email: string; city: string } | null>(null)
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([])
  const [checkIns, setCheckIns] = useState<CheckInRow[]>([])
  const [checkInTeams, setCheckInTeams] = useState<CheckedInTeamRow[]>([])
  const [checkInTeamsLoading, setCheckInTeamsLoading] = useState(false)
  const [seatStats, setSeatStats] = useState<SeatStats | null>(null)
  const [seatAvailable, setSeatAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkInFilters, setCheckInFilters] = useState({
    search: '',
    volunteer_email: '',
    from_date: '',
    to_date: '',
    room: '',
  })

  const token = typeof window !== 'undefined' ? getVolunteerAdminToken() : null

  useEffect(() => {
    setUser(getVolunteerAdminUser())
  }, [])

  const fetchData = async () => {
    if (!token) return
    setError('')
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [volRes, checkRes, seatRes] = await Promise.all([
        axios.get(`${API_URL}/volunteer-admin/volunteers`, { headers }),
        axios.get(`${API_URL}/volunteer-admin/check-ins`, { headers }),
        axios.get(`${API_URL}/volunteer-admin/seat-summary`, { headers }),
      ])
      setVolunteers(volRes.data.volunteers || [])
      setCheckIns(checkRes.data.check_ins || [])
      const seatData = seatRes.data
      setSeatAvailable(!!seatData.seat_allocation_available)
      setSeatStats(seatData.stats || null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string }
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to load data'
      setError(msg)
      setVolunteers([])
      setCheckIns([])
      setSeatStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  const fetchCheckInTeams = async () => {
    if (!token) return
    setCheckInTeamsLoading(true)
    try {
      const params = new URLSearchParams()
      if (checkInFilters.search) params.set('search', checkInFilters.search)
      if (checkInFilters.volunteer_email) params.set('volunteer_email', checkInFilters.volunteer_email)
      if (checkInFilters.from_date) params.set('from_date', checkInFilters.from_date)
      if (checkInFilters.to_date) params.set('to_date', checkInFilters.to_date)
      if (checkInFilters.room) params.set('room', checkInFilters.room)
      const res = await axios.get(
        `${API_URL}/volunteer-admin/check-in-teams?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCheckInTeams(res.data.check_in_teams || [])
    } catch {
      setCheckInTeams([])
    } finally {
      setCheckInTeamsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'checkins' && token) fetchCheckInTeams()
  }, [tab, token])

  const handleLogout = () => {
    clearVolunteerAdminAuth()
    window.location.href = '/volunteeradmin/login'
  }

  const getCityLabel = (code: string) => {
    const m: Record<string, string> = {
      BLR: 'Bangalore',
      PUNE: 'Pune',
      NOIDA: 'Noida',
      LKO: 'Lucknow',
    }
    return m[code] || code
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="text-red-500" size={28} />
            <div>
              <h1 className="text-xl font-bold">Volunteer Admin</h1>
              <p className="text-zinc-400 text-sm flex items-center gap-1">
                <MapPin size={14} />
                {user?.city ? getCityLabel(user.city) : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 border-t border-zinc-800/50">
          {(['volunteers', 'checkins', 'seats'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'volunteers' && <><Users className="inline mr-2" size={16} /> Volunteers</>}
              {t === 'checkins' && <><History className="inline mr-2" size={16} /> Check-ins</>}
              {t === 'seats' && <><MapPin className="inline mr-2" size={16} /> Seats</>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {tab === 'volunteers' && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Volunteers in your city</h2>
            {loading ? (
              <p className="text-zinc-500">Loading...</p>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800 text-zinc-400 text-sm">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {volunteers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-zinc-500 text-center">
                          No volunteers in this city yet.
                        </td>
                      </tr>
                    ) : (
                      volunteers.map((v) => (
                        <tr key={v.id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3">{v.email}</td>
                          <td className="px-4 py-3">
                            {v.table_name || v.table_number || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={v.is_active ? 'text-green-400' : 'text-zinc-500'}>
                              {v.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'checkins' && (
          <section className="space-y-8">
            <h2 className="text-lg font-semibold text-zinc-300">Check-ins</h2>

            {/* Checked-in teams: header + search/filters + table */}
            <div>
              <h3 className="text-md font-medium text-zinc-400 mb-3">Checked-in teams</h3>
              <p className="text-zinc-500 text-sm mb-4">Teams that are checked in (team name, size, room allocated). Use search and filters below.</p>

              {/* Search and filters */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Team name</label>
                    <input
                      type="text"
                      placeholder="Search team..."
                      value={checkInFilters.search}
                      onChange={(e) => setCheckInFilters((f) => ({ ...f, search: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Volunteer email</label>
                    <input
                      type="text"
                      placeholder="Filter by volunteer..."
                      value={checkInFilters.volunteer_email}
                      onChange={(e) => setCheckInFilters((f) => ({ ...f, volunteer_email: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">From date</label>
                    <input
                      type="date"
                      value={checkInFilters.from_date}
                      onChange={(e) => setCheckInFilters((f) => ({ ...f, from_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">To date</label>
                    <input
                      type="date"
                      value={checkInFilters.to_date}
                      onChange={(e) => setCheckInFilters((f) => ({ ...f, to_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-zinc-500 text-xs mb-1">Room name</label>
                      <input
                        type="text"
                        placeholder="Filter by room..."
                        value={checkInFilters.room}
                        onChange={(e) => setCheckInFilters((f) => ({ ...f, room: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchCheckInTeams()}
                      disabled={checkInTeamsLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 rounded-lg text-white text-sm font-medium flex items-center gap-2 shrink-0"
                    >
                      <Search size={16} />
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Table: Team name | Team size | Table (checked in at) | Room allocated */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800 text-zinc-400 text-sm">
                    <tr>
                      <th className="px-4 py-3">Team name</th>
                      <th className="px-4 py-3 text-right w-28">Team size</th>
                      <th className="px-4 py-3">Table (checked in at)</th>
                      <th className="px-4 py-3">Room allocated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {checkInTeamsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-zinc-500 text-center">Loading...</td>
                      </tr>
                    ) : checkInTeams.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-zinc-500 text-center">
                          No checked-in teams match. Try different filters or click Search.
                        </td>
                      </tr>
                    ) : (
                      checkInTeams.map((t) => (
                        <tr key={t.team_id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3 font-medium text-white">{t.team_name || '—'}</td>
                          <td className="px-4 py-3 text-right text-zinc-300">{t.team_size}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {t.table_name || (t.volunteer_email ? (
                              <span title={`Volunteer ${t.volunteer_email} has no table assigned. Assign in Organisers → Volunteers.`}>
                                — <span className="text-zinc-500 text-xs">(not assigned)</span>
                              </span>
                            ) : '—')}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{t.room_name || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent check-ins (detail) */}
            <div>
              <h3 className="text-md font-medium text-zinc-400 mb-3">Recent check-ins (detail)</h3>
              {loading ? (
                <p className="text-zinc-500">Loading...</p>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-800 text-zinc-400 text-sm">
                      <tr>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Volunteer</th>
                        <th className="px-4 py-3">Participant</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {checkIns.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-zinc-500 text-center">
                            No check-ins yet.
                          </td>
                        </tr>
                      ) : (
                        checkIns.map((c) => (
                          <tr key={c.id} className="hover:bg-zinc-800/50">
                            <td className="px-4 py-3 font-medium">{c.team_name || c.team_id}</td>
                            <td className="px-4 py-3 text-zinc-400 text-sm">{c.volunteer_email || '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              {c.participant_name ? `${c.participant_name} (${c.participant_role || ''})` : '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-sm">
                              {new Date(c.checked_in_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'seats' && (
          <section className="space-y-8">
            <h2 className="text-lg font-semibold text-zinc-300">Seat allocation</h2>
            {loading ? (
              <p className="text-zinc-500">Loading...</p>
            ) : !seatAvailable ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">
                Seat allocation data is only available for Bangalore. For other cities this section shows no stats.
              </div>
            ) : seatStats ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <p className="text-zinc-500 text-sm">Total seats</p>
                    <p className="text-2xl font-bold text-white">{Number(seatStats.total_seats ?? 0)}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <p className="text-zinc-500 text-sm">Allocated</p>
                    <p className="text-2xl font-bold text-green-400">{Number(seatStats.allocated_seats ?? 0)}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <p className="text-zinc-500 text-sm">Available</p>
                    <p className="text-2xl font-bold text-white">{Number(seatStats.available_seats ?? 0)}</p>
                  </div>
                </div>

                {/* Per-room breakdown (block & room stats) */}
                <div>
                  <h3 className="text-md font-medium text-zinc-400 mb-3">By block & room</h3>
                  {seatStats.room_stats && (seatStats.room_stats as RoomStat[]).length > 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-800 text-zinc-400 text-sm">
                          <tr>
                            <th className="px-4 py-3">Block</th>
                            <th className="px-4 py-3">Room</th>
                            <th className="px-4 py-3 text-right">Capacity</th>
                            <th className="px-4 py-3 text-right">Occupied</th>
                            <th className="px-4 py-3 text-right">Left</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {(seatStats.room_stats as RoomStat[]).map((r, i) => {
                            const cap = Number(r.capacity ?? 0)
                            const occ = Number(r.current_occupancy ?? 0)
                            const left = Number(r.available_seats ?? 0)
                            return (
                              <tr key={i} className="hover:bg-zinc-800/50">
                                <td className="px-4 py-3 font-medium text-white">{r.block_name ?? '—'}</td>
                                <td className="px-4 py-3 text-zinc-300">{r.room_name ?? '—'}</td>
                                <td className="px-4 py-3 text-right text-white">{cap}</td>
                                <td className="px-4 py-3 text-right text-green-400">{occ}</td>
                                <td className="px-4 py-3 text-right text-zinc-300">{left}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No block/room data. Ensure blocks and rooms exist for Bengaluru in Seat Allocation.</p>
                  )}
                </div>

                {/* Teams by participant count (2, 3, 4) */}
                <div>
                  <h3 className="text-md font-medium text-zinc-400 mb-3">Teams by size (participants)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[2, 3, 4].map((size) => {
                      const count = Number(seatStats.teams_by_size?.[String(size)] ?? 0)
                      return (
                        <div key={size} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <p className="text-zinc-500 text-sm">Teams of {size}</p>
                          <p className="text-xl font-bold text-white">{count}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* How many more teams of 2/3/4 can we accommodate */}
                <div>
                  <h3 className="text-md font-medium text-zinc-400 mb-3">Capacity: more teams we can accommodate</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[2, 3, 4].map((size) => {
                      const slots = Number(seatStats.available_slots_by_team_size?.[String(size)] ?? 0)
                      return (
                        <div key={size} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <p className="text-zinc-500 text-sm">More teams of {size}</p>
                          <p className="text-xl font-bold text-emerald-400">{slots}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">
                No seat stats available.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
