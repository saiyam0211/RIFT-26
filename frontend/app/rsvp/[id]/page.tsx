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

type Step = 'team_edit_question' | 'team_edit' | 'city_question' | 'city_select' | 'review'

export default function RSVPPage() {
    const router = useRouter()
    const params = useParams()
    const teamId = params.id as string
    const { team: authTeam, isAuthenticated } = useAuthStore()

    const [step, setStep] = useState<Step>('team_edit_question')
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
        // Sort members so leader is first (leader has the phone number ending in last 4 digits used for OTP)
        const sortedMembers = authTeam.members?.map((m) => ({
            id: m.id,
            name: m.name || '',
            email: m.email || '',
            phone: m.phone || '',
            role: m.role || 'member',
        })).sort((a, b) => {
            // Leader comes first (role=leader or the one with leader phone)
            if (a.role === 'leader') return -1
            if (b.role === 'leader') return 1
            return 0
        }) || []
        setMembers(sortedMembers
        )
        setLoading(false)
    }, [teamId, authTeam, isAuthenticated, router])

    const addMember = () => {
        if (members.length >= 4) return
        setMembers([
            ...members,
            { id: `temp-${Date.now()}`, name: '', email: '', phone: '', role: 'member' },
        ])
    }

    const removeMember = (index: number) => {
        if (members.length <= 2) return
        setMembers(members.filter((_, i) => i !== index))
    }

    const handleMemberChange = (index: number, field: string, value: string) => {
        const updated = [...members]
        updated[index] = { ...updated[index], [field]: value }
        setMembers(updated)
    }

    const handleSubmit = async () => {
        setError('')

        // Validation
        for (const member of members) {
            if (!member.name || !member.email || !member.phone) {
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
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your RSVP</h1>
                    <p className="text-gray-600">Team: {team.team_name}</p>
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            ⚠️ Once submitted, your RSVP will be locked and cannot be changed.
                        </p>
                    </div>
                </div>

                {/* Step 1: Ask if they want to edit team details */}
                {step === 'team_edit_question' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Do you want to change team member details?
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Current members: {members.length} (You can have 2-4 members including leader)
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep('team_edit')}
                                className="flex-1 bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition"
                            >
                                Yes, Edit Members
                            </button>
                            <button
                                onClick={() => setStep('city_question')}
                                className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-lg font-semibold text-lg hover:bg-gray-300 transition"
                            >
                                No, Keep Current
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Edit team members */}
                {step === 'team_edit' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Team Members</h2>
                        <p className="text-gray-600 mb-6">
                            Update member details, or add/remove members (2-4 total)
                        </p>

                        <div className="space-y-6 mb-6">
                            {members.map((member, index) => (
                                <div key={member.id} className="p-6 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-medium text-gray-900">
                                            Member {index + 1} {index === 0 && '(Leader)'}
                                        </h3>
                                        {members.length > 2 && index > 0 && (
                                            <button
                                                onClick={() => removeMember(index)}
                                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
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
                                                disabled={index === 0}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {
                            members.length < 4 && (
                                <button
                                    onClick={addMember}
                                    className="w-full mb-6 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
                                >
                                    + Add Member ({members.length}/4)
                                </button>
                            )
                        }

                        < button
                            onClick={() => setStep('city_question')}
                            className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Step 3: Ask if they want to change city */}
                {step === 'city_question' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Do you want to change the city?
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Currently selected: <span className="font-semibold">{CITIES.find(c => c.value === city)?.label}</span>
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep('city_select')}
                                className="flex-1 bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition"
                            >
                                Yes, Change City
                            </button>
                            <button
                                onClick={() => setStep('review')}
                                className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-lg font-semibold text-lg hover:bg-gray-300 transition"
                            >
                                No, Keep Current
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Select city */}
                {step === 'city_select' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            In which city do you want to join us for RIFT?
                        </h2>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {CITIES.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setCity(c.value)}
                                    className={`p-6 border-2 rounded-lg font-medium transition text-lg ${city === c.value
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 hover:border-indigo-300'
                                        }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setStep('review')}
                            className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition"
                        >
                            Continue to Review
                        </button>
                    </div>
                )}

                {/* Step 5: Review and Submit */}
                {step === 'review' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your RSVP</h2>

                        <div className="space-y-6 mb-6">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">City</h3>
                                <p className="text-gray-600">{CITIES.find(c => c.value === city)?.label}</p>
                                <button
                                    onClick={() => setStep('city_question')}
                                    className="text-indigo-600 text-sm mt-1 hover:underline"
                                >
                                    Change
                                </button>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Team Members ({members.length})</h3>
                                <div className="space-y-3">
                                    {members.map((member, index) => (
                                        <div key={member.id} className="p-4 bg-gray-50 rounded-lg">
                                            <p className="font-medium">
                                                {member.name} {index === 0 && '(Leader)'}
                                            </p>
                                            <p className="text-sm text-gray-600">{member.email} • {member.phone}</p>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setStep('team_edit_question')}
                                    className="text-indigo-600 text-sm mt-2 hover:underline"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                        >
                            {submitting ? 'Submitting...' : 'Submit RSVP & Lock'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
