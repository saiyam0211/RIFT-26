'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Eye,
  X,
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
  team_leader_name: string
  team_size: number
  table_name?: string | null  // event table/counter from volunteer who checked in
  volunteer_email?: string    // volunteer who checked in this team
  latest_checkin_at: string
}

interface EventTable {
  id: string
  table_name?: string
  table_number?: string
  city: string
  capacity?: number
  is_active: boolean
}

interface TeamDetails {
  team: {
    id: string
    team_name: string
    city: string
    [key: string]: unknown
  }
  checked_in_members: Array<{
    participant_name: string
    participant_role?: string
    checked_in_at: string
  }>
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
  const [tab, setTab] = useState<Tab>('checkins')
  const [user, setUser] = useState<{ email: string; city: string } | null>(null)
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([])
  const [checkIns, setCheckIns] = useState<CheckInRow[]>([])
  const [checkInTeams, setCheckInTeams] = useState<CheckedInTeamRow[]>([])
  const [checkInTeamsLoading, setCheckInTeamsLoading] = useState(false)
  const [totalCheckedInTeams, setTotalCheckedInTeams] = useState(0)
  const [tables, setTables] = useState<EventTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tablesError, setTablesError] = useState<string>('')
  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('volunteer_admin_selected_table_id') || ''
    }
    return ''
  })
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<TeamDetails | null>(null)
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false)
  const [seatStats, setSeatStats] = useState<SeatStats | null>(null)
  const [seatAvailable, setSeatAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkInFilters, setCheckInFilters] = useState({
    search: '',
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

  const fetchCheckInTeams = useCallback(async () => {
    if (!token) return
    setCheckInTeamsLoading(true)
    try {
      const params = new URLSearchParams()
      if (checkInFilters.search) params.set('search', checkInFilters.search)
      if (selectedTableId) params.set('table_id', selectedTableId)
      const res = await axios.get(
        `${API_URL}/volunteer-admin/check-in-teams?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const teams = res.data.check_in_teams || []
      setCheckInTeams(teams)
      setTotalCheckedInTeams(res.data.total || teams.length)
    } catch {
      setCheckInTeams([])
      setTotalCheckedInTeams(0)
    } finally {
      setCheckInTeamsLoading(false)
    }
  }, [token, checkInFilters.search, selectedTableId])

  const fetchTables = async () => {
    if (!token) return
    setTablesLoading(true)
    setTablesError('')
    try {
      const res = await axios.get(`${API_URL}/volunteer-admin/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTables(res.data.tables || [])
      // Validate that selectedTableId still exists in the fetched tables
      if (selectedTableId && res.data.tables) {
        const tableExists = res.data.tables.some((t: EventTable) => t.id === selectedTableId)
        if (!tableExists) {
          // Clear invalid selection
          setSelectedTableId('')
          if (typeof window !== 'undefined') {
            localStorage.removeItem('volunteer_admin_selected_table_id')
          }
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string } }; message?: string }
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to load tables'
      setTablesError(errorMsg)
      console.error('Failed to fetch tables:', errorMsg)
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }

  const fetchTeamDetails = async (teamId: string) => {
    if (!token) return
    setTeamDetailsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/volunteer-admin/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSelectedTeamDetails(res.data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      setError(err.response?.data?.error || err.message || 'Failed to load team details')
      setSelectedTeamDetails(null)
    } finally {
      setTeamDetailsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'checkins' && token) {
      fetchTables()
    }
  }, [tab, token])

  // Persist selected table to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedTableId) {
        localStorage.setItem('volunteer_admin_selected_table_id', selectedTableId)
      } else {
        localStorage.removeItem('volunteer_admin_selected_table_id')
      }
    }
  }, [selectedTableId])

  useEffect(() => {
    if (tab === 'checkins' && token) {
      fetchCheckInTeams()
      // Auto-refresh every 10 seconds only when no filters are applied
      if (!selectedTableId && !checkInFilters.search) {
        const interval = setInterval(() => {
          fetchCheckInTeams()
        }, 10000)
        return () => clearInterval(interval)
      }
    }
  }, [tab, token, fetchCheckInTeams, selectedTableId, checkInFilters.search])

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
      <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
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
              {t === 'checkins' && <><History className="inline mr-2" size={16} /> Check-ins</>}
              {t === 'volunteers' && <><Users className="inline mr-2" size={16} /> Volunteers</>}
              {/* {t === 'seats' && <><MapPin className="inline mr-2" size={16} /> Seats</>} */}
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

            {/* Table selector */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="block text-zinc-400 text-sm mb-2">Filter by Table</label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value)
                }}
                className="w-full sm:w-64 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={tab !== 'checkins' || tablesLoading}
              >
                <option value="">All Tables</option>
                {tablesLoading ? (
                  <option value="" disabled>Loading tables...</option>
                ) : tables.length === 0 ? (
                  <option value="" disabled>No tables available</option>
                ) : (
                  tables.map((table) => {
                    const displayName = table.table_name 
                      ? `${table.table_name}${table.table_number ? ` (${table.table_number})` : ''}`
                      : table.table_number || `Table ${table.id.slice(0, 8)}`
                    return (
                      <option key={table.id} value={table.id}>
                        {displayName}
                      </option>
                    )
                  })
                )}
              </select>
              {tablesError && (
                <p className="text-red-400 text-xs mt-1">{tablesError}</p>
              )}
              {!tablesLoading && !tablesError && tables.length === 0 && tab === 'checkins' && (
                <p className="text-zinc-500 text-xs mt-1">No tables available for this city</p>
              )}
            </div>

            {/* Checked-in teams: header + search + table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-md font-medium text-zinc-400 mb-1">Checked-in teams</h3>
                  <p className="text-zinc-500 text-sm">Teams that are checked in. Table updates automatically.</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-500 text-sm">Total teams checked in</p>
                  <p className="text-2xl font-bold text-white">{totalCheckedInTeams}</p>
                </div>
              </div>

              {/* Search */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-zinc-500 text-xs mb-1">Team name</label>
                    <input
                      type="text"
                      placeholder="Search team..."
                      value={checkInFilters.search}
                      onChange={(e) => setCheckInFilters((f) => ({ ...f, search: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchCheckInTeams()
                      }}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => fetchCheckInTeams()}
                      disabled={checkInTeamsLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 rounded-lg text-white text-sm font-medium flex items-center gap-2"
                    >
                      <Search size={16} />
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Table: Team name | Team leader name | Team size | Table (checked in at) | View team */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-800 text-zinc-400 text-sm">
                    <tr>
                      <th className="px-4 py-3">Team name</th>
                      <th className="px-4 py-3">Team leader</th>
                      <th className="px-4 py-3 text-right w-28">Team size</th>
                      <th className="px-4 py-3">Table (checked in at)</th>
                      <th className="px-4 py-3 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {checkInTeamsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">Loading...</td>
                      </tr>
                    ) : checkInTeams.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">
                          No checked-in teams match. Try different filters or click Search.
                        </td>
                      </tr>
                    ) : (
                      checkInTeams.map((t) => (
                        <tr key={t.team_id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3 font-medium text-white">{t.team_name || '—'}</td>
                          <td className="px-4 py-3 text-zinc-300">{t.team_leader_name || '—'}</td>
                          <td className="px-4 py-3 text-right text-zinc-300">{t.team_size}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {t.table_name || (t.volunteer_email ? (
                              <span title={`Volunteer ${t.volunteer_email} has no table assigned. Assign in Organisers → Volunteers.`}>
                                — <span className="text-zinc-500 text-xs">(not assigned)</span>
                              </span>
                            ) : '—')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => fetchTeamDetails(t.team_id)}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title="View team details"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Team Details Modal */}
            {selectedTeamDetails && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTeamDetails(null)}>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {selectedTeamDetails.team.team_name || 'Team Details'}
                    </h3>
                    <button
                      onClick={() => setSelectedTeamDetails(null)}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    {teamDetailsLoading ? (
                      <p className="text-zinc-500 text-center py-8">Loading team details...</p>
                    ) : (
                      <>
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-3">Team Information</h4>
                          <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Team Name:</span>
                              <span className="text-white font-medium">{selectedTeamDetails.team.team_name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">City:</span>
                              <span className="text-white">{selectedTeamDetails.team.city || '—'}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-3">
                            Checked-in Members ({selectedTeamDetails.checked_in_members.length})
                          </h4>
                          {selectedTeamDetails.checked_in_members.length === 0 ? (
                            <p className="text-zinc-500 text-sm">No members checked in yet.</p>
                          ) : (
                            <div className="bg-zinc-800 rounded-lg overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-zinc-700/50 text-zinc-400 text-xs">
                                  <tr>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Role</th>
                                    <th className="px-4 py-2">Checked in at</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-700/50">
                                  {selectedTeamDetails.checked_in_members.map((member, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-700/30">
                                      <td className="px-4 py-2 text-white text-sm">{member.participant_name || '—'}</td>
                                      <td className="px-4 py-2 text-zinc-300 text-sm">{member.participant_role || '—'}</td>
                                      <td className="px-4 py-2 text-zinc-400 text-xs">
                                        {new Date(member.checked_in_at).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

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
