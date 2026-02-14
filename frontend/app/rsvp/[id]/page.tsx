'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { Team, TeamMember } from '@/types'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'
import { ArrowLeft, Users, CheckCircle2, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

export default function RSVP2Page() {
    const params = useParams()
    const router = useRouter()
    const teamId = params.id as string
    const { token: authToken } = useAuthStore()

    const [team, setTeam] = useState<Team | null>(null)
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        // Wait a bit for auth to be available
        const timer = setTimeout(() => {
            fetchTeamDetails()
        }, 100)
        return () => clearTimeout(timer)
    }, [teamId, authToken])

    const fetchTeamDetails = async () => {
        try {
            // Try multiple sources for the token
            let token = authToken || localStorage.getItem('auth_token')
            
            // If still not found, try to extract from Zustand persist storage
            if (!token) {
                const authStorage = localStorage.getItem('auth-storage')
                if (authStorage) {
                    try {
                        const parsed = JSON.parse(authStorage)
                        token = parsed?.state?.token
                    } catch (e) {
                        console.error('Failed to parse auth-storage:', e)
                    }
                }
            }
            
            console.log('=== RSVP2 Auth Debug ===')
            console.log('authToken from store:', authToken ? authToken.substring(0, 30) + '...' : 'null')
            console.log('localStorage auth_token:', localStorage.getItem('auth_token') ? 'exists' : 'missing')
            console.log('localStorage auth-storage:', localStorage.getItem('auth-storage') ? 'exists' : 'missing')
            console.log('Final token to use:', token ? token.substring(0, 30) + '...' : 'MISSING!')
            console.log('========================')
            
            if (!token) {
                console.error('❌ No auth token found anywhere, redirecting to home')
                setError('Authentication required. Please login again.')
                setTimeout(() => router.push('/'), 2000)
                return
            }

            console.log('Fetching team with ID:', teamId)
            console.log('Using token:', token?.substring(0, 20) + '...')
            
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            console.log('Team data received:', response.data)
            
            // Backend returns team directly, not wrapped in { team: ... }
            const teamData = response.data
            setTeam(teamData)

            // Check if team is in correct state for RSVP II
            if (teamData.status !== 'rsvp_done') {
                setError('Team must complete RSVP I before RSVP II')
                return
            }

            if (teamData.rsvp2_locked) {
                // Team already completed RSVP II, redirect to dashboard
                router.push(`/dashboard/${teamData.dashboard_token}`)
                return
            }

            // Start with no members selected - user must choose who's attending
            setSelectedMembers(new Set<string>())

            setLoading(false)
        } catch (err: any) {
            console.error('Error fetching team details:', err)
            console.error('Error response:', err.response?.data)
            console.error('Error status:', err.response?.status)
            
            if (err.response?.status === 401) {
                setError('Authentication failed. Please login again.')
                setTimeout(() => router.push('/'), 2000)
            } else {
                setError(err.response?.data?.error || 'Failed to load team details')
            }
            setLoading(false)
        }
    }

    const toggleMember = (memberId: string) => {
        const newSelected = new Set(selectedMembers)
        if (newSelected.has(memberId)) {
            newSelected.delete(memberId)
        } else {
            newSelected.add(memberId)
        }
        setSelectedMembers(newSelected)
    }

    const handleSubmit = async () => {
        if (selectedMembers.size === 0) {
            setError('Please select at least one team member')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            // Try multiple sources for the token
            let token = authToken || localStorage.getItem('auth_token')
            
            // If still not found, try to extract from Zustand persist storage
            if (!token) {
                const authStorage = localStorage.getItem('auth-storage')
                if (authStorage) {
                    try {
                        const parsed = JSON.parse(authStorage)
                        token = parsed?.state?.token
                    } catch (e) {
                        console.error('Failed to parse auth-storage:', e)
                    }
                }
            }
            
            console.log('Submit - Token:', token ? 'exists' : 'MISSING')
            
            if (!token) {
                setError('Authentication required. Please login again.')
                setSubmitting(false)
                return
            }
            
            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}/rsvp2`,
                {
                    selected_member_ids: Array.from(selectedMembers)
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            )

            // Redirect to dashboard
            if (response.data.team?.dashboard_token) {
                router.push(`/dashboard/${response.data.team.dashboard_token}`)
            } else {
                router.push('/')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit RSVP II')
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <RIFTBackground />
                <div className="text-center z-10">
                    <CustomLoader />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <RIFTBackground />
                <div className="text-center z-10 max-w-md mx-auto px-4">
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-[#c0211f] hover:bg-[#a01b1a] text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!team) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <RIFTBackground />
                <div className="text-center z-10">
                    <p className="text-white">Team not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen relative">
            <RIFTBackground />
            
            <div className="relative z-10 container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="text-white" size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">RSVP II</h1>
                        <p className="text-gray-400">Select attending team members</p>
                    </div>
                </div>

                {/* Team Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">{team.team_name}</h2>
                    <div className="flex items-center gap-4 text-gray-300">
                        <span>City: {team.city || 'Not specified'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <CheckCircle2 size={16} className="text-green-400" />
                            RSVP I Completed
                        </span>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-6 mb-8">
                    <h3 className="text-blue-400 font-semibold mb-2">Instructions</h3>
                    <p className="text-gray-300 text-sm">
                        Please select which team members will be attending RIFT '26. 
                        Only selected members will be shown on your dashboard and will be eligible for check-in at the event.
                    </p>
                </div>

                {/* Member Selection */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-6">
                        <Users className="text-[#c0211f]" size={24} />
                        <h3 className="text-xl font-bold text-white">
                            Select Attending Members ({selectedMembers.size}/{team.members?.length || 0})
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {team.members?.map((member) => (
                            <div
                                key={member.id}
                                onClick={() => toggleMember(member.id)}
                                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                    selectedMembers.has(member.id)
                                        ? 'bg-[#c0211f]/20 border-[#c0211f]'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                    selectedMembers.has(member.id)
                                        ? 'bg-[#c0211f] border-[#c0211f]'
                                        : 'border-gray-400'
                                }`}>
                                    {selectedMembers.has(member.id) && (
                                        <CheckCircle2 size={16} className="text-white" />
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-gray-400" />
                                        <span className="text-white font-medium">{member.name}</span>
                                        {member.role === 'leader' && (
                                            <span className="text-xs bg-[#c0211f]/20 text-[#c0211f] px-2 py-1 rounded-full">
                                                Leader
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-sm">{member.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-center">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || selectedMembers.size === 0}
                        className="bg-[#c0211f] hover:bg-[#a01b1a] disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold py-4 px-8 rounded-xl transition-all text-lg min-w-[200px]"
                    >
                        {submitting ? (
                            'Submitting...'
                        ) : (
                            `Confirm ${selectedMembers.size} Member${selectedMembers.size !== 1 ? 's' : ''}`
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4">
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                )}
            </div>
        </div>
    )
}