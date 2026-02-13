'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import apiClient from '@/lib/api-client'
import { Team, TeamMember } from '@/types'
import { useRouter } from 'next/navigation'
import { X, History, Check, RotateCcw, LogOut, Users, CheckCircle2 } from 'lucide-react'

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
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)

    useEffect(() => {
        // Check volunteer authentication
        const token = localStorage.getItem('volunteer_token')
        if (!token) {
            router.push('/volunteer/login')
            return
        }

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
        if (!scannedTeam || selectedParticipants.size === 0) return
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

            // Play success sound (optional)
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(200)
            }

            // Update stats
            setStats(prev => ({
                total: prev.total + 1,
                checkedIn: prev.checkedIn + 1
            }))

            // Reset after 2 seconds
            setTimeout(() => {
                resetScanner()
            }, 2000)
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

    const handleLogout = () => {
        localStorage.removeItem('volunteer_token')
        localStorage.removeItem('volunteer_user')
        router.push('/volunteer/login')
    }

    const resetScanner = () => {
        setScannedTeam(null)
        setSelectedParticipants(new Set<string>())
        setAlreadyCheckedIn(false)
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
            <div className="px-4 py-4 grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">Total Scanned</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">Checked In</p>
                    <p className="text-2xl font-bold text-green-400">{stats.checkedIn}</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4">
                {/* Scanner */}
                {scanning && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div id="qr-reader" className="w-full"></div>
                        <div className="p-4 text-center">
                            <p className="text-zinc-400 text-sm">Position QR code within the frame</p>
                        </div>
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
                                    disabled={processing || selectedParticipants.size === 0}
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

                        {alreadyCheckedIn && (
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-800">
                                <button
                                    onClick={resetScanner}
                                    className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-[0.98] text-lg"
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
