'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { getAdminToken } from '../../../src/lib/admin-auth'
import { ShieldCheck, Plus, Trash2, MapPin } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

interface VolunteerAdminRow {
  id: string
  email: string
  city: string
  is_active: boolean
  created_at: string
}

const CITIES = [
  { value: 'BLR', label: 'Bangalore' },
  { value: 'PUNE', label: 'Pune' },
  { value: 'NOIDA', label: 'Noida' },
  { value: 'LKO', label: 'Lucknow' },
]

export default function VolunteerAdminsPage() {
  const [list, setList] = useState<VolunteerAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '', city: 'BLR' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchList = async () => {
    try {
      const token = getAdminToken()
      const res = await axios.get(`${API_URL}/admin/volunteer-admins`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setList(res.data.volunteer_admins || [])
    } catch (err) {
      console.error('Failed to fetch volunteer admins:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const token = getAdminToken()
      await axios.post(`${API_URL}/admin/volunteer-admins`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSuccess('Volunteer admin created.')
      setFormData({ email: '', password: '', city: 'BLR' })
      setTimeout(() => {
        setShowCreateModal(false)
        setSuccess('')
        fetchList()
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create volunteer admin')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this volunteer admin? They will no longer be able to log in.')) return
    try {
      const token = getAdminToken()
      await axios.delete(`${API_URL}/admin/volunteer-admins/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchList()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete')
    }
  }

  const getCityLabel = (code: string) => CITIES.find(c => c.value === code)?.label || code

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="text-red-500" size={32} />
            Volunteer Admins
          </h1>
          <p className="text-zinc-400 mt-2">City-scoped admins who can view volunteers, check-ins and seat data for their city.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
        >
          <Plus size={20} />
          Create Volunteer Admin
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800 text-zinc-300 text-left text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">City</th>
              <th className="px-6 py-4 font-medium">Created</th>
              <th className="px-6 py-4 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-zinc-500 text-center">
                  No volunteer admins yet. Create one to allow city admins to log in at /volunteeradmin.
                </td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 text-white">{row.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-zinc-300">
                      <MapPin size={14} />
                      {getCityLabel(row.city)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-red-400 hover:text-red-300 p-1 rounded"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Create Volunteer Admin</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 text-green-400 rounded-lg text-sm">
                {success}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-zinc-300 text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                  required
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                  placeholder="admin@city.rift26.com"
                />
              </div>
              <div>
                <label className="block text-zinc-300 text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((d) => ({ ...d, password: e.target.value }))}
                  required
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-zinc-300 text-sm font-medium mb-1">City</label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData((d) => ({ ...d, city: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                >
                  {CITIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 text-white py-2 rounded-lg font-medium"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(''); setSuccess(''); }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
