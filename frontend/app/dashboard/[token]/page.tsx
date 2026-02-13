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
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Fixed Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
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
                        
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                            {announcements.length > 0 ? (
                                <div className="space-y-4">
                                    {announcements.map((announcement) => (
                                        <div
                                            key={announcement.id}
                                            className="bg-white/5 border border-white/10 p-4 rounded-lg"
                                        >
                                            <h4 className="text-white font-semibold mb-2">{announcement.title}</h4>
                                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                                            {announcement.button_text && announcement.button_url && (
                                                <div className="mt-4">
                                                    <a
                                                        href={announcement.button_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#c0211f] hover:bg-[#a01b1a] text-white text-sm font-medium transition-colors"
                                                    >
                                                        {announcement.button_text}
                                                    </a>
                                                </div>
                                            )}
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
            <div className="w-full lg:w-1/2 lg:ml-auto flex items-start justify-center mt-0 md:mt-20 py-8 lg:py-12">
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

                    {/* Venue Location Map */}
                    {team.city && (
                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-6 pb-4">
                                <h3 className="text-white text-xl font-semibold mb-2">Event Venue</h3>
                                <p className="text-gray-400 text-sm mb-4">
                                    {getCityName(team.city)} • {
                                        team.city === 'BLR' ? 'Brigade Signature Towers' :
                                            team.city === 'NOIDA' ? 'PW Institute of Innovation, Sector 126' :
                                                team.city === 'LKO' ? 'PW Institute of Innovation, Platinum Mall' :
                                                    team.city === 'PUNE' ? 'PW Institute of Innovation, Hadapsar' :
                                                        'Event Venue'
                                    }
                                </p>
                            </div>

                            {/* Map Container */}
                            <div className="relative w-full h-64 bg-zinc-900/50">
                                {team.city === 'BLR' && (
                                    <iframe
                                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3886.71142943678!2d77.75899707612388!3d13.05403131306355!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae0fb237cef1db%3A0x11bf34bc04656e35!2sBrigade%20Signature%20Towers!5e0!3m2!1sen!2sin!4v1770558674479!5m2!1sen!2sin"
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="absolute inset-0"
                                    />
                                )}
                                {team.city === 'NOIDA' && (
                                    <iframe
                                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1395.5331843928445!2d77.33081878578959!3d28.541194545039666!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390ce79f30e621e9%3A0x1591141e17c28c44!2sPW%20Institute%20of%20Innovation%20Noida%20(Sector%20126)%20%7C%7C%20SOH%2C%20SOT%20%26%20SOM!5e0!3m2!1sen!2sin!4v1770558696859!5m2!1sen!2sin"
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="absolute inset-0"
                                    />
                                )}
                                {team.city === 'LKO' && (
                                    <iframe
                                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3561.758382525704!2d80.98929407633487!3d26.78397076560959!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x399be5b28343ce19%3A0x937e2dd34aaa824b!2sPW%20Institute%20of%20Innovation%20Lucknow%20(Platinum%20Mall)%20%7C%7C%20SOH%2C%20SOT%20%26%20SOM!5e0!3m2!1sen!2sin!4v1770558717283!5m2!1sen!2sin"
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="absolute inset-0"
                                    />
                                )}
                                {team.city === 'PUNE' && (
                                    <iframe
                                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.4877844749512!2d73.90537447618597!3d18.506846669591486!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c1f8d79149e3%3A0x5f87d2a08053b873!2sPW%20Institute%20of%20Innovation%20Pune%20(Hadapsar)%20%7C%7C%20SOH%2C%20SOT%20%26%20SOM!5e0!3m2!1sen!2sin!4v1770558739575!5m2!1sen!2sin"
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="absolute inset-0"
                                    />
                                )}
                            </div>

                            {/* Get Directions Button */}
                            <div className="p-4 bg-white/5 border-t border-white/10">
                                <button
                                    onClick={() => {
                                        const venueCoords = {
                                            'BLR': '13.054031,77.760997',
                                            'NOIDA': '28.541195,77.332819',
                                            'LKO': '26.783971,80.991294',
                                            'PUNE': '18.506847,73.907374'
                                        };
                                        const coords = venueCoords[team.city as keyof typeof venueCoords];
                                        if (coords) {
                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, '_blank');
                                        }
                                    }}
                                    className="w-full bg-[#c0211f] hover:bg-[#a01b1a] text-white py-3 px-4 rounded-lg transition font-medium flex items-center justify-center gap-2 group"
                                >
                                    <svg
                                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                    Get Directions
                                </button>
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
                                    {/* {isLeader() && <li>• Leaders can raise tickets for any queries</li>} */}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
