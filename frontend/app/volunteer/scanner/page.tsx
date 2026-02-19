'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import apiClient from '@/lib/api-client'
import { Team, TeamMember } from '@/types'
import { useRouter } from 'next/navigation'
import { X, History, Check, RotateCcw, LogOut, Users, CheckCircle2, MapPin, RefreshCw } from 'lucide-react'

interface ParticipantCheckIn {
    id: string
    participant_name: string
    participant_role: string
    checked_in_at: string
}

interface CheckInHistory {
    team_id: string
    team_name: string
    checked_in_at: string
    participants_count: number
    participants: ParticipantCheckIn[]
    table_confirmed: boolean
}

export default function VolunteerScannerPage() {
    const router = useRouter()
    const [scannedTeam, setScannedTeam] = useState<Team | null>(null)
    const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
    const [participantsCheckedIn, setParticipantsCheckedIn] = useState<ParticipantCheckIn[]>([])
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [scanning, setScanning] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [history, setHistory] = useState<CheckInHistory[]>([])
    const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
    const [pendingTeams, setPendingTeams] = useState<any[]>([])
    const [loadingPending, setLoadingPending] = useState(false)
    const [allocating, setAllocating] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<string | null>(null)
    const [allocationResult, setAllocationResult] = useState<Record<string, any>>({})
    const [volunteerInfo, setVolunteerInfo] = useState<any>(null)
    const [justCheckedIn, setJustCheckedIn] = useState(false) // Track if team was just checked in
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)

    useEffect(() => {
        // Check volunteer authentication
        const token = localStorage.getItem('volunteer_token')
        const volunteerData = localStorage.getItem('volunteer_user')
        if (!token) {
            router.push('/volunteer/login')
            return
        }

        if (volunteerData) {
            setVolunteerInfo(JSON.parse(volunteerData))
        }

        // Fetch pending teams on mount
        fetchPendingTeams()

        let isMounted = true;

        // Initialize QR scanner only when scanning is true
        if (scanning && !scannerRef.current) {
            // Small delay to ensure DOM is ready and previous cleanup is done
            const timer = setTimeout(() => {
                if (!isMounted) return;

                // Prevent double initialization
                if (scannerRef.current) return;

                // Ensure element exists
                if (!document.getElementById('qr-reader')) return;

                try {
                    const scanner = new Html5QrcodeScanner(
                        'qr-reader',
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0,
                            showTorchButtonIfSupported: true,
                        },
                        false
                    )

                    scanner.render(onScanSuccess, onScanError)
                    scannerRef.current = scanner

                    // Remove the default "Scan an Image File" option from the library UI
                    setTimeout(hideImageScanOption, 0)
                } catch (err) {
                    console.error("Failed to initialize scanner:", err)
                }
            }, 100); // 100ms delay

            return () => clearTimeout(timer);
        }

        return () => {
            isMounted = false;
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch((err) => {
                        console.warn("Field to clear scanner:", err)
                    })
                } catch (e) {
                    console.error(e)
                }
                scannerRef.current = null
            }
        }
    }, [scanning, router])

    const hideImageScanOption = () => {
        if (typeof window === 'undefined') return
        const container = document.getElementById('qr-reader')
        if (!container) return

        // Hide any control that mentions scanning an image / file
        const candidates = container.querySelectorAll('button, a, span')
        candidates.forEach((el) => {
            if (el.textContent && el.textContent.toLowerCase().includes('scan an image')) {
                (el as HTMLElement).style.display = 'none'
            }
        })

        // Hide file input if present
        const fileInput = container.querySelector('input[type="file"]') as HTMLElement | null
        if (fileInput) {
            fileInput.style.display = 'none'
        }
    }

    const onScanSuccess = async (decodedText: string) => {
        if (processing) return
        setProcessing(true)
        setError('')
        setSuccess('')

        try {
            const response = await apiClient.post('/checkin/scan', {
                qr_data: decodedText,
            })

            setScannedTeam(response.data.team)
            setAlreadyCheckedIn(response.data.already_checked_in || false)
            setParticipantsCheckedIn(response.data.participants_checked_in || [])
            setScanning(false)

            // If already checked in, show who was checked in
            if (response.data.already_checked_in) {
                const checkedInIds = new Set<string>(
                    response.data.participants_checked_in.map((p: ParticipantCheckIn) =>
                        p.participant_role === 'leader' ? 'leader' : p.id
                    )
                )
                setSelectedParticipants(checkedInIds)
            } else {
                // Auto-select all participants
                const team = response.data.team
                const allIds = new Set<string>(['leader'])
                team.members?.forEach((m: TeamMember) => {
                    if (m.role === 'member') {
                        allIds.add(m.id)
                    }
                })
                setSelectedParticipants(allIds)
            }

            // Clear scanner
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error)
                scannerRef.current = null
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to scan QR code')
            setProcessing(false)
        } finally {
            setProcessing(false)
        }
    }

    const onScanError = (errorMessage: string) => {
        // Ignore continuous scanning errors
    }

    const toggleParticipant = (id: string) => {
        if (alreadyCheckedIn) return // Can't change if already checked in

        const newSelected = new Set(selectedParticipants)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedParticipants(newSelected)
    }

    const handleCheckIn = async () => {
        if (!scannedTeam) return
        if (selectedParticipants.size < 2) {
            setError('At least 2 participants must be selected to check in a team.')
            return
        }
        setProcessing(true)
        setError('')

        try {
            // Build participants array
            const participants = []

            // Add leader if selected
            if (selectedParticipants.has('leader')) {
                const leader = scannedTeam.members?.find(m => m.role === 'leader')
                if (leader) {
                    participants.push({
                        member_id: leader.id,
                        name: leader.name,
                        role: 'leader'
                    })
                }
            }

            // Add selected members
            scannedTeam.members?.forEach(member => {
                if (member.role === 'member' && selectedParticipants.has(member.id)) {
                    participants.push({
                        member_id: member.id,
                        name: member.name,
                        role: 'member'
                    })
                }
            })

            await apiClient.post('/checkin/participants', {
                team_id: scannedTeam.id,
                participants
            })

            setSuccess(`✅ ${participants.length} participant(s) checked in successfully!`)
            setJustCheckedIn(true) // Mark that this team was just checked in
            setAlreadyCheckedIn(true) // Mark as checked in so action buttons appear

            // Play success sound (optional)
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(200)
            }

            // Update stats
            setStats(prev => ({
                total: prev.total + 1,
                checkedIn: prev.checkedIn + 1
            }))

            // Refresh pending teams to show the newly checked-in team
            await fetchPendingTeams()

            // Don't auto-reset - let user see the team and allocate seat if needed
            // Reset scanner will be manual or after allocation
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to check in participants')
        } finally {
            setProcessing(false)
        }
    }

    const fetchHistory = async () => {
        try {
            const response = await apiClient.get('/checkin/history?limit=20')
            setHistory(response.data.check_ins || [])
            setShowHistory(true)
        } catch (err) {
            setError('Failed to fetch history')
        }
    }

    const handleUndoCheckIn = async (teamId: string, teamName: string) => {
        if (!confirm(`Undo check-in for ${teamName}?`)) return

        try {
            await apiClient.delete(`/checkin/${teamId}`)
            setSuccess('Check-in undone successfully')
            fetchHistory() // Refresh history
            setTimeout(() => setSuccess(''), 2000)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to undo check-in')
        }
    }

    const fetchPendingTeams = async () => {
        setLoadingPending(true)
        try {
            const response = await apiClient.get('/table/pending')
            setPendingTeams(response.data.pending_teams || [])
        } catch (err: any) {
            console.error('Failed to fetch pending teams:', err)
        } finally {
            setLoadingPending(false)
        }
    }

    const handleAllocateSeat = async (teamId: string) => {
        setAllocating(teamId)
        setError('')
        try {
            const response = await apiClient.post('/table/allocate-seat', { team_id: teamId })
            // Handle both "already allocated" and "newly allocated" responses
            const allocationData = {
                block_name: response.data.block_name,
                room_name: response.data.room_name,
                seat_label: response.data.seat_label,
                team_size: response.data.team_size
            }
            setAllocationResult({
                ...allocationResult,
                [teamId]: allocationData
            })
            const message = response.data.message === 'Seat already allocated' 
                ? `Seat already allocated: ${allocationData.block_name} → ${allocationData.room_name} → ${allocationData.seat_label}`
                : `Seat allocated successfully! (Team size: ${allocationData.team_size})`
            setSuccess(message)
            setTimeout(() => setSuccess(''), 3000)
            // Refresh pending teams to update the UI
            await fetchPendingTeams()
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Failed to allocate seat'
            // If error mentions "already allocated", try to fetch existing allocation
            if (errorMsg.includes('already') || errorMsg.includes('duplicate')) {
                setError('Seat already allocated. Refreshing...')
                await fetchPendingTeams()
                setTimeout(() => setError(''), 2000)
            } else {
                setError(errorMsg)
            }
        } finally {
            setAllocating(null)
        }
    }

    const handleMarkAsDone = async (teamId: string) => {
        setConfirming(teamId)
        setError('')
        try {
            await apiClient.post('/table/confirm', { team_id: teamId })
            setSuccess('Team marked as done!')
            // Remove from pending list
            setPendingTeams(prev => prev.filter(t => t.team.id !== teamId))
            setTimeout(() => setSuccess(''), 2000)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to mark as done')
        } finally {
            setConfirming(null)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('volunteer_token')
        localStorage.removeItem('volunteer_user')
        router.push('/volunteer/login')
    }

    // Normalize city for comparison (handle different formats)
    const normalizeCity = (city: string | undefined) => {
        if (!city) return ''
        const cityLower = city.toLowerCase().trim()
        if (cityLower === 'bangalore' || cityLower === 'bengaluru' || cityLower === 'blr') {
            return 'BLR'
        }
        return city.toUpperCase()
    }
    
    const volunteerCityNormalized = normalizeCity(volunteerInfo?.city)
    const isBengaluru = volunteerCityNormalized === 'BLR'

    const resetScanner = () => {
        setScannedTeam(null)
        setSelectedParticipants(new Set<string>())
        setAlreadyCheckedIn(false)
        setJustCheckedIn(false)
        setParticipantsCheckedIn([])
        setError('')
        setSuccess('')
        setProcessing(false)

        // Clear existing scanner
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error)
            scannerRef.current = null
        }

        setScanning(true)
    }

    const leader = scannedTeam?.members?.find(m => m.role === 'leader')
    const members = scannedTeam?.members?.filter(m => m.role === 'member') || []

    return (
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Header */}
            <div className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-50">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Scanner</h1>
                            <p className="text-xs text-zinc-500">Scan QR & Check In</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchHistory}
                                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
                            >
                                <History size={20} />
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="px-4 py-4 grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">Total Scanned</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">Checked In</p>
                    <p className="text-2xl font-bold text-green-400">{stats.checkedIn}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">Pending</p>
                    <p className="text-2xl font-bold text-orange-400">{pendingTeams.length}</p>
                </div>
            </div>

            {/* Pending Teams */}
            {pendingTeams.length > 0 && (
                <div className="px-4 mb-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">Pending Teams</h2>
                            <button
                                onClick={fetchPendingTeams}
                                disabled={loadingPending}
                                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
                            >
                                <RefreshCw size={18} className={loadingPending ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {pendingTeams.map((pending) => (
                                <div key={pending.team.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-white mb-1">{pending.team.team_name}</h3>
                                            <p className="text-xs text-zinc-400">
                                                {pending.participants_count} participants • {new Date(pending.checked_in_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {allocationResult[pending.team.id] && (
                                        <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg">
                                            <p className="text-xs text-emerald-400 font-medium mb-2">✓ Seat Allocated — tell team:</p>
                                            <p className="text-sm font-semibold text-white">Block: {allocationResult[pending.team.id].block_name}</p>
                                            <p className="text-sm font-semibold text-white">Room: {allocationResult[pending.team.id].room_name}</p>
                                            {/* <p className="text-sm font-semibold text-white">Seat: {allocationResult[pending.team.id].seat_label}</p> */}
                                            {allocationResult[pending.team.id].team_size && (
                                                <p className="text-xs text-zinc-400 mt-1">Team size: {allocationResult[pending.team.id].team_size}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {isBengaluru && !allocationResult[pending.team.id] && !pending.seat_allocation && (
                                            <button
                                                onClick={() => handleAllocateSeat(pending.team.id)}
                                                disabled={allocating === pending.team.id}
                                                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                                            >
                                                <MapPin size={16} />
                                                {allocating === pending.team.id ? 'Allocating...' : 'Allocate Seat'}
                                            </button>
                                        )}
                                        
                                        {/* Show existing seat allocation from backend */}
                                        {pending.seat_allocation && !allocationResult[pending.team.id] && (
                                            <div className="flex-1 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg">
                                                <p className="text-xs text-emerald-400 font-medium mb-1">✓ Seat Already Allocated</p>
                                                <p className="text-sm font-semibold text-white">Block: {pending.seat_allocation.block_name}</p>
                                                <p className="text-sm font-semibold text-white">Room: {pending.seat_allocation.room_name}</p>
                                                <p className="text-sm font-semibold text-white">Seat: {pending.seat_allocation.seat_label}</p>
                                                {pending.seat_allocation.team_size && (
                                                    <p className="text-xs text-zinc-400 mt-1">Team size: {pending.seat_allocation.team_size}</p>
                                                )}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleMarkAsDone(pending.team.id)}
                                            disabled={confirming === pending.team.id}
                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                                        >
                                            <CheckCircle2 size={16} />
                                            {confirming === pending.team.id ? 'Processing...' : 'Mark as Done'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="px-4">
                {/* Scanner */}
                {scanning && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div id="qr-reader" className="w-full"></div>
                        <div className="p-4 text-center space-y-3">
                            <p className="text-zinc-400 text-sm">Position QR code within the frame</p>
                            <button
                                type="button"
                                onClick={() => setScanning(false)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Stop scanning
                            </button>
                        </div>
                    </div>
                )}
                {!scanning && !scannedTeam && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
                        <p className="text-zinc-300 text-sm font-medium">Scanner paused</p>
                        <p className="text-zinc-500 text-xs">
                            Tap below to start the camera and begin scanning QR codes.
                        </p>
                        <button
                            type="button"
                            onClick={() => setScanning(true)}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition"
                        >
                            Start scanning
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-4">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Success */}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 mb-4">
                        <p className="text-green-400 text-sm font-medium">{success}</p>
                    </div>
                )}

                {/* Team Details & Participant Selection */}
                {scannedTeam && !scanning && (
                    <div className="space-y-4">
                        {/* Team Info */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">{scannedTeam.team_name}</h2>
                                    {alreadyCheckedIn && (
                                        <span className="inline-flex items-center gap-1.5 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/50">
                                            <CheckCircle2 size={14} />
                                            Already Checked In
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={resetScanner}
                                    className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Participants Selection */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Users size={20} className="text-zinc-400" />
                                <h3 className="font-semibold text-white">
                                    Select Participants ({selectedParticipants.size}/{(leader ? 1 : 0) + members.length})
                                </h3>
                            </div>

                            <div className="space-y-2">
                                {/* Leader */}
                                {leader && (
                                    <button
                                        onClick={() => toggleParticipant('leader')}
                                        disabled={alreadyCheckedIn}
                                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedParticipants.has('leader')
                                            ? 'bg-red-500/20 border-red-500'
                                            : 'bg-zinc-800/50 border-zinc-700'
                                            } ${alreadyCheckedIn ? 'opacity-60' : 'active:scale-[0.98]'}`}
                                    >
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedParticipants.has('leader')
                                            ? 'bg-red-500 border-red-500'
                                            : 'border-zinc-600'
                                            }`}>
                                            {selectedParticipants.has('leader') && <Check size={16} className="text-white" />}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium text-white">{leader.name}</p>
                                            <p className="text-xs text-zinc-400">Team Leader</p>
                                        </div>
                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">Leader</span>
                                    </button>
                                )}

                                {/* Members */}
                                {members.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => toggleParticipant(member.id)}
                                        disabled={alreadyCheckedIn}
                                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedParticipants.has(member.id)
                                            ? 'bg-blue-500/20 border-blue-500'
                                            : 'bg-zinc-800/50 border-zinc-700'
                                            } ${alreadyCheckedIn ? 'opacity-60' : 'active:scale-[0.98]'}`}
                                    >
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedParticipants.has(member.id)
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-zinc-600'
                                            }`}>
                                            {selectedParticipants.has(member.id) && <Check size={16} className="text-white" />}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium text-white">{member.name}</p>
                                            <p className="text-xs text-zinc-400">{member.email}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {!alreadyCheckedIn && (
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
                                <button
                                    onClick={handleCheckIn}
                                    disabled={processing || selectedParticipants.size < 2}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-[0.98] text-lg"
                                >
                                    {processing ? (
                                        'Processing...'
                                    ) : (
                                        `Check In ${selectedParticipants.size} Participant${selectedParticipants.size !== 1 ? 's' : ''}`
                                    )}
                                </button>
                            </div>
                        )}

                        {/* After successful check-in, show action buttons */}
                        {(justCheckedIn || alreadyCheckedIn) && scannedTeam && (
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800 space-y-2">
                                {/* Show allocate seat button for BLR right after check-in (only if not already allocated) */}
                                {isBengaluru && !allocationResult[scannedTeam.id] && (
                                    <button
                                        onClick={() => handleAllocateSeat(scannedTeam.id)}
                                        disabled={allocating === scannedTeam.id}
                                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                                    >
                                        <MapPin size={20} />
                                        {allocating === scannedTeam.id ? 'Allocating Seat...' : 'Allocate Seat'}
                                    </button>
                                )}
                                
                                {/* Show seat allocation result if allocated */}
                                {allocationResult[scannedTeam.id] && (
                                    <div className="mb-2 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-lg">
                                        <p className="text-xs text-emerald-400 font-medium mb-2">✓ Seat Allocated — tell the team:</p>
                                        <p className="text-base font-semibold text-white mb-1">Block: {allocationResult[scannedTeam.id].block_name}</p>
                                        <p className="text-base font-semibold text-white mb-1">Room: {allocationResult[scannedTeam.id].room_name}</p>
                                        {/* <p className="text-base font-semibold text-white">Seat: {allocationResult[scannedTeam.id].seat_label}</p> */}
                                        {allocationResult[scannedTeam.id].team_size && (
                                            <p className="text-xs text-zinc-400 mt-2">Team size: {allocationResult[scannedTeam.id].team_size} participants</p>
                                        )}
                                    </div>
                                )}

                                {/* Mark as Done button */}
                                <button
                                    onClick={async () => {
                                        await handleMarkAsDone(scannedTeam.id)
                                        setTimeout(() => {
                                            resetScanner()
                                            setJustCheckedIn(false)
                                        }, 2000)
                                    }}
                                    disabled={confirming === scannedTeam.id}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
                                >
                                    <CheckCircle2 size={20} />
                                    {confirming === scannedTeam.id ? 'Processing...' : 'Mark as Done'}
                                </button>

                                {/* Scan Next button */}
                                <button
                                    onClick={() => {
                                        resetScanner()
                                        setJustCheckedIn(false)
                                    }}
                                    className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                                >
                                    Scan Next Team
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white">Check-In History</h3>
                                <p className="text-sm text-zinc-400">Recent check-ins</p>
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {history.length === 0 ? (
                                <p className="text-center text-zinc-500 py-8">No check-ins yet</p>
                            ) : (
                                history.map((item) => (
                                    <div key={item.team_id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="font-semibold text-white mb-1">{item.team_name}</h4>
                                                <p className="text-xs text-zinc-400">
                                                    {new Date(item.checked_in_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUndoCheckIn(item.team_id, item.team_name)}
                                                className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition flex items-center gap-1.5 text-xs"
                                            >
                                                <RotateCcw size={14} />
                                                Undo
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-zinc-400">{item.participants_count} participants</span>
                                            {item.table_confirmed && (
                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                                    ✓ Confirmed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
