'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import axios from 'axios'
import QRCode from 'react-qr-code'
import { Team, Announcement } from '@/types'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'
import { X, Calendar, Ticket, Bell } from 'lucide-react'

export default function DashboardPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const token = params.token as string
    const isLeaderView = searchParams.get('leader') === 'true'

    const [team, setTeam] = useState<Team | null>(null)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [qrCodeData, setQRCodeData] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showQRModal, setShowQRModal] = useState(false)
    const [showTicketModal, setShowTicketModal] = useState(false)
    const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false)
    const [ticketSubject, setTicketSubject] = useState('')
    const [ticketMessage, setTicketMessage] = useState('')
    const [ticketSubmitting, setTicketSubmitting] = useState(false)
    const [currentUserEmail, setCurrentUserEmail] = useState('')

    useEffect(() => {
        fetchDashboard()
    }, [token])

    const fetchDashboard = async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/${token}`)
            setTeam(response.data.team)
            setAnnouncements(response.data.announcements || [])

            // Get current user's email from localStorage (set during auth)
            const storedEmail = localStorage.getItem('user_email')
            if (storedEmail) {
                setCurrentUserEmail(storedEmail)
            }

            // QR code data is the QR token wrapped in JSON
            if (response.data.team.qr_code_token) {
                const qrData = JSON.stringify({
                    team_id: response.data.team.id,
                    token: response.data.team.qr_code_token,
                    type: 'team',
                })
                setQRCodeData(qrData)
            }

            setLoading(false)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load dashboard')
            setLoading(false)
        }
    }

    const getCityName = (cityCode: string | null | undefined) => {
        const cityMap: Record<string, string> = {
            'BLR': 'Bangalore',
            'PUNE': 'Pune',
            'NOIDA': 'Noida',
            'LKO': 'Lucknow'
        }
        return cityCode ? cityMap[cityCode] || cityCode : 'No City'
    }

    const isLeader = () => {
        if (!team?.members || !currentUserEmail) return false
        const leader = team.members.find(m => m.role === 'leader')
        return leader?.email === currentUserEmail
    }

    const handleSubmitTicket = async () => {
        if (!ticketSubject || !ticketMessage) {
            alert('Please fill in all fields')
            return
        }

        setTicketSubmitting(true)
        try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/tickets`, {
                team_id: team?.id,
                subject: ticketSubject,
                message: ticketMessage
            })
            alert('Ticket submitted successfully! We will respond via email.')
            setShowTicketModal(false)
            setTicketSubject('')
            setTicketMessage('')
        } catch (err) {
            alert('Failed to submit ticket. Please try again.')
        } finally {
            setTicketSubmitting(false)
        }
    }

    const addToGoogleCalendar = () => {
        // Start: 19 Feb 2026, 09:00
        const startDate = '20260219'
        const startTime = '090000'

        // End: 20 Feb 2026, 16:00
        const endDate = '20260220'
        const endTime = '160000'

        const title = encodeURIComponent("RIFT '26 Hackathon")
        const description = encodeURIComponent(
            `Team: ${team?.team_name}\nCity: ${getCityName(team?.city)}`
        )
        const location = encodeURIComponent(getCityName(team?.city))

        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
            `&text=${title}` +
            `&dates=${startDate}T${startTime}/${endDate}T${endTime}` +
            `&details=${description}` +
            `&location=${location}`

        window.open(url, '_blank')
    }




    const copyDashboardLink = () => {
        // Copy link without leader parameter
        const baseUrl = window.location.origin + window.location.pathname
        navigator.clipboard.writeText(baseUrl)
        const btn = document.getElementById('copy-btn')
        if (btn) {
            btn.innerText = '✓ Copied!'
            setTimeout(() => {
                btn.innerText = '📱 Copy Dashboard Link'
            }, 2000)
        }
    }

    const unreadAnnouncementsCount = announcements.length

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

    if (error || !team) {
        return (
            <div className="min-h-screen flex items-center justify-center relative">
                <RIFTBackground />
                <div className="text-center z-10">
                    <p className="text-red-400 text-lg">{error || 'Dashboard not found'}</p>
                </div>
            </div>
        )
    }

    const getStatusBadge = () => {
        const statusConfig = {
            shortlisted: { color: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200', text: 'Shortlisted' },
            rsvp_done: { color: 'bg-blue-500/20 border-blue-500/50 text-blue-200', text: 'RSVP Confirmed' },
            checked_in: { color: 'bg-green-500/20 border-green-500/50 text-green-200', text: 'Checked In ✓' },
        }
        const config = statusConfig[team.status] || statusConfig.shortlisted
        return (
            <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${config.color}`}>
                {config.text}
            </span>
        )
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
            <RIFTBackground />

            {/* Fixed Header Icons - Top Right */}
            <div className="fixed top-6 right-6 z-40 flex items-center gap-3">
                {/* Notification Bell */}
                <button
                    onClick={() => setShowAnnouncementsModal(true)}
                    className="relative bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-full transition"
                >
                    <Bell className="text-white" size={20} />
                    {unreadAnnouncementsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#c0211f] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {unreadAnnouncementsCount}
                        </span>
                    )}
                </button>

                {/* Raise Ticket - Only for Leaders */}
                {isLeader() && (
                    <button
                        onClick={() => setShowTicketModal(true)}
                        className="bg-[#c0211f]/10 hover:bg-[#c0211f]/20 border border-[#c0211f]/30 p-3 rounded-full transition group"
                    >
                        <Ticket className="text-[#c0211f] group-hover:text-white" size={20} />
                    </button>
                )}
            </div>

            {/* QR Code Modal */}
            {showQRModal && qrCodeData && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowQRModal(false)}
                >
                    <div className="relative">
                        <button
                            onClick={() => setShowQRModal(false)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
                        >
                            <X size={32} />
                        </button>
                        <div className="bg-white p-8 rounded-2xl">
                            <QRCode value={qrCodeData} size={Math.min(window.innerWidth - 100, 400)} level="H" />
                        </div>
                        <p className="text-white text-center mt-4 text-sm">
                            Present this QR code at {getCityName(team.city)} venue for check-in
                        </p>
                    </div>
                </div>
            )}

            {/* Announcements Modal */}
            {showAnnouncementsModal && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setShowAnnouncementsModal(false)}
                >
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white text-xl font-semibold flex items-center gap-2">
                                <Bell className="text-[#c0211f]" size={24} />
                                Announcements
                            </h3>
                            <button
                                onClick={() => setShowAnnouncementsModal(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        {announcements.length > 0 ? (
                            <div className="space-y-4">
                                {announcements.map((announcement) => (
                                    <div
                                        key={announcement.id}
                                        className="bg-white/5 border border-white/10 p-4 rounded-lg"
                                    >
                                        <h4 className="text-white font-semibold mb-2">{announcement.title}</h4>
                                        <p className="text-gray-300 text-sm leading-relaxed">{announcement.content}</p>
                                        <p className="text-gray-500 text-xs mt-3">
                                            {new Date(announcement.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-8">No announcements yet</p>
                        )}
                    </div>
                </div>
            )}

            {/* Raise Ticket Modal */}
            {showTicketModal && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setShowTicketModal(false)}
                >
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-md w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white text-xl font-semibold flex items-center gap-2">
                                <Ticket className="text-[#c0211f]" size={24} />
                                Raise a Ticket
                            </h3>
                            <button
                                onClick={() => setShowTicketModal(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-gray-300 text-sm mb-2 block">Subject</label>
                                <input
                                    type="text"
                                    value={ticketSubject}
                                    onChange={(e) => setTicketSubject(e.target.value)}
                                    placeholder="Brief description of your issue"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#c0211f]/50"
                                />
                            </div>
                            <div>
                                <label className="text-gray-300 text-sm mb-2 block">Message</label>
                                <textarea
                                    value={ticketMessage}
                                    onChange={(e) => setTicketMessage(e.target.value)}
                                    placeholder="Describe your issue in detail..."
                                    rows={5}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#c0211f]/50 resize-none"
                                />
                            </div>
                            <button
                                onClick={handleSubmitTicket}
                                disabled={ticketSubmitting}
                                className="w-full bg-[#c0211f] hover:bg-[#a01b1a] disabled:bg-gray-600 text-white py-3 px-4 rounded-lg transition font-medium"
                            >
                                {ticketSubmitting ? 'Submitting...' : 'Submit Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left Side - Fixed Title, Team Name, and QR Code */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 mt-10 py-8 lg:ml-20 lg:px-16 lg:py-12 lg:fixed lg:left-0 lg:top-0 lg:h-screen">
                <div className="space-y-8 lg:space-y-12">
                    {/* RIFT Title */}
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl sm:text-6xl lg:text-8xl font-tan font-bold text-[#c0211f] mb-2 lg:mb-4">
                            RIFT '26
                        </h1>
                    </div>

                    {/* Team Name & Status */}
                    <div className="space-y-4 text-center md:text-left">
                        <div>
                            <p className="text-gray-500 text-sm mb-2">Team Name</p>
                            <h2 className="text-3xl lg:text-4xl font-bold text-white">{team.team_name}</h2>
                        </div>
                        <div className="flex items-center gap-4 justify-center md:justify-start flex-wrap">
                            {getStatusBadge()}
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-300">{getCityName(team.city)}</span>
                        </div>
                    </div>

                    {/* QR Code - Clickable */}
                    {qrCodeData && team.status === 'rsvp_done' && (
                        <div
                            onClick={() => setShowQRModal(true)}
                            className="bg-white/5 border border-white/10 p-5 mx-auto rounded-xl w-56 justify-center items-center cursor-pointer hover:bg-white/10 transition group"
                        >
                            <p className="text-gray-400 text-sm mb-3">Event Check-in</p>
                            <div className="bg-white p-3 rounded-lg inline-block">
                                <QRCode value={qrCodeData} size={160} level="H" />
                            </div>
                            <p className="text-gray-500 text-xs mt-3 leading-relaxed group-hover:text-gray-400 transition">
                                Click to enlarge • Present at {getCityName(team.city)} venue
                            </p>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="space-y-3">
                        {/* Copy Dashboard Link */}
                        <button
                            onClick={copyDashboardLink}
                            id="copy-btn"
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                        >
                            📱 Copy Dashboard Link
                        </button>
                        <button
                            onClick={addToGoogleCalendar}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                        >
                            <Calendar size={18} />
                            Add to Google Calendar
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side - Details */}
            <div className="w-full lg:w-1/2 lg:ml-auto flex items-start justify-center mt-0 md:mt-32 py-8 lg:py-12">
                <div className="w-full max-w-2xl space-y-6 px-6 lg:px-8">

                    {/* Team Members */}
                    {team.members && team.members.length > 0 && (
                        <div className="bg-white/5 border border-white/10 p-2 rounded-xl">
                            <h3 className="text-white text-xl font-semibold mb-4 px-4 py-1">Team Members</h3>
                            <div className="space-y-3">
                                {team.members.map((member) => (
                                    <div key={member.id} className="bg-white/5 p-4 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-[#c0211f] text-white rounded-full flex items-center justify-center font-bold">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">
                                                        {member.name}
                                                        {member.role === 'leader' && (
                                                            <span className="ml-2 text-xs bg-[#c0211f]/20 text-[#c0211f] px-2 py-1 rounded">
                                                                Leader
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-gray-400 text-sm">{member.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Event Information */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                        <h3 className="text-white text-xl font-semibold mb-4">Event Information</h3>
                        <div className="space-y-4 text-gray-300">
                            <div>
                                <p className="text-white font-medium mb-2">What to bring:</p>
                                <ul className="space-y-1 text-sm text-gray-400">
                                    <li>✓ Student ID card (mandatory)</li>
                                    <li>✓ Laptop with charger</li>
                                    <li>✓ This QR code for check-in</li>
                                    <li>✓ Innovation and enthusiasm!</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-white font-medium mb-2">Important Notes:</p>
                                <ul className="space-y-1 text-sm text-gray-400">
                                    <li>• Reporting time will be shared via email</li>
                                    <li>• Save this dashboard link for easy access</li>
                                    <li>• Check announcements regularly for updates</li>
                                    {isLeader() && <li>• Leaders can raise tickets for any queries</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
