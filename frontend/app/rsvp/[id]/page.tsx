'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { Team, RSVPSubmission } from '@/types'
import RIFTBackground from '@/components/RIFTBackground'
import CustomLoader from '@/components/CustomLoader'

const CITIES = [
    { value: 'BLR' as const, label: 'Bangalore' },
    { value: 'PUNE' as const, label: 'Pune' },
    { value: 'NOIDA' as const, label: 'Noida' },
    { value: 'LKO' as const, label: 'Lucknow' },
]

type Step = 'edit_question' | 'edit_members' | 'city_question' | 'city_select' | 'review'

export default function RSVPPage() {
    const router = useRouter()
    const params = useParams()
    const teamId = params.id as string
    const { team: authTeam, isAuthenticated } = useAuthStore()

    const [step, setStep] = useState<Step>('edit_question')
    const [team, setTeam] = useState<Team | null>(null)
    const [city, setCity] = useState<'BLR' | 'PUNE' | 'NOIDA' | 'LKO'>('BLR')
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/')
            return
        }

        if (authTeam?.id !== teamId) {
            setError('Not authorized for this team')
            return
        }

        if (authTeam.rsvp_locked) {
            router.push(`/dashboard/${authTeam.dashboard_token}`)
            return
        }

        setTeam(authTeam)
        
        // Set city to the team's city if it exists, otherwise default to BLR
        if (authTeam.city) {
            const teamCity = authTeam.city.toUpperCase() as 'BLR' | 'PUNE' | 'NOIDA' | 'LKO'
            if (['BLR', 'PUNE', 'NOIDA', 'LKO'].includes(teamCity)) {
                setCity(teamCity)
            }
        }
        
        const sortedMembers = authTeam.members?.map((m) => ({
            id: m.id,
            name: m.name || '',
            email: m.email || '',
            phone: m.phone || '',
            role: m.role || 'member',
        })).sort((a, b) => {
            if (a.role === 'leader') return -1
            if (b.role === 'leader') return 1
            return 0
        }) || []
        setMembers(sortedMembers)
        setLoading(false)
    }, [teamId, authTeam, isAuthenticated, router])

    const getStepInfo = () => {
        // All steps in RSVP are on step 3 (Complete RSVP)
        return { number: 3 }
    }

    const addMember = () => {
        if (members.length >= 4) {
            setError('Maximum 4 members allowed')
            return
        }
        // Generate a valid UUID v4 for new member
        const newUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        setMembers([
            ...members,
            { id: newUUID, name: '', email: '', phone: '', role: 'member' },
        ])
        setError('')
    }

    const removeMember = (index: number) => {
        // Cannot remove team leader (index 0)
        if (index === 0) {
            setError('Cannot remove team leader')
            return
        }
        // Must have at least 2 members
        if (members.length <= 2) {
            setError('Team must have at least 2 members')
            return
        }
        setMembers(members.filter((_, i) => i !== index))
        setError('')
    }

    const handleMemberChange = (index: number, field: string, value: string) => {
        const updated = [...members]
        updated[index] = { ...updated[index], [field]: value }
        setMembers(updated)
    }

    const handleSubmit = async () => {
        setError('')

        // Validation
        for (const member of members) {
            if (!member.name || !member.email || !member.phone) {
                setError('Please fill all member details')
                return
            }
            if (member.phone.length !== 10) {
                setError(`Invalid phone number for ${member.name}`)
                return
            }
            if (!member.email.includes('@')) {
                setError(`Invalid email for ${member.name}`)
                return
            }
        }

        setSubmitting(true)

        try {
            const payload: RSVPSubmission = {
                city,
                members: members.map((m) => ({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    phone: m.phone,
                })),
            }

            await apiClient.put(`/teams/${teamId}/rsvp`, payload)

            const response = await apiClient.get(`/teams/${teamId}`)
            if (response.data.dashboard_token) {
                router.push(`/dashboard/${response.data.dashboard_token}`)
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit RSVP')
            console.error('RSVP Error:', err)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex relative overflow-hidden">
                <RIFTBackground />
                <div className="flex items-center justify-center w-full">
                    <CustomLoader />
                </div>
            </div>
        )
    }

    if (!team) {
        return (
            <div className="min-h-screen flex relative overflow-hidden">
                <RIFTBackground />
                <div className="flex items-center justify-center w-full">
                    <div className="text-center">
                        <p className="text-red-400">{error || 'Team not found'}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
            <RIFTBackground />

            {/* Left Side - Fixed Title and Steps */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center md:mt-0  mt-20 px-28 py-8 lg:ml-20 lg:px-16 lg:py-12 lg:fixed lg:left-0 lg:top-0 lg:h-screen">
                <div className="space-y-8 lg:space-y-12">
                    {/* Title */}
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl sm:text-6xl lg:text-8xl font-tan font-bold text-[#c0211f] mb-2 lg:mb-4">
                            RIFT '26
                        </h1>
                    </div>

                    {/* Steps - Horizontal on Mobile, Vertical on Desktop */}
                    {/* Mobile: Horizontal Stepper */}
                    <div className="lg:hidden flex justify-center">
                        <div className="flex items-center justify-center gap-12 relative w-full">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center z-10">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-[#c0211f] text-white">
                                    1
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap">Search Team</span>
                            </div>


                            {/* Step 2 */}
                            <div className="flex flex-col items-center z-10">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-[#c0211f] text-white">
                                    2
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap">Verify Details</span>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col items-center z-10">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-[#c0211f] text-white scale-110">
                                    3
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap font-semibold">Complete RSVP</span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop: Vertical Steps */}
                    <div className="hidden lg:block space-y-6">
                        <div className="flex items-center gap-4 transition-all duration-300 opacity-50">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl bg-[#c0211f] text-white">
                                1
                            </div>
                            <span className="text-white text-2xl font-medium">Search Team</span>
                        </div>

                        <div className="flex items-center gap-4 transition-all duration-300 opacity-50">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl bg-[#c0211f] text-white">
                                2
                            </div>
                            <span className="text-white text-2xl font-medium">Verify Details</span>
                        </div>

                        <div className="flex items-center gap-4 transition-all duration-300 opacity-100 scale-105">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl bg-[#c0211f] text-white">
                                3
                            </div>
                            <span className="text-white text-2xl font-medium">Complete RSVP/ <br />Open Dashboard</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - RSVP Content */}
            <div className="w-full lg:w-1/2 lg:ml-auto flex items-center justify-center min-h-screen py-8 -mt-80 md:mt-0 lg:py-12">
                <div className="w-full max-w-2xl space-y-6 px-6 lg:px-8">

                    {/* Step 1: Edit Members Question */}
                    {step === 'edit_question' && (
                        <>
                            <div className="text-center space-y-6">
                                <h2 className="text-white text-3xl font-semibold">
                                    Do you want to edit team members?
                                </h2>
                                <p className="text-gray-400">
                                    Current members: {members.length} (2-4 members allowed)
                                </p>
                                <p className="text-gray-500 text-sm">
                                    You can add new members, remove members, or update contact details
                                </p>

                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <button
                                        onClick={() => setStep('edit_members')}
                                        className="py-4 px-6 cursor-pointer bg-[#c0211f] text-white rounded-lg font-semibold text-lg hover:bg-[#a01a17] transition-all"
                                    >
                                        Yes, Edit Members
                                    </button>
                                    <button
                                        onClick={() => setStep('city_question')}
                                        className="py-4 cursor-pointer px-6 bg-white/10 text-gray-300 rounded-lg font-semibold text-lg hover:bg-white/20 transition-all"
                                    >
                                        No, Keep Current
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 2: Edit Members Form */}
                    {step === 'edit_members' && (
                        <div className="mt-72 md:mt-0 space-y-6">
                            <button
                                onClick={() => {
                                    setError('')
                                    setStep('edit_question')
                                }}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <h2 className="text-white text-2xl font-semibold">Edit Team Members</h2>
                            
                            <div className="bg-blue-500/20 border border-blue-500/50 p-4 rounded-lg">
                                <p className="text-blue-200 text-sm">
                                    ℹ️ Team leader details (name, email, phone) are locked and cannot be changed. You can add/remove other members and update their contact details.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {members.map((member, index) => (
                                    <div key={member.id} className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-white font-medium">
                                                {index === 0 ? '👑 Team Leader' : `Member ${index + 1}`}
                                            </h3>
                                            {index > 0 && (
                                                <button
                                                    onClick={() => removeMember(index)}
                                                    className="text-red-400 cursor-pointer hover:text-red-300 text-sm flex items-center gap-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="input-container">
                                            <input
                                                type="text"
                                                value={member.name}
                                                onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                                                placeholder="Full Name"
                                                disabled={index === 0}
                                                className={index === 0 ? 'cursor-not-allowed opacity-60' : ''}
                                            />
                                        </div>

                                        <div className="input-container">
                                            <input
                                                type="email"
                                                value={member.email}
                                                onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                                                placeholder="Email Address"
                                                disabled={index === 0}
                                                className={index === 0 ? 'cursor-not-allowed opacity-60' : ''}
                                            />
                                        </div>

                                        <div className="input-container">
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                value={member.phone}
                                                onChange={(e) => handleMemberChange(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                placeholder="Phone Number (10 digits)"
                                                maxLength={10}
                                                disabled={index === 0}
                                                className={index === 0 ? 'cursor-not-allowed opacity-60' : ''}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {members.length < 4 && (
                                    <button
                                        onClick={addMember}
                                        className="w-full cursor-pointer py-3 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition font-medium flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Add Member ({members.length}/4)
                                    </button>
                                )}
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setError('')
                                    // Validate all members have complete information
                                    for (const member of members) {
                                        if (!member.name || !member.email || !member.phone) {
                                            setError('Please fill all member details before proceeding')
                                            return
                                        }
                                        if (member.phone.length !== 10) {
                                            setError(`Phone number must be exactly 10 digits for ${member.name}`)
                                            return
                                        }
                                        if (!member.email.includes('@')) {
                                            setError(`Invalid email format for ${member.name}`)
                                            return
                                        }
                                    }
                                    if (members.length < 2) {
                                        setError('Team must have at least 2 members')
                                        return
                                    }
                                    if (members.length > 4) {
                                        setError('Team cannot have more than 4 members')
                                        return
                                    }
                                    setStep('city_question')
                                }}
                                className="w-full bg-[#c0211f] cursor-pointer text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all"
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* Step 3: City Change Question */}
                    {step === 'city_question' && (
                        <>
                            <button
                                onClick={() => setStep('edit_question')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <div className="space-y-6">
                                <h2 className="text-white text-2xl font-semibold text-center">
                                    Do you want to change the city?
                                </h2>
                                <p className="text-gray-400 text-center">
                                    Currently selected: <span className="font-semibold text-white">{CITIES.find(c => c.value === city)?.label}</span>
                                </p>

                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <button
                                        onClick={() => setStep('city_select')}
                                        className="py-4 px-6 cursor-pointer bg-[#c0211f] text-white rounded-lg font-semibold text-lg hover:bg-[#a01a17] transition-all"
                                    >
                                        Yes, Change City
                                    </button>
                                    <button
                                        onClick={() => setStep('review')}
                                        className="py-4 cursor-pointer px-6 bg-white/10 text-gray-300 rounded-lg font-semibold text-lg hover:bg-white/20 transition-all"
                                    >
                                        No, Keep Current
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 4: City Selection */}
                    {step === 'city_select' && (
                        <>
                            <button
                                onClick={() => setStep('city_question')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <div className="space-y-6">
                                <h2 className="text-white text-2xl font-semibold text-center">
                                    Select City Venue
                                </h2>

                                <div className="grid grid-cols-2 gap-4">
                                    {CITIES.map((c) => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setCity(c.value)}
                                            className={`py-4 px-4 rounded-lg font-semibold text-lg transition cursor-pointer ${city === c.value
                                                ? 'bg-[#c0211f] text-white'
                                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                }`}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setStep('review')}
                                    className="w-full bg-[#c0211f] cursor-pointer text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all"
                                >
                                    Continue to Review
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 4: Review */}
                    {step === 'review' && (
                        <div className='mt-72 md:mt-0 space-y-6'>
                            <button
                                onClick={() => setStep('city_question')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <h2 className="text-white text-2xl font-semibold">Review Your RSVP</h2>

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* City */}
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h3 className="text-gray-400 text-sm mb-2">City</h3>
                                    <p className="text-white font-semibold text-lg">{CITIES.find(c => c.value === city)?.label}</p>
                                </div>

                                {/* Team Members */}
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h3 className="text-gray-400 text-sm mb-3">Team Members ({members.length})</h3>
                                    <div className="space-y-3">
                                        {members.map((member, index) => (
                                            <div key={member.id} className="p-3 bg-white/5 rounded">
                                                <p className="text-white font-medium">
                                                    {member.name} {index === 0 && '(Leader)'}
                                                </p>
                                                <p className="text-gray-400 text-sm">{member.email}</p>
                                                <p className="text-gray-400 text-sm">{member.phone}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-lg">
                                <p className="text-yellow-200 text-sm">
                                    ⚠️ Once submitted, your RSVP will be locked and cannot be changed
                                </p>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-[#c0211f] cursor-pointer text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Submitting...' : 'Confirm RSVP & Lock'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
