'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import QRCode from 'react-qr-code'
import { Team, Announcement } from '@/types'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'

export default function DashboardPage() {
    const params = useParams()
    const token = params.token as string

    const [team, setTeam] = useState<Team | null>(null)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [qrCodeData, setQRCodeData] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchDashboard()
    }, [token])

    const fetchDashboard = async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/${token}`)
            setTeam(response.data.team)
            setAnnouncements(response.data.announcements || [])

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
                        <div className="flex items-center gap-4 justify-center md:justify-start">
                            {getStatusBadge()}
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-300">{team.city || 'No City'}</span>
                        </div>
                    </div>

                    {/* QR Code */}
                    {qrCodeData && team.status === 'rsvp_done' && (
                        <div className="bg-white/5 border border-white/10 p-5 mx-auto rounded-xl w-56 justify-center items-center">
                            <p className="text-gray-400 text-sm mb-3">Event Check-in</p>
                            <div className="bg-white p-3 rounded-lg inline-block">
                                <QRCode value={qrCodeData} size={160} level="H" />
                            </div>
                            <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                                Present this QR at {team.city} venue
                            </p>
                        </div>
                    )}

                    {/* Share Link */}
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href)
                            const btn = document.getElementById('copy-btn')
                            if (btn) {
                                btn.innerText = '✓ Copied!'
                                setTimeout(() => {
                                    btn.innerText = '📱 Copy Dashboard Link'
                                }, 2000)
                            }
                        }}
                        id="copy-btn"
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 font-medium"
                    >
                        📱 Copy Dashboard Link
                    </button>
                </div>
            </div>

            {/* Right Side - Details */}
            <div className="w-full lg:w-1/2 lg:ml-auto flex items-start justify-center min-h-screen mt-0 md:mt-40 py-8 lg:py-12">
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

                    {/* Announcements */}
                    {announcements.length > 0 && (
                        <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                            <h3 className="text-white text-xl font-semibold mb-4">📢 Announcements</h3>
                            <div className="space-y-3">
                                {announcements.map((announcement) => (
                                    <div
                                        key={announcement.id}
                                        className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-r-lg"
                                    >
                                        <h4 className="text-white font-semibold mb-1">{announcement.title}</h4>
                                        <p className="text-gray-300 text-sm">{announcement.content}</p>
                                        <p className="text-gray-500 text-xs mt-2">
                                            {new Date(announcement.created_at).toLocaleDateString()}
                                        </p>
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
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
