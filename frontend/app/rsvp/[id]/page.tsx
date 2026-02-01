'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { Team, RSVPSubmission } from '@/types'

const CITIES = [
    { value: 'BLR' as const, label: 'Bangalore' },
    { value: 'PUNE' as const, label: 'Pune' },
    { value: 'NOIDA' as const, label: 'Noida' },
    { value: 'LKO' as const, label: 'Lucknow' },
]

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export default function RSVPPage() {
    const router = useRouter()
    const params = useParams()
    const teamId = params.id as string
    const { team: authTeam, isAuthenticated } = useAuthStore()

    const [team, setTeam] = useState<Team | null>(null)
    const [city, setCity] = useState<'BLR' | 'PUNE' | 'NOIDA' | 'LKO'>('BLR')
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/')
            return
        }

        if (authTeam?.id !== teamId) {
            setError('Not authorized for this team')
            return
        }

        if (authTeam.rsvp_locked) {
            router.push(`/dashboard/${authTeam.dashboard_token}`)
            return
        }

        setTeam(authTeam)
        setMembers(
            authTeam.members?.map((m) => ({
                id: m.id,
                name: m.name || '',
                email: m.email || '',
                phone: m.phone || '',
                tshirt_size: m.tshirt_size || 'M',
            })) || []
        )
        setLoading(false)
    }, [teamId, authTeam, isAuthenticated, router])

    const handleMemberChange = (index: number, field: string, value: string) => {
        const updated = [...members]
        updated[index] = { ...updated[index], [field]: value }
        setMembers(updated)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        for (const member of members) {
            if (!member.name || !member.email || !member.phone || !member.tshirt_size) {
                setError('Please fill all member details')
                return
            }
            if (member.phone.length !== 10) {
                setError(`Invalid phone number for ${member.name}`)
                return
            }
            if (!member.email.includes('@')) {
                setError(`Invalid email for ${member.name}`)
                return
            }
        }

        setSubmitting(true)

        try {
            const payload: RSVPSubmission = {
                city,
                members: members.map((m) => ({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    phone: m.phone,
                    tshirt_size: m.tshirt_size,
                })),
            }

            await apiClient.put(`/teams/${teamId}/rsvp`, payload)

            // Refresh team data
            const response = await apiClient.get(`/teams/${teamId}`)
            if (response.data.dashboard_token) {
                router.push(`/dashboard/${response.data.dashboard_token}`)
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit RSVP')
            console.error('RSVP Error:', err)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    if (!team) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">{error || 'Team not found'}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your RSVP</h1>
                        <p className="text-gray-600">Team: {team.team_name}</p>
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                ⚠️ Once submitted, your RSVP will be locked and cannot be changed.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* City Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Select City
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {CITIES.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setCity(c.value)}
                                        className={`p-4 border-2 rounded-lg font-medium transition ${city === c.value
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 hover:border-indigo-300'
                                            }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Member Details */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Member Details</h2>
                            <div className="space-y-6">
                                {members.map((member, index) => (
                                    <div key={member.id} className="p-6 border border-gray-200 rounded-lg bg-gray-50">
                                        <h3 className="font-medium text-gray-900 mb-4">
                                            Member {index + 1} {index === 0 && '(Leader)'}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-700 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={member.name}
                                                    onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-700 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={member.email}
                                                    onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-700 mb-1">Phone</label>
                                                <input
                                                    type="tel"
                                                    value={member.phone}
                                                    onChange={(e) =>
                                                        handleMemberChange(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    maxLength={10}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-700 mb-1">T-Shirt Size</label>
                                                <select
                                                    value={member.tshirt_size}
                                                    onChange={(e) => handleMemberChange(index, 'tshirt_size', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    required
                                                >
                                                    {TSHIRT_SIZES.map((size) => (
                                                        <option key={size} value={size}>
                                                            {size}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                        >
                            {submitting ? 'Submitting...' : 'Submit RSVP & Lock'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
