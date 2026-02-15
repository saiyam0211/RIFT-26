'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Table, CheckCircle, X, Users, Clock, LogOut, RefreshCw, MapPin } from 'lucide-react'

interface TeamMember {
    id: string
    name: string
    email: string
    phone: string
    role: 'leader' | 'member'
}

interface Team {
    id: string
    team_name: string
    city: string
    members: TeamMember[]
}

interface ParticipantCheckIn {
    id: string
    participant_name: string
    participant_role: string
    checked_in_at: string
}

interface PendingTeam {
    team: Team
    participants: ParticipantCheckIn[]
    checked_in_at: string
    participants_count: number
}

interface VolunteerInfo {
    email: string
    city: string
    table_name?: string
    table_number?: string
}

export default function VolunteerTablePage() {
    const router = useRouter()
    const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([])
    const [currentTeam, setCurrentTeam] = useState<PendingTeam | null>(null)
    const [processing, setProcessing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [volunteerInfo, setVolunteerInfo] = useState<VolunteerInfo | null>(null)
    const [stats, setStats] = useState({ pending: 0, confirmed: 0 })
    const [allocating, setAllocating] = useState(false)
    const [allocationResult, setAllocationResult] = useState<{ block_name: string; room_name: string; seat_label: string } | null>(null)

    // Real-time polling
    useEffect(() => {
        checkAuth()
        fetchPendingTeams()

        // Poll every 3 seconds for real-time updates
        const interval = setInterval(() => {
            fetchPendingTeams()
        }, 3000)

        return () => clearInterval(interval)
    }, [])

    // Auto-show first pending team
    useEffect(() => {
        if (pendingTeams.length > 0 && !currentTeam) {
            setCurrentTeam(pendingTeams[0])
        }
    }, [pendingTeams, currentTeam])

    const checkAuth = () => {
        const token = localStorage.getItem('volunteer_token')
        const volunteerData = localStorage.getItem('volunteer_user')

        if (!token) {
            router.push('/volunteer/login')
            return
        }

        if (volunteerData) {
            setVolunteerInfo(JSON.parse(volunteerData))
        }
    }

    const fetchPendingTeams = async () => {
        try {
            const token = localStorage.getItem('volunteer_token')
            if (!token) {
                router.push('/volunteer/login')
                return
            }

            const url = `${process.env.NEXT_PUBLIC_API_URL}/table/pending`;
            console.log('Fetching Pending Teams from:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.status === 401) {
                localStorage.removeItem('volunteer_token')
                router.push('/volunteer/login')
                return
            }

            if (!response.ok) {
                let errData;
                const text = await response.text();
                try {
                    errData = JSON.parse(text);
                } catch {
                    errData = { error: text };
                }

                if (response.status === 400 && errData.error === "Volunteer not assigned to a table") {
                    setError("You are not assigned to a table. Please ask an admin to assign you.")
                } else {
                    console.error('Fetch error:', {
                        status: response.status,
                        statusText: response.statusText,
                        data: errData
                    })
                }
                return
            }

            const data = await response.json()
            setPendingTeams(data.pending_teams || [])
            setError('') // Clear error on success
            setStats(prev => ({
                pending: data.pending_teams?.length || 0,
                confirmed: prev.confirmed
            }))
        } catch (err) {
            console.error('Failed to fetch pending teams:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAllocateSeat = async () => {
        if (!currentTeam) return
        setAllocating(true)
        setError('')
        setAllocationResult(null)

        try {
            const token = localStorage.getItem('volunteer_token')
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/table/allocate-seat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ team_id: currentTeam.team.id })
            })

            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                setError(data.error || 'Failed to allocate seat')
                return
            }

            setAllocationResult({
                block_name: data.block_name || '',
                room_name: data.room_name || '',
                seat_label: data.seat_label || ''
            })
            setSuccess('Seat allocated! Tell the team their location.')
        } catch (err: any) {
            setError('Failed to allocate seat')
        } finally {
            setAllocating(false)
        }
    }

    const handleConfirm = async () => {
        if (!currentTeam) return
        setProcessing(true)
        setError('')

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/table/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('volunteer_token')}`
                },
                body: JSON.stringify({ team_id: currentTeam.team.id })
            })

            if (!response.ok) throw new Error('Failed to confirm')

            setSuccess(`✅ ${currentTeam.team.team_name} confirmed!`)
            setStats(prev => ({ ...prev, confirmed: prev.confirmed + 1 }))

            // Remove from pending list
            setPendingTeams(prev => prev.filter(t => t.team.id !== currentTeam.team.id))

            // Auto-advance to next team
            setTimeout(() => {
                setSuccess('')
                setAllocationResult(null)
                setCurrentTeam(null) // Will auto-show next team via useEffect
            }, 1500)

        } catch (err: any) {
            setError('Failed to confirm team')
        } finally {
            setProcessing(false)
        }
    }

    const handleSkip = () => {
        // Move current to end of queue
        if (!currentTeam) return

        const remaining = pendingTeams.filter(t => t.team.id !== currentTeam.team.id)
        setPendingTeams([...remaining, currentTeam])
        setCurrentTeam(null)
    }

    const handleSelectTeam = (team: PendingTeam) => {
        setCurrentTeam(team)
        setAllocationResult(null)
    }

    const handleLogout = () => {
        localStorage.removeItem('volunteer_token')
        localStorage.removeItem('volunteer_user')
        router.push('/volunteer/login')
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
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white text-xl flex items-center gap-3">
                    <RefreshCw className="animate-spin" size={24} />
                    Loading...
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Table className="text-red-500" size={28} />
                                Table Viewer
                            </h1>
                            {volunteerInfo && (
                                <p className="text-zinc-400 text-sm mt-1">
                                    {volunteerInfo.table_name
                                        ? `${volunteerInfo.table_name} • ${getCityName(volunteerInfo.city)}`
                                        : getCityName(volunteerInfo.city)
                                    }
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-zinc-500 text-xs">Pending</p>
                                    <p className="text-2xl font-bold text-orange-400">{stats.pending}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-zinc-500 text-xs">Confirmed</p>
                                    <p className="text-2xl font-bold text-green-400">{stats.confirmed}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-all"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Success Message */}
                {success && (
                    <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle className="text-green-400" size={24} />
                        <p className="text-green-400 font-medium text-lg">{success}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Empty State */}
                {pendingTeams.length === 0 && (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-900 rounded-full mb-6">
                            <CheckCircle className="text-zinc-600" size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">All Caught Up!</h2>
                        <p className="text-zinc-400 mb-6">No pending teams. New check-ins will appear here automatically.</p>
                        <button
                            onClick={fetchPendingTeams}
                            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-lg transition"
                        >
                            <RefreshCw size={18} />
                            Refresh
                        </button>
                    </div>
                )}

                {/* Team List (Queue) */}
                {pendingTeams.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Queue Sidebar */}
                        <div className="lg:col-span-1">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                    <Clock size={18} />
                                    Queue ({pendingTeams.length})
                                </h3>
                                <div className="space-y-2">
                                    {pendingTeams.map((pending, index) => (
                                        <button
                                            key={pending.team.id}
                                            onClick={() => handleSelectTeam(pending)}
                                            className={`w-full text-left p-3 rounded-lg transition-all ${currentTeam?.team.id === pending.team.id
                                                ? 'bg-red-600 text-white'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium truncate">{pending.team.team_name}</p>
                                                    <p className="text-xs opacity-70 mt-0.5">
                                                        {pending.participants_count} participants
                                                    </p>
                                                </div>
                                                {index === 0 && currentTeam?.team.id === pending.team.id && (
                                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main Team Display */}
                        <div className="lg:col-span-2">
                            {currentTeam ? (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                    {/* Team Header */}
                                    <div className="bg-gradient-to-r from-red-600 to-red-700 p-6">
                                        <h2 className="text-3xl font-bold text-white mb-2">
                                            {currentTeam.team.team_name}
                                        </h2>
                                        <p className="text-red-100 text-sm">
                                            Checked in {new Date(currentTeam.checked_in_at).toLocaleTimeString()}
                                        </p>
                                    </div>

                                    {/* Participants List */}
                                    <div className="p-6">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <Users size={20} />
                                            Checked-In Participants ({currentTeam.participants_count})
                                        </h3>
                                        <p className="text-zinc-400 text-sm mb-6">
                                            Write names on badges and hand them over to the team
                                        </p>

                                        {allocationResult && (
                                            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl flex items-center gap-3">
                                                <MapPin className="text-emerald-400 shrink-0" size={24} />
                                                <div>
                                                    <p className="font-semibold text-emerald-300">Seat allocated</p>
                                                    <p className="text-white">
                                                        Block: <strong>{allocationResult.block_name}</strong> → Room: <strong>{allocationResult.room_name}</strong> → Seat: <strong>{allocationResult.seat_label}</strong>
                                                    </p>
                                                    <p className="text-zinc-400 text-sm mt-1">Convey this to the participant team.</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3 mb-8">
                                            {currentTeam.participants.map((participant, index) => (
                                                <div
                                                    key={participant.id}
                                                    className={`p-4 rounded-lg border-2 ${participant.participant_role === 'leader'
                                                        ? 'bg-red-500/10 border-red-500'
                                                        : 'bg-blue-500/10 border-blue-500'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${participant.participant_role === 'leader'
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-blue-500 text-white'
                                                            }`}>
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-white text-lg">
                                                                {participant.participant_name}
                                                            </p>
                                                            <p className="text-xs text-zinc-400">
                                                                {participant.participant_role === 'leader' ? 'Team Leader' : 'Team Member'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={handleAllocateSeat}
                                                    disabled={allocating || !!allocationResult}
                                                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <MapPin size={20} />
                                                    {allocating ? 'Allocating...' : allocationResult ? 'Seat allocated' : 'Allocate seat'}
                                                </button>
                                                <button
                                                    onClick={handleSkip}
                                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 px-6 rounded-xl transition-all"
                                                >
                                                    Skip for Now
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleConfirm}
                                                disabled={processing}
                                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                                            >
                                                <CheckCircle size={24} />
                                                {processing ? 'Processing...' : 'Mark as Done'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                                    <p className="text-zinc-500">Select a team from the queue to continue</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Auto-refresh indicator */}
            <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-xs text-zinc-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Auto-refreshing
            </div>
        </div>
    )
}
