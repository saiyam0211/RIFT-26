'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { getAdminToken } from '../../../src/lib/admin-auth'
import { Users, Plus, Trash2, Eye, EyeOff, Search, X, Clock } from 'lucide-react'

interface Volunteer {
    id: string
    email: string
    table_id?: string
    table_name?: string
    table_number?: string
    city: string
    is_active: boolean
    created_at: string
    updated_at: string
}

interface VolunteerLog {
    type: 'check_in' | 'confirmation'
    timestamp: string
    team_id: string
    team_name: string
    details?: any
}

interface Counter {
    id: string
    table_name: string
    table_number: string
    city: string
    capacity: number
    is_active: boolean
}

export default function VolunteersPage() {
    const [volunteers, setVolunteers] = useState<Volunteer[]>([])
    const [filteredVolunteers, setFilteredVolunteers] = useState<Volunteer[]>([])
    const [counters, setCounters] = useState<Counter[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showLogsModal, setShowLogsModal] = useState(false)
    const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null)
    const [logs, setLogs] = useState<VolunteerLog[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCity, setFilterCity] = useState<string>('all')

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        table_id: '',
        city: 'BLR'
    })
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        fetchVolunteers()
        fetchCounters()
    }, [])

    useEffect(() => {
        filterVolunteers()
    }, [volunteers, searchTerm, filterCity])

    const fetchVolunteers = async () => {
        try {
            const token = getAdminToken()
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/volunteers`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setVolunteers(response.data.volunteers || [])
        } catch (err) {
            console.error('Failed to fetch volunteers:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchCounters = async () => {
        try {
            const token = getAdminToken()
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/tables`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setCounters(response.data.tables || [])
        } catch (err) {
            console.error('Failed to fetch counters:', err)
        }
    }

    const filterVolunteers = () => {
        let filtered = volunteers

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(v =>
                v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.table_name?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // City filter
        if (filterCity !== 'all') {
            filtered = filtered.filter(v => v.city === filterCity)
        }

        setFilteredVolunteers(filtered)
    }

    const handleCreateVolunteer = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSubmitting(true)

        try {
            const token = getAdminToken()
            const payload = {
                email: formData.email,
                password: formData.password,
                table_id: formData.table_id || null,
                city: formData.city
            }
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/volunteers`,
                payload,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setSuccess('Volunteer created successfully!')
            setFormData({
                email: '',
                password: '',
                table_id: '',
                city: 'BLR'
            })
            setTimeout(() => {
                setShowCreateModal(false)
                setSuccess('')
                fetchVolunteers()
            }, 1500)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create volunteer')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteVolunteer = async (id: string) => {
        if (!confirm('Are you sure you want to delete this volunteer?')) return

        try {
            const token = getAdminToken()
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/volunteers/${id}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            fetchVolunteers()
        } catch (err) {
            alert('Failed to delete volunteer')
        }
    }

    const handleViewLogs = async (volunteer: Volunteer) => {
        setSelectedVolunteer(volunteer)
        setShowLogsModal(true)
        setLogs([]) // Clear previous logs
        try {
            const token = getAdminToken()
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/volunteers/${volunteer.id}/logs`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            // Sort by timestamp desc
            const sortedLogs = (response.data.logs || []).sort((a: VolunteerLog, b: VolunteerLog) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
            setLogs(sortedLogs)
        } catch (err) {
            console.error('Failed to fetch logs:', err)
        }
    }

    const getCityName = (code: string) => {
        const cities: Record<string, string> = {
            'BLR': 'Bangalore',
            'PUNE': 'Pune',
            'NOIDA': 'Noida',
            'LKO': 'Lucknow'
        }
        return cities[code] || code
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-white">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Users className="text-red-500" size={32} />
                            Volunteer Management
                        </h1>
                        <p className="text-zinc-400 mt-2">Manage volunteer credentials and access</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
                    >
                        <Plus size={20} />
                        Create Volunteer
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Search by email or table name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                    </div>

                    {/* City Filter */}
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    >
                        <option value="all">All Cities</option>
                        <option value="BLR">Bangalore</option>
                        <option value="PUNE">Pune</option>
                        <option value="NOIDA">Noida</option>
                        <option value="LKO">Lucknow</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Total Volunteers</p>
                    <p className="text-2xl font-bold text-white mt-1">{volunteers.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Assigned to Tables</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {volunteers.filter(v => v.table_id).length}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Unassigned</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                        {volunteers.filter(v => !v.table_id).length}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Active</p>
                    <p className="text-2xl font-bold text-red-400 mt-1">
                        {volunteers.filter(v => v.is_active).length}
                    </p>
                </div>
            </div>

            {/* Volunteers Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-950 border-b border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Email</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Assigned Table</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Table Number</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">City</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Created</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {filteredVolunteers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                                        No volunteers found
                                    </td>
                                </tr>
                            ) : (
                                filteredVolunteers.map((volunteer) => (
                                    <tr key={volunteer.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-white">{volunteer.email}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">
                                            {volunteer.table_name || <span className="text-zinc-600 italic">Not assigned</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">
                                            {volunteer.table_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">
                                            {getCityName(volunteer.city)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${volunteer.is_active
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                                }`}>
                                                {volunteer.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                            {new Date(volunteer.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewLogs(volunteer)}
                                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                                    title="View Logs"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVolunteer(volunteer.id)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 hover:text-red-300"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Volunteer Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">Create Volunteer</h2>

                        <form onSubmit={handleCreateVolunteer} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
                                    {success}
                                </div>
                            )}

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                    placeholder="volunteer@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        minLength={6}
                                        className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">City</label>
                                <select
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value, table_id: '' })}
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                >
                                    <option value="BLR">Bangalore</option>
                                    <option value="PUNE">Pune</option>
                                    <option value="NOIDA">Noida</option>
                                    <option value="LKO">Lucknow</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Assign to Table (Optional)</label>
                                <select
                                    value={formData.table_id}
                                    onChange={(e) => setFormData({ ...formData, table_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                >
                                    <option value="">No table assigned</option>
                                    {counters
                                        .filter(c => c.city === formData.city && c.is_active)
                                        .map((counter) => (
                                            <option key={counter.id} value={counter.id}>
                                                {counter.table_name} ({counter.table_number})
                                            </option>
                                        ))}
                                </select>
                                <p className="text-zinc-500 text-xs mt-2">
                                    {counters.filter(c => c.city === formData.city).length === 0
                                        ? 'No tables available for this city. Create tables first.'
                                        : 'Volunteer can login as scanner or table viewer'}
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false)
                                        setError('')
                                        setSuccess('')
                                    }}
                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white py-2 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Logs Modal */}
            {showLogsModal && selectedVolunteer && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
                                <p className="text-zinc-400 text-sm mt-1">
                                    {selectedVolunteer.email} • {getCityName(selectedVolunteer.city)}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowLogsModal(false)}
                                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {logs.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="text-zinc-600" size={32} />
                                    </div>
                                    <p className="text-zinc-500">No activity logs found for this volunteer.</p>
                                </div>
                            ) : (
                                logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-xl border ${log.type === 'check_in'
                                            ? 'bg-zinc-950/50 border-zinc-800'
                                            : 'bg-green-950/20 border-green-900/50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {log.type === 'check_in' ? (
                                                    <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                                                        Scanner Check-in
                                                    </span>
                                                ) : (
                                                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30">
                                                        Table Confirmation
                                                    </span>
                                                )}
                                                <span className="text-zinc-500 text-xs">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-white text-lg">{log.team_name}</h3>
                                            {log.details?.participants_count && (
                                                <span className="text-zinc-400 text-sm flex items-center gap-1">
                                                    <Users size={14} />
                                                    {log.details.participants_count} participants
                                                </span>
                                            )}
                                        </div>

                                        {log.details?.participants && (
                                            <div className="mt-3 pt-3 border-t border-zinc-800/50">
                                                <div className="flex flex-wrap gap-2">
                                                    {log.details.participants.map((p: any, i: number) => (
                                                        <span key={i} className={`text-xs px-2 py-1 rounded border ${p.participant_role === 'leader'
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                                            }`}>
                                                            {p.participant_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}
