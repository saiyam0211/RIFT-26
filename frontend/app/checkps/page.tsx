'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { FileText, Filter } from 'lucide-react'

interface PSSelection {
  id: string
  team_id: string
  team_name: string
  team_city: string | null
  problem_statement_id: string
  leader_email: string
  locked_at: string
  ps_track: string
  ps_name: string
}

export default function CheckPSPage() {
  const [selections, setSelections] = useState<PSSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [error, setError] = useState('')

  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

  const fetchSelections = async () => {
    setLoading(true)
    setError('')
    try {
      const url = selectedCity
        ? `${api}/checkps?city=${encodeURIComponent(selectedCity)}`
        : `${api}/checkps`
      const res = await axios.get(url)
      setSelections(res.data.selections || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load PS selections')
      setSelections([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSelections()
  }, [selectedCity])

  const cities = ['BLR', 'PUNE', 'NOIDA', 'LKO']
  const cityNames: Record<string, string> = {
    BLR: 'Bengaluru',
    PUNE: 'Pune',
    NOIDA: 'Noida',
    LKO: 'Lucknow',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FileText className="text-red-500" size={36} />
            Problem Statement Selections
          </h1>
          <p className="text-zinc-400">
            View which checked-in teams have selected which problem statements
          </p>
        </div>

        {/* City Filter */}
        <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="text-zinc-400" size={20} />
            <span className="text-zinc-300 font-medium">Filter by city:</span>
            <button
              onClick={() => setSelectedCity('')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCity === ''
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              All Cities
            </button>
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedCity === city
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {cityNames[city] || city}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-white text-center py-12">Loading...</div>
        ) : selections.length === 0 ? (
          <div className="text-zinc-500 text-center py-12">
            No PS selections found{selectedCity ? ` for ${cityNames[selectedCity] || selectedCity}` : ''}.
          </div>
        ) : (
          <>
            <div className="mb-4 text-zinc-400 text-sm">
              Showing <strong className="text-white">{selections.length}</strong> selection{selections.length !== 1 ? 's' : ''}
              {selectedCity && ` in ${cityNames[selectedCity] || selectedCity}`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <thead className="bg-zinc-950">
                  <tr>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">Team Name</th>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">City</th>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">Track</th>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">Problem Statement</th>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">Leader Email</th>
                    <th className="px-6 py-4 text-left text-zinc-300 font-semibold text-sm">Locked At</th>
                  </tr>
                </thead>
                <tbody>
                  {selections.map((sel) => (
                    <tr key={sel.id} className="border-t border-zinc-800 hover:bg-zinc-800/50 transition">
                      <td className="px-6 py-4 text-white font-medium">{sel.team_name}</td>
                      <td className="px-6 py-4 text-zinc-300">{cityNames[sel.team_city || ''] || sel.team_city || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium">
                          {sel.ps_track}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white">{sel.ps_name}</td>
                      <td className="px-6 py-4 text-zinc-300 text-sm">{sel.leader_email}</td>
                      <td className="px-6 py-4 text-zinc-400 text-sm">
                        {new Date(sel.locked_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
