'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { getAdminToken } from '../../../src/lib/admin-auth'
import { Table, Plus, Trash2, Edit2, Search, Users, Eraser } from 'lucide-react'

interface EventTable {
    id: string
    table_name: string
    table_number: string
    city: string
    capacity: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export default function TablesPage() {
    const [tables, setTables] = useState<EventTable[]>([])
    const [filteredTables, setFilteredTables] = useState<EventTable[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedTable, setSelectedTable] = useState<EventTable | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCity, setFilterCity] = useState<string>('all')

    // Form state
    const [formData, setFormData] = useState({
        table_name: '',
        table_number: '',
        city: 'BLR',
        capacity: 50
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [allocating, setAllocating] = useState(false)
    const [clearingDesks, setClearingDesks] = useState(false)
    const [allocResult, setAllocResult] = useState<{ by_city: { city: string; teams_count: number; tables_count: number; teams_allocated: number }[] } | null>(null)

    useEffect(() => {
        fetchTables()
    }, [])

    useEffect(() => {
        filterTables()
    }, [tables, searchTerm, filterCity])

    const fetchTables = async () => {
        try {
            const token = getAdminToken()
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/tables`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setTables(response.data.tables || [])
        } catch (err) {
            console.error('Failed to fetch tables:', err)
        } finally {
            setLoading(false)
        }
    }

    const filterTables = () => {
        let filtered = tables

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(t =>
                t.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.table_number.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // City filter
        if (filterCity !== 'all') {
            filtered = filtered.filter(t => t.city === filterCity)
        }

        setFilteredTables(filtered)
    }

    const handleCreateTable = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setSubmitting(true)

        try {
            const token = getAdminToken()
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/tables`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setSuccess('Table created successfully!')
            setFormData({
                table_name: '',
                table_number: '',
                city: 'BLR',
                capacity: 50
            })
            setTimeout(() => {
                setShowCreateModal(false)
                setSuccess('')
                fetchTables()
            }, 1500)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create table')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEditTable = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTable) return

        setError('')
        setSuccess('')
        setSubmitting(true)

        try {
            const token = getAdminToken()
            await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/tables/${selectedTable.id}`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            setSuccess('Table updated successfully!')
            setTimeout(() => {
                setShowEditModal(false)
                setSuccess('')
                setSelectedTable(null)
                fetchTables()
            }, 1500)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update table')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteTable = async (id: string) => {
        if (!confirm('Are you sure you want to delete this table? All volunteers assigned to this table will be unassigned.')) return

        try {
            const token = getAdminToken()
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/tables/${id}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )
            fetchTables()
        } catch (err) {
            alert('Failed to delete table')
        }
    }

    const openEditModal = (table: EventTable) => {
        setSelectedTable(table)
        setFormData({
            table_name: table.table_name,
            table_number: table.table_number,
            city: table.city,
            capacity: table.capacity
        })
        setShowEditModal(true)
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

    const handleAllocateDesks = async () => {
        if (!confirm('Allocate registration desks to all teams by city? Teams will be distributed evenly across tables in their city (e.g. 200 teams, 4 tables → 50 per table). This will overwrite existing allocations.')) return
        setAllocating(true)
        setError('')
        setAllocResult(null)
        try {
            const token = getAdminToken()
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/registration-desks/allocate`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setAllocResult(response.data.result)
            setSuccess(response.data.message || 'Allocation complete.')
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to allocate desks')
        } finally {
            setAllocating(false)
        }
    }

    const handleClearAllDesks = async () => {
        if (!confirm('Clear all registration desk allocations? Every team will have their assigned desk removed.')) return
        setClearingDesks(true)
        setError('')
        setSuccess('')
        setAllocResult(null)
        try {
            const token = getAdminToken()
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/registration-desks/clear`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            )
            const cleared = response.data.cleared ?? 0
            setSuccess(`Cleared ${cleared} registration desk allocation(s).`)
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to clear desks')
        } finally {
            setClearingDesks(false)
        }
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
                            <Table className="text-red-500" size={32} />
                            Table Management
                        </h1>
                        <p className="text-zinc-400 mt-2">Manage event tables and counters</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={handleAllocateDesks}
                            disabled={allocating || clearingDesks}
                            className="bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
                        >
                            <Users size={20} />
                            {allocating ? 'Allocating...' : 'Allocate desks to teams'}
                        </button>
                        <button
                            onClick={handleClearAllDesks}
                            disabled={allocating || clearingDesks}
                            className="bg-zinc-600 hover:bg-zinc-500 disabled:bg-zinc-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
                        >
                            <Eraser size={20} />
                            {clearingDesks ? 'Clearing...' : 'Clear all desk allocations'}
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg"
                        >
                            <Plus size={20} />
                            Create Table
                        </button>
                    </div>
                </div>
                {success && (
                    <div className="mt-4 bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
                        {success}
                    </div>
                )}
                {allocResult && (
                    <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-zinc-300 text-sm font-medium mb-2">Allocation by city</p>
                        <ul className="space-y-1 text-sm text-zinc-400">
                            {allocResult.by_city.map((c) => (
                                <li key={c.city}>
                                    {getCityName(c.city)}: {c.teams_allocated} teams → {c.tables_count} table(s)
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={20} />
                        <input
                            type="text"
                            placeholder="Search by table name or number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                    </div>

                    {/* City Filter */}
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
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
                    <p className="text-zinc-400 text-sm">Total Tables</p>
                    <p className="text-2xl font-bold text-white mt-1">{tables.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Active</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                        {tables.filter(t => t.is_active).length}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Total Capacity</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {tables.reduce((sum, t) => sum + t.capacity, 0)}
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
                    <p className="text-zinc-400 text-sm">Cities</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">
                        {new Set(tables.map(t => t.city)).size}
                    </p>
                </div>
            </div>

            {/* Tables List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-950 border-b border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Table Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Table Number</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">City</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Capacity</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300">Created</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {filteredTables.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                                        No tables found
                                    </td>
                                </tr>
                            ) : (
                                filteredTables.map((table) => (
                                    <tr key={table.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-white font-medium">{table.table_name}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">{table.table_number}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">
                                            {getCityName(table.city)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-300">{table.capacity}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${table.is_active
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                                }`}>
                                                {table.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-400">
                                            {new Date(table.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(table)}
                                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTable(table.id)}
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

            {/* Create Table Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">Create Table</h2>

                        <form onSubmit={handleCreateTable} className="space-y-4">
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
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Table Name</label>
                                <input
                                    type="text"
                                    value={formData.table_name}
                                    onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                    placeholder="Registration Desk 1"
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Table Number</label>
                                <input
                                    type="text"
                                    value={formData.table_number}
                                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                    placeholder="T1, A1, etc."
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">City</label>
                                <select
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                >
                                    <option value="BLR">Bangalore</option>
                                    <option value="PUNE">Pune</option>
                                    <option value="NOIDA">Noida</option>
                                    <option value="LKO">Lucknow</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Capacity</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                                    min="1"
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                    placeholder="50"
                                />
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

            {/* Edit Table Modal */}
            {showEditModal && selectedTable && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">Edit Table</h2>

                        <form onSubmit={handleEditTable} className="space-y-4">
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
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Table Name</label>
                                <input
                                    type="text"
                                    value={formData.table_name}
                                    onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Table Number</label>
                                <input
                                    type="text"
                                    value={formData.table_number}
                                    onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-300 text-sm font-medium mb-2">Capacity</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                                    min="1"
                                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false)
                                        setSelectedTable(null)
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
                                    {submitting ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
