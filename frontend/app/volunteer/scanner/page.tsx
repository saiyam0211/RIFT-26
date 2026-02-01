'use client'

import { useState, useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import apiClient from '@/lib/api-client'
import { Team } from '@/types'

export default function VolunteerScannerPage() {
    const [scannedTeam, setScannedTeam] = useState<Team | null>(null)
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
    const [checkedInAt, setCheckedInAt] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [scanning, setScanning] = useState(true)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        // Initialize QR scanner
        const scanner = new Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        )

        scanner.render(onScanSuccess, onScanError)

        return () => {
            scanner.clear()
        }
    }, [])

    const onScanSuccess = async (decodedText: string) => {
        if (processing) return
        setProcessing(true)
        setError('')
        setSuccess('')

        try {
            // Send QR data to backend
            const response = await apiClient.post('/checkin/scan', {
                qr_data: decodedText,
            })

            setScannedTeam(response.data.team)
            setAlreadyCheckedIn(response.data.already_checked_in || false)
            setCheckedInAt(response.data.checked_in_at)
            setScanning(false)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to scan QR code')
            setProcessing(false)
        }
    }

    const onScanError = (errorMessage: string) => {
        // Ignore continuous scanning errors
    }

    const handleConfirmCheckin = async () => {
        if (!scannedTeam) return
        setProcessing(true)
        setError('')

        try {
            await apiClient.post('/checkin/confirm', {
                team_id: scannedTeam.id,
            })

            setSuccess(`${scannedTeam.team_name} checked in successfully!`)

            // Reset after 3 seconds
            setTimeout(() => {
                resetScanner()
            }, 3000)
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to check in team')
        } finally {
            setProcessing(false)
        }
    }

    const resetScanner = () => {
        setScannedTeam(null)
        setAlreadyCheckedIn(false)
        setCheckedInAt(null)
        setError('')
        setSuccess('')
        setScanning(true)
        setProcessing(false)
        window.location.reload() // Reload to reinitialize scanner
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">📱 Volunteer Check-in Scanner</h1>
                        <p className="text-gray-600">Scan team QR codes to check them in</p>
                    </div>

                    {scanning && !scannedTeam && (
                        <div>
                            <div id="qr-reader" className="mb-6"></div>
                            <p className="text-center text-gray-600 text-sm">
                                Position the QR code within the frame to scan
                            </p>
                        </div>
                    )}

                    {scannedTeam && !success && (
                        <div className="space-y-6">
                            <div className={`p-6 rounded-xl border-2 ${alreadyCheckedIn ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-300'
                                }`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{scannedTeam.team_name}</h2>
                                        <p className="text-gray-600">{scannedTeam.city}</p>
                                    </div>
                                    <div>
                                        {alreadyCheckedIn ? (
                                            <span className="px-4 py-2 bg-yellow-200 text-yellow-800 rounded-full font-medium">
                                                Already Checked In
                                            </span>
                                        ) : (
                                            <span className="px-4 py-2 bg-green-200 text-green-800 rounded-full font-medium">
                                                Ready to Check In
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {alreadyCheckedIn && checkedInAt && (
                                    <div className="mb-4 p-3 bg-white rounded-lg">
                                        <p className="text-sm text-gray-700">
                                            <strong>Checked in at:</strong>{' '}
                                            {new Date(checkedInAt).toLocaleString()}
                                        </p>
                                    </div>
                                )}

                                <div className="bg-white rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">Team Members:</h3>
                                    <div className="space-y-2">
                                        {scannedTeam.members?.map((member) => (
                                            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {member.name}
                                                        {member.role === 'leader' && (
                                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                Leader
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-gray-600">{member.email}</p>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <p>T-Shirt: {member.tshirt_size}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-700">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={resetScanner}
                                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
                                >
                                    Cancel
                                </button>
                                {!alreadyCheckedIn && (
                                    <button
                                        onClick={handleConfirmCheckin}
                                        disabled={processing}
                                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 transition"
                                    >
                                        {processing ? 'Checking In...' : 'Confirm Check-in ✓'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-green-600 mb-2">Check-in Successful!</h2>
                                <p className="text-gray-700">{success}</p>
                            </div>
                            <p className="text-sm text-gray-500">Redirecting to scanner...</p>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">📋 Instructions:</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li>1. Ask the team leader to show their team QR code from dashboard</li>
                        <li>2. Scan the QR code using the camera</li>
                        <li>3. Verify team details and member count</li>
                        <li>4. Confirm check-in if everything looks correct</li>
                        <li>5. If already checked in, inform the team and scan next</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
