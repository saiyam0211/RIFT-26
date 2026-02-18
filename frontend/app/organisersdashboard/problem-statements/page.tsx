'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { getAdminToken } from '@/src/lib/admin-auth'
import { FileText, Plus, Trash2, Upload, Zap, Lock, Unlock } from 'lucide-react'

interface PSItem {
  id: string
  track: string
  name: string
  file_path: string
  created_at: string
}

export default function ProblemStatementsPage() {
  const [list, setList] = useState<PSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [psSubmissionOpen, setPsSubmissionOpen] = useState(false)
  const [togglingSubmission, setTogglingSubmission] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ track: '', name: '', link: '' })

  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

  const fetchList = async () => {
    try {
      const token = getAdminToken()
      const res = await axios.get(`${api}/admin/problem-statements`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setList(res.data.problem_statements || [])
      // Fetch submission status
      const statusRes = await axios.get(`${api}/admin/problem-statements/submission-status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPsSubmissionOpen(statusRes.data.submission_open === true)
    } catch (e) {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.track.trim() || !form.name.trim() || !form.link.trim()) {
      setError('Track, name and Google Drive link are required')
      return
    }
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const token = getAdminToken()
      const fd = new FormData()
      fd.append('track', form.track.trim())
      fd.append('name', form.name.trim())
      fd.append('link', form.link.trim())
      await axios.post(`${api}/admin/problem-statements`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSuccess('Problem statement added.')
      setForm({ track: '', name: '', link: '' })
      fetchList()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem statement?')) return
    try {
      const token = getAdminToken()
      await axios.delete(`${api}/admin/problem-statements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchList()
    } catch (err) {
      setError('Failed to delete')
    }
  }

  const handleReleaseEarly = async () => {
    if (!confirm('Release problem statements now? They will be visible on /problemstatement and on team dashboards.')) return
    setReleasing(true)
    setError('')
    try {
      const token = getAdminToken()
      await axios.post(`${api}/admin/problem-statements/release-early`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSuccess('Released. PS are now visible everywhere.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed')
    } finally {
      setReleasing(false)
    }
  }

  const handleToggleSubmission = async () => {
    const newState = !psSubmissionOpen
    if (!confirm(`Are you sure you want to ${newState ? 'unlock' : 'lock'} the PS submission window?`)) return
    setTogglingSubmission(true)
    setError('')
    try {
      const token = getAdminToken()
      await axios.post(`${api}/admin/problem-statements/toggle-submission`, { open: newState }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPsSubmissionOpen(newState)
      setSuccess(`PS submission window ${newState ? 'unlocked' : 'locked'}. Teams ${newState ? 'can' : 'cannot'} lock their PS selections.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed')
    } finally {
      setTogglingSubmission(false)
    }
  }

  if (loading) {
    return (
      <div className="text-white flex items-center justify-center min-h-[40vh]">Loading...</div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="text-red-500" size={32} />
            Problem Statements
          </h1>
          <p className="text-zinc-400 mt-2">Add problem statements with Google Drive (or any) PDF links. They go live at 11 AM on 19 Feb 2026 (or after &quot;Release early&quot;).</p>
        </div>
        <a
          href="/problemstatement"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-white text-sm"
        >
          View /problemstatement →
        </a>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* PS Submission Window Toggle */}
      <div className="mb-8 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm font-medium mb-1">PS Submission Window</p>
            <p className="text-zinc-400 text-xs">
              {psSubmissionOpen ? 'Unlocked: Teams can lock their PS selections' : 'Locked: Teams cannot lock PS selections'}
            </p>
          </div>
          <button
            onClick={handleToggleSubmission}
            disabled={togglingSubmission}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              psSubmissionOpen
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white'
            } disabled:bg-zinc-600`}
          >
            {psSubmissionOpen ? <Unlock size={18} /> : <Lock size={18} />}
            {togglingSubmission ? 'Updating...' : psSubmissionOpen ? 'Lock Window' : 'Unlock Window'}
          </button>
        </div>
      </div>

      {/* Add problem statement (Google Drive link) */}
      <div className="mb-10 p-6 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={20} />
          Add problem statement (link)
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Track</label>
            <input
              type="text"
              value={form.track}
              onChange={(e) => setForm({ ...form, track: e.target.value })}
              placeholder="e.g. Track 1, Fintech"
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Problem statement name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Build a payment solution"
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Google Drive link (or any PDF URL)</label>
            <input
              type="url"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 text-white font-medium"
          >
            <Plus size={18} />
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {/* List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Added ({list.length})</h2>
        {list.length === 0 ? (
          <p className="text-zinc-500">No problem statements yet. Add up to 4 (one per track) with Google Drive links.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((ps) => (
              <li
                key={ps.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800"
              >
                <div>
                  <span className="text-amber-400 text-sm font-medium">{ps.track}</span>
                  <p className="text-white font-medium">{ps.name}</p>
                </div>
                <button
                  onClick={() => handleDelete(ps.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
