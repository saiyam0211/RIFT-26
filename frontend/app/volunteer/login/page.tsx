'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { volunteerAuth } from '../../../src/lib/volunteer-auth'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'

interface EventTable {
    id: string
    table_name: string
    table_number: string
    city: string
    capacity: number
    is_active: boolean
}

export default function VolunteerLoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<'credentials' | 'table'>('credentials')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [selectedRole, setSelectedRole] = useState<'scanner' | 'table'>('scanner')
    const [tables, setTables] = useState<EventTable[]>([])
    const [selectedTableId, setSelectedTableId] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        // Fetch available tables when component mounts
        fetchTables()
    }, [])

    const fetchTables = async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/volunteer/tables`)
            setTables(response.data.tables || [])
        } catch (err) {
            console.error('Failed to fetch tables:', err)
        }
    }

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Basic validation
        if (!email || !password) {
            setError('Please enter email and password')
            return
        }

        // Move to table selection
        setStep('table')
    }

    const handleLogin = async () => {
        if (!selectedTableId) {
            setError('Please select a table')
            return
        }

        setError('')
        setLoading(true)

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/volunteer/login`, {
                email,
                password,
                table_id: selectedTableId
            })

            const { token, volunteer } = response.data

            // Store auth data
            volunteerAuth.setAuth(token, volunteer)

            // Redirect based on selected role
            if (selectedRole === 'scanner') {
                router.push('/volunteer/scanner')
            } else if (selectedRole === 'table') {
                router.push('/volunteer/table')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
            setLoading(false)
        }
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

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            <RIFTBackground />

            <div className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 w-full max-w-md backdrop-blur-xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-tan font-bold text-[#c0211f] mb-2">
                        RIFT '26
                    </h1>
                    <p className="text-zinc-400 text-sm">Volunteer Portal</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
                        {error}
                    </div>
                )}

                {step === 'credentials' ? (
                    /* Step 1: Credentials */
                    <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                        <div>
                            <label className="block text-zinc-300 text-sm font-medium mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                                placeholder="volunteer@rift26.com"
                            />
                        </div>

                        <div>
                            <label className="block text-zinc-300 text-sm font-medium mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-zinc-300 text-sm font-medium mb-2">
                                Login As
                            </label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as 'scanner' | 'table')}
                                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all"
                            >
                                <option value="scanner">Scanner (QR Code Scanning)</option>
                                <option value="table">Table Viewer (Data Display)</option>
                            </select>
                            <p className="text-zinc-500 text-xs mt-2">
                                Choose your function for this session
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-[#c0211f] hover:bg-[#a01b1a] text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg"
                        >
                            Continue
                        </button>
                    </form>
                ) : (
                    /* Step 2: Table Selection */
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Select Your Table</h3>
                                <button
                                    onClick={() => setStep('credentials')}
                                    className="text-zinc-400 hover:text-white text-sm"
                                >
                                    ← Back
                                </button>
                            </div>
                            <p className="text-zinc-400 text-sm mb-4">
                                Choose which table you're {selectedRole === 'scanner' ? 'scanning for' : 'viewing'}
                            </p>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {tables.filter(t => t.is_active).map((table) => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTableId(table.id)}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                            selectedTableId === table.id
                                                ? 'bg-red-600/20 border-red-600'
                                                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-white">{table.table_name}</p>
                                                <p className="text-sm text-zinc-400">
                                                    {getCityName(table.city)} • Table #{table.table_number}
                                                </p>
                                            </div>
                                            {selectedTableId === table.id && (
                                                <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {tables.filter(t => t.is_active).length === 0 && (
                                <p className="text-center text-zinc-500 py-8">
                                    No active tables available. Contact admin.
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={loading || !selectedTableId}
                            className="w-full bg-[#c0211f] hover:bg-[#a01b1a] disabled:bg-zinc-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <CustomLoader />
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                'Login'
                            )}
                        </button>
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 text-center text-zinc-500 text-xs">
                    <p>Volunteer credentials are provided by the admin team.</p>
                    <p className="mt-1">Contact support if you need assistance.</p>
                </div>
            </div>
        </div>
    )
}
