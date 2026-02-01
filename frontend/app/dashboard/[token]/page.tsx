'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import QRCode from 'react-qr-code'
import { Team, Announcement } from '@/types'
import RIFTBackground from '@/components/RIFTBackground'
import RIFTLoader from '@/components/RIFTLoader'

export default function DashboardPage() {
    const params = useParams()
    const token = params.token as string

    const [team, setTeam] = useState<Team | null>(null)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [qrCodeData, setQRCodeData] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showQR, setShowQR] = useState(false)

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
                    <RIFTLoader />
                    <p className="mt-4 text-white">Loading dashboard...</p>
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
            shortlisted: { color: 'bg-yellow-100 text-yellow-800', text: 'Shortlisted' },
            rsvp_done: { color: 'bg-blue-100 text-blue-800', text: 'RSVP Confirmed' },
            checked_in: { color: 'bg-green-100 text-green-800', text: 'Checked In ✓' },
        }
        const config = statusConfig[team.status] || statusConfig.shortlisted
        return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                {config.text}
            </span>
        )
    }

    return (
        <div className="min-h-screen py-8 px-4 relative">
            <RIFTBackground />
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{team.team_name}</h1>
                            <p className="text-gray-600">RIFT '26 Hackathon</p>
                        </div>
                        <div>{getStatusBadge()}</div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-indigo-50 p-4 rounded-lg">
                            <p className="text-sm text-indigo-600 font-medium">City</p>
                            <p className="text-xl font-bold text-indigo-900">{team.city || 'Not selected'}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <p className="text-sm text-purple-600 font-medium">Team Members</p>
                            <p className="text-xl font-bold text-purple-900">{team.members?.length || 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">Status</p>
                            <p className="text-xl font-bold text-green-900">
                                {team.status === 'checked_in' ? 'Checked In' : team.rsvp_locked ? 'Confirmed' : 'Pending'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* QR Code Section */}
                {qrCodeData && team.status === 'rsvp_done' && (
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Check-in QR Code</h2>
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="flex-shrink-0">
                                    {showQR ? (
                                        <div className="bg-white p-4 rounded-lg shadow-lg">
                                            <QRCode value={qrCodeData} size={200} level="H" />
                                        </div>
                                    ) : (
                                        <div className="bg-white p-8 rounded-lg shadow-lg w-52 h-52 flex items-center justify-center">
                                            <button
                                                onClick={() => setShowQR(true)}
                                                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
                                            >
                                                Show QR Code
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Day Check-in</h3>
                                    <p className="text-gray-700 mb-4">
                                        Show this QR code to volunteers at the venue for check-in on event day.
                                    </p>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p>✓ One QR code for the entire team</p>
                                        <p>✓ Valid at {team.city} venue only</p>
                                        <p>✓ Keep this page accessible on event day</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Team Members */}
                {team.members && team.members.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Team Members</h2>
                        <div className="space-y-3">
                            {team.members.map((member, index) => (
                                <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {member.name}
                                                {member.role === 'leader' && (
                                                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                                        Leader
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-sm text-gray-600">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm text-gray-600">
                                        <p>T-Shirt: {member.tshirt_size || 'N/A'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Announcements */}
                {announcements.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">📢 Announcements</h2>
                        <div className="space-y-3">
                            {announcements.map((announcement) => (
                                <div
                                    key={announcement.id}
                                    className="p-4 border-l-4 border-indigo-500 bg-indigo-50 rounded-r-lg"
                                >
                                    <h3 className="font-semibold text-gray-900 mb-1">{announcement.title}</h3>
                                    <p className="text-gray-700 text-sm">{announcement.content}</p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {new Date(announcement.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Event Info */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Information</h2>
                    <div className="prose max-w-none text-gray-700">
                        <p className="mb-3">
                            <strong>What to bring:</strong>
                        </p>
                        <ul className="list-disc list-inside space-y-1 mb-4">
                            <li>Student ID card (mandatory)</li>
                            <li>Laptop with charger</li>
                            <li>This QR code for check-in</li>
                            <li>Innovation and enthusiasm!</li>
                        </ul>
                        <p className="mb-3">
                            <strong>Important:</strong>
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Reporting time will be shared via email</li>
                            <li>Save this dashboard link for easy access</li>
                            <li>Check announcements regularly for updates</li>
                        </ul>
                    </div>
                </div>

                {/* Shareable Link */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
                    <h3 className="text-xl font-bold mb-2">📱 Share Dashboard</h3>
                    <p className="mb-4 opacity-90">Share this link with your team members:</p>
                    <div className="bg-white/10 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                        <code className="flex-1 text-sm break-all">
                            {typeof window !== 'undefined' ? window.location.href : ''}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href)
                                alert('Link copied to clipboard!')
                            }}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition flex-shrink-0"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
