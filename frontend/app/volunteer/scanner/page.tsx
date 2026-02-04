'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import apiClient from '@/lib/api-client'
import { Team } from '@/types'
import { useRouter } from 'next/navigation'

export default function VolunteerScannerPage() {
    const router = useRouter()
    const [scannedTeam, setScannedTeam] = useState<Team | null>(null)
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
    const [checkedInAt, setCheckedInAt] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [scanning, setScanning] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)

    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/admin/login')
            return
        }

        // Initialize QR scanner only when scanning is true
        if (scanning && !scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                'qr-reader',
                { 
                    fps: 10, 
                    qrbox: { width: 300, height: 300 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true,
                },
                false
            )

            scanner.render(onScanSuccess, onScanError)
            scannerRef.current = scanner
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error)
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
            // Send QR data to backend
            const response = await apiClient.post('/checkin/scan', {
                qr_data: decodedText,
            })

            setScannedTeam(response.data.team)
            setAlreadyCheckedIn(response.data.already_checked_in || false)
            setCheckedInAt(response.data.checked_in_at)
            setScanning(false)
            
            // Update total scanned count
            setStats(prev => ({ ...prev, total: prev.total + 1 }))
            
            // Clear scanner
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error)
                scannerRef.current = null
            }
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
            
            // Update stats
            setStats(prev => ({
                total: prev.total + 1,
                checkedIn: prev.checkedIn + 1
            }))

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
        setProcessing(false)
        
        // Clear existing scanner
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error)
            scannerRef.current = null
        }
        
        // Re-enable scanning which will trigger useEffect to reinitialize
        setScanning(true)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header with Stats */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                        <p className="text-white/70 text-sm mb-1">Total Scanned</p>
                        <p className="text-3xl font-bold text-white">{stats.total}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                        <p className="text-white/70 text-sm mb-1">Checked In</p>
                        <p className="text-3xl font-bold text-green-400">{stats.checkedIn}</p>
                    </div>
                </div>

                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
                    <div className="text-center mb-8">
                        <div className="inline-block p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl mb-4">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                            Volunteer Check-in Scanner
                        </h1>
                        <p className="text-gray-600">Scan team QR codes to check them in</p>
                    </div>

                    {scanning && !scannedTeam && (
                        <div>
                            <div id="qr-reader" className="mb-6 rounded-xl overflow-hidden"></div>
                            <div className="text-center space-y-2">
                                <p className="text-gray-600 text-sm font-medium">
                                    📸 Position the QR code within the frame to scan
                                </p>
                                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span>Scanner Active</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {scannedTeam && !success && (
                        <div className="space-y-6 animate-fade-in">
                            <div className={`p-6 rounded-xl border-2 shadow-lg transition-all ${
                                alreadyCheckedIn 
                                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400' 
                                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400'
                                }`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-1">{scannedTeam.team_name}</h2>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span>{scannedTeam.city}</span>
                                        </div>
                                    </div>
                                    <div>
                                        {alreadyCheckedIn ? (
                                            <span className="px-4 py-2 bg-yellow-500 text-white rounded-full font-medium shadow-md flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Already Checked In
                                            </span>
                                        ) : (
                                            <span className="px-4 py-2 bg-green-500 text-white rounded-full font-medium shadow-md flex items-center gap-2 animate-pulse">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
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
                                    className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-4 rounded-xl font-semibold hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Cancel
                                    </span>
                                </button>
                                {!alreadyCheckedIn && (
                                    <button
                                        onClick={handleConfirmCheckin}
                                        disabled={processing}
                                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            {processing ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Checking In...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Confirm Check-in
                                                </>
                                            )}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="text-center space-y-6 animate-fade-in">
                            <div className="relative">
                                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                                    <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div className="absolute inset-0 w-24 h-24 bg-green-400 rounded-full mx-auto animate-ping opacity-20"></div>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">
                                    Check-in Successful!
                                </h2>
                                <p className="text-gray-700 text-lg font-medium">{success}</p>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span>Preparing scanner...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="mt-6 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg p-6 border border-white/20">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Quick Guide</h3>
                    </div>
                    <ul className="space-y-3 text-sm text-gray-700">
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-xs">1</span>
                            <span>Ask the team leader to show their team QR code from dashboard</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-xs">2</span>
                            <span>Scan the QR code using the camera</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-xs">3</span>
                            <span>Verify team details and member count</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-xs">4</span>
                            <span>Confirm check-in if everything looks correct</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-xs">5</span>
                            <span>If already checked in, inform the team and scan next</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
