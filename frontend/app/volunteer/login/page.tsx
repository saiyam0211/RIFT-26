'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { volunteerAuth } from '../../../src/lib/volunteer-auth'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'

export default function VolunteerLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [selectedRole, setSelectedRole] = useState<'scanner' | 'table'>('scanner')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/volunteer/login`, {
                email,
                password
            })

            const { token, volunteer } = response.data

            // Store auth data
            volunteerAuth.setAuth(token, volunteer)

            // Redirect based on selected role
            // Two people can use same email: one as scanner, one as table viewer
            if (selectedRole === 'scanner') {
                router.push('/volunteer/scanner')
            } else if (selectedRole === 'table') {
                router.push('/volunteer/table')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
        } finally {
            setLoading(false)
        }
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

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

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
                        disabled={loading}
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
                </form>

                {/* Info */}
                <div className="mt-6 text-center text-zinc-500 text-xs">
                    <p>Volunteer credentials are provided by the admin team.</p>
                    <p className="mt-1">Contact support if you need assistance.</p>
                </div>
            </div>
        </div>
    )
}
