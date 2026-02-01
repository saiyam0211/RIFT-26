'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import axios from 'axios'
import { useAuthStore } from '@/store/auth-store'

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier
    }
}

interface TeamMember {
    name: string;
    email: string;
    phone: string;
    user_type: string;
}

interface Team {
    id: string;
    team_id: string;
    team_name: string;
    city: string;
    members: TeamMember[];
    member_count: number;
    masked_phone: string;
    status?: string;
}

export default function HomePage() {
    const router = useRouter()
    const [step, setStep] = useState<'search' | 'otp' | 'verifying'>('search')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [suggestions, setSuggestions] = useState<Team[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState<any>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [otpCode, setOTPCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
    const { setAuth } = useAuthStore()

    // Fetch suggestions as user types
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (searchQuery.trim().length < 2) {
                setSuggestions([])
                setShowSuggestions(false)
                return
            }

            try {
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/search`, {
                    params: { query: searchQuery, limit: 5 },
                })
                setSuggestions(response.data.teams || [])
                setShowSuggestions(true)
            } catch (err) {
                console.error('Error fetching suggestions:', err)
                setSuggestions([])
            }
        }

        const debounceTimer = setTimeout(fetchSuggestions, 300)
        return () => clearTimeout(debounceTimer)
    }, [searchQuery])

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            })
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return
        setLoading(true)
        setError('')
        setShowSuggestions(false)

        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/search`, {
                params: { query: searchQuery },
            })
            setSearchResults(response.data.teams || [])
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to search teams')
        } finally {
            setLoading(false)
        }
    }

    const handleTeamSelect = (team: any) => {
        setSelectedTeam(team)
        setPhoneNumber('')
        setSearchQuery(team.team_name)
        setShowSuggestions(false)
        setStep('otp')
    }

    const handleSuggestionClick = (team: Team) => {
        handleTeamSelect(team)
    }

    const handleSendOTP = async () => {
        if (!phoneNumber || phoneNumber.length !== 10) {
            setError('Please enter a valid 10-digit phone number')
            return
        }

        setLoading(true)
        setError('')

        try {
            setupRecaptcha()
            const formattedPhone = `+91${phoneNumber}`
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier)
            setConfirmationResult(confirmation)
            setStep('verifying')
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP')
            console.error('OTP Send Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setError('Please enter a valid 6-digit OTP')
            return
        }

        if (!confirmationResult) {
            setError('Please request OTP first')
            return
        }

        setLoading(true)
        setError('')

        try {
            // Verify OTP with Firebase
            const result = await confirmationResult.confirm(otpCode)
            const idToken = await result.user.getIdToken()

            // Send to backend for verification and JWT generation
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-firebase`, {
                id_token: idToken,
                team_id: selectedTeam.id,
            })

            // Save auth data
            setAuth(response.data.token, response.data.team)

            // Redirect based on RSVP status
            if (response.data.team.rsvp_locked) {
                router.push(`/dashboard/${response.data.team.dashboard_token}`)
            } else {
                router.push(`/rsvp/${response.data.team.id}`)
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to verify OTP')
            console.error('OTP Verification Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const getLeader = (team: Team) => {
        return team.members?.find(m => m.user_type === 'leader') || team.members?.[0]
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-indigo-600 mb-2">RIFT '26</h1>
                    <p className="text-gray-600">Hackathon Registration</p>
                </div>

                {step === 'search' && (
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search Your Team
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                onFocus={() => searchQuery.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                                placeholder="Enter team name..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                autoComplete="off"
                            />

                            {/* Autocomplete Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                                    {suggestions.map((team) => (
                                        <div
                                            key={team.id}
                                            onClick={() => handleSuggestionClick(team)}
                                            className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-900">{team.team_name}</div>
                                                    {team.leader_name && (
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            <span className="font-medium">Leader:</span> {team.leader_name}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {team.city} • {team.member_count || 0} members
                                                    </div>
                                                </div>
                                                {team.status && (
                                                    <div className="ml-4">
                                                        <span className={`px-2 py-1 text-xs rounded-full ${team.status === 'confirmed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : team.status === 'shortlisted'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {team.status}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* No suggestions found */}
                            {showSuggestions && suggestions.length === 0 && searchQuery.length >= 2 && !loading && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                                    No teams found
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSearch}
                            disabled={loading || !searchQuery.trim()}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Searching...' : 'Search Team'}
                        </button>

                        {searchResults.length > 0 && (
                            <div className="mt-6 space-y-2">
                                <p className="text-sm font-medium text-gray-700">Select your team:</p>
                                {searchResults.map((team) => (
                                    <button
                                        key={team.id}
                                        onClick={() => handleTeamSelect(team)}
                                        className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition"
                                    >
                                        <p className="font-medium text-gray-900">{team.team_name}</p>
                                        <p className="text-sm text-gray-600">{team.masked_phone}</p>
                                        <p className="text-xs text-gray-500">
                                            {team.city || 'No city selected'} • {team.member_count} members
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {step === 'otp' && selectedTeam && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setStep('search'); setSelectedTeam(null); setShowSuggestions(false); }}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                        >
                            ← Back to search
                        </button>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                            <p className="font-medium text-gray-900">{selectedTeam.team_name}</p>
                            <p className="text-sm text-gray-600">{selectedTeam.masked_phone}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Team Leader's Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10-digit phone number"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                maxLength={10}
                            />
                        </div>
                        <button
                            onClick={handleSendOTP}
                            disabled={loading || phoneNumber.length !== 10}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                    </div>
                )}

                {step === 'verifying' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setStep('otp')}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                        >
                            ← Back
                        </button>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-green-700">
                                OTP sent to +91{phoneNumber}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Enter OTP
                            </label>
                            <input
                                type="text"
                                value={otpCode}
                                onChange={(e) => setOTPCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit OTP"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest"
                                maxLength={6}
                            />
                        </div>
                        <button
                            onClick={handleVerifyOTP}
                            disabled={loading || otpCode.length !== 6}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Verifying...' : 'Verify & Continue'}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <div id="recaptcha-container"></div>
            </div>
        </div>
    )
}
