'use client'

import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Award, Download, Filter } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
const CITIES = ['BLR', 'PUNE', 'NOIDA', 'LKO']
const CITY_NAMES: Record<string, string> = {
  BLR: 'Bengaluru',
  PUNE: 'Pune',
  NOIDA: 'Noida',
  LKO: 'Lucknow',
}

interface JudgingRow {
  team_id: string
  team_name: string
  city: string
  leader_name: string
  leader_email: string
  member_names: string
  problem_statement_id: string
  ps_track: string
  ps_name: string
  linkedin_url: string
  github_url: string
  live_url: string
  extra_notes: string
  custom_fields?: Record<string, string>
  submitted_at: string
}

export default function JudgingPage() {
  const [submissions, setSubmissions] = useState<JudgingRow[]>([])
  const [count, setCount] = useState(0)
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [selectedPSId, setSelectedPSId] = useState<string>('')
  const [error, setError] = useState('')

  const fetchSubmissions = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedCity) params.set('city', selectedCity)
      if (selectedPSId) params.set('problem_statement_id', selectedPSId)
      const url = `${API}/judging/submissions?${params.toString()}`
      const res = await axios.get(url)
      setSubmissions(res.data.submissions || [])
      setCount(res.data.count ?? 0)
      setFieldLabels(res.data.field_labels || {})
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load submissions')
      setSubmissions([])
      setCount(0)
      setFieldLabels({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubmissions()
  }, [selectedCity, selectedPSId])

  const uniquePS = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>()
    for (const s of submissions) {
      const key = s.problem_statement_id
      if (!map.has(key)) {
        map.set(key, { id: key, label: `${s.ps_track} – ${s.ps_name}` })
      }
    }
    return Array.from(map.values())
  }, [submissions])

  // Collect all unique custom field keys across all submissions
  const customFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    submissions.forEach((s) => {
      if (s.custom_fields) {
        Object.keys(s.custom_fields).forEach((k) => keys.add(k))
      }
    })
    return Array.from(keys).sort()
  }, [submissions])

  const exportCSV = () => {
    if (submissions.length === 0) {
      alert('No data to export')
      return
    }
    const customKeys = new Set<string>()
    submissions.forEach((s) => {
      if (s.custom_fields) Object.keys(s.custom_fields).forEach((k) => customKeys.add(k))
    })
    const headers = [
      'Team ID',
      'Team Name',
      'City',
      'Leader Name',
      'Leader Email',
      'Member Names',
      'Problem Statement ID',
      'PS Track',
      'PS Name',
      'LinkedIn URL',
      'GitHub URL',
      'Live URL',
      'Extra Notes',
      ...Array.from(customKeys).map((k) => fieldLabels[k] || k), // Use labels instead of keys
      'Submitted At',
    ]
    const rows = submissions.map((s) => {
      const customValues = Array.from(customKeys).map((k) => (s.custom_fields && s.custom_fields[k]) || '')
      return [
        s.team_id,
        s.team_name,
        CITY_NAMES[s.city] || s.city,
        s.leader_name,
        s.leader_email,
        s.member_names,
        s.problem_statement_id,
        s.ps_track,
        s.ps_name,
        s.linkedin_url,
        s.github_url,
        s.live_url,
        (s.extra_notes || '').replace(/"/g, '""'),
        ...customValues,
        s.submitted_at,
      ]
    })
    const escape = (v: string) => (`${v}`.includes(',') || `${v}`.includes('"') || `${v}`.includes('\n') ? `"${(`${v}`).replace(/"/g, '""')}"` : v)
    const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map((c) => escape(String(c))).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `judging-submissions-${selectedCity || 'all'}-${selectedPSId ? selectedPSId.slice(0, 8) : 'all'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Award className="text-amber-500" size={36} />
            Judging – Submitted Projects
          </h1>
          <p className="text-zinc-400">
            View and export all final project submissions with team details and selected problem statement
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Count card */}
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-amber-200 font-bold text-xl">
            Total projects in view: {loading ? '...' : count}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="text-zinc-400" size={20} />
              <span className="text-zinc-300 font-medium">City</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCity('')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedCity === '' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              {CITIES.map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedCity === city ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {CITY_NAMES[city] || city}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="text-zinc-400" size={20} />
              <span className="text-zinc-300 font-medium">Problem Statement</span>
            </div>
            <select
              value={selectedPSId}
              onChange={(e) => setSelectedPSId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            >
              <option value="">All</option>
              {uniquePS.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {ps.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export */}
        <div className="mb-6">
          <button
            onClick={exportCSV}
            disabled={loading || submissions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-600 text-white font-medium"
          >
            <Download size={18} />
            Export to CSV (with current filters)
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-zinc-400 py-12">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="text-zinc-500 py-12">No submissions match the current filters.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-300">
                  <th className="p-3">Team</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Leader</th>
                  <th className="p-3">PS</th>
                  <th className="p-3">LinkedIn</th>
                  <th className="p-3">GitHub</th>
                  <th className="p-3">Live URL</th>
                  <th className="p-3">Notes</th>
                  {customFieldKeys.map((key) => (
                    <th key={key} className="p-3">{fieldLabels[key] || key}</th>
                  ))}
                  <th className="p-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={`${s.team_id}-${s.problem_statement_id}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-3">
                      <div className="font-medium text-white">{s.team_name}</div>
                      <div className="text-zinc-500 text-xs">{s.member_names}</div>
                    </td>
                    <td className="p-3 text-zinc-300">{CITY_NAMES[s.city] || s.city}</td>
                    <td className="p-3">
                      <div className="text-white">{s.leader_name}</div>
                      <div className="text-zinc-500 text-xs">{s.leader_email}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-amber-300">{s.ps_track}</div>
                      <div className="text-zinc-400">{s.ps_name}</div>
                    </td>
                    <td className="p-3 max-w-[180px] truncate">
                      {s.linkedin_url ? (
                        <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                          Link
                        </a>
                      ) : (
                        <span className="text-zinc-500">–</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[180px] truncate">
                      {s.github_url ? (
                        <a href={s.github_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                          Link
                        </a>
                      ) : (
                        <span className="text-zinc-500">–</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[180px] truncate">
                      {s.live_url ? (
                        <a href={s.live_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                          Link
                        </a>
                      ) : (
                        <span className="text-zinc-500">–</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-zinc-400" title={s.extra_notes}>
                      {s.extra_notes || '–'}
                    </td>
                    {customFieldKeys.map((key) => (
                      <td key={key} className="p-3 max-w-[200px] truncate text-zinc-300" title={s.custom_fields?.[key] || ''}>
                        {s.custom_fields?.[key] || '–'}
                      </td>
                    ))}
                    <td className="p-3 text-zinc-500 text-xs">{s.submitted_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
