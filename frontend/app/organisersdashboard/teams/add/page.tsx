'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../../../../src/lib/admin-auth';

interface TeamMember {
    name: string;
    email: string;
    phone: string;
    role: 'leader' | 'member';
}

export default function AddTeamManually() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [teamName, setTeamName] = useState('');
    const [city, setCity] = useState<string>('');
    const [rsvpCompleted, setRsvpCompleted] = useState(false);
    const [members, setMembers] = useState<TeamMember[]>([
        { name: '', email: '', phone: '', role: 'leader' },
        { name: '', email: '', phone: '', role: 'member' }
    ]);

    const cities = ['Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Other'];

    const addMember = () => {
        if (members.length >= 4) {
            setError('Maximum 4 members allowed per team');
            return;
        }
        setMembers([...members, { name: '', email: '', phone: '', role: 'member' }]);
    };

    const removeMember = (index: number) => {
        if (index === 0) {
            setError('Cannot remove team leader');
            return;
        }
        if (members.length <= 2) {
            setError('Minimum 2 members required');
            return;
        }
        setMembers(members.filter((_, i) => i !== index));
    };

    const updateMember = (index: number, field: keyof TeamMember, value: string) => {
        const updated = [...members];
        updated[index] = { ...updated[index], [field]: value };
        setMembers(updated);
    };

    const validateForm = () => {
        if (!teamName.trim()) {
            setError('Team name is required');
            return false;
        }

        if (rsvpCompleted && !city) {
            setError('City is required for teams with completed RSVP');
            return false;
        }

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            if (!member.name.trim()) {
                setError(`Member ${i + 1} name is required`);
                return false;
            }
            if (!member.email.trim()) {
                setError(`Member ${i + 1} email is required`);
                return false;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
                setError(`Member ${i + 1} email is invalid`);
                return false;
            }
            if (!member.phone.trim()) {
                setError(`Member ${i + 1} phone is required`);
                return false;
            }
            if (!/^\d{10}$/.test(member.phone.replace(/\D/g, ''))) {
                setError(`Member ${i + 1} phone must be 10 digits`);
                return false;
            }
        }

        // Check for duplicate emails
        const emails = members.map(m => m.email.toLowerCase());
        if (new Set(emails).size !== emails.length) {
            setError('Duplicate emails found in team members');
            return false;
        }

        // Check for duplicate phones
        const phones = members.map(m => m.phone);
        if (new Set(phones).size !== phones.length) {
            setError('Duplicate phone numbers found in team members');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const token = getAdminToken();
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

            // Prepare request body
            const requestBody = {
                team_name: teamName,
                city: rsvpCompleted ? city : '',
                rsvp_completed: rsvpCompleted,
                members: members.map(member => ({
                    name: member.name,
                    email: member.email,
                    phone: member.phone,
                    role: member.role
                }))
            };

            const response = await fetch(`${apiUrl}/admin/teams/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add team');
            }

            const successMsg = rsvpCompleted
                ? `Team "${teamName}" created successfully with RSVP completed! They can now access the dashboard.`
                : `Team "${teamName}" created successfully! They can now complete their RSVP.`;

            setSuccess(successMsg);

            // Reset form after 2 seconds
            setTimeout(() => {
                router.push('/organisersdashboard/teams');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to add team');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="text-red-500 hover:text-red-400 flex items-center gap-2 mb-4"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Teams
                </button>
                <h1 className="text-3xl font-bold text-white">Add Team Manually</h1>
                <p className="text-zinc-400 mt-2">Create a new team by filling in the details below</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Success Message */}
                {success && (
                    <div className="bg-green-950/30 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg flex items-start gap-2">
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="bg-red-950/30 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Team Details */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-white">Team Information</h2>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Team Name *
                        </label>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            placeholder="Enter team name"
                            required
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="rsvpCompleted"
                            checked={rsvpCompleted}
                            onChange={(e) => setRsvpCompleted(e.target.checked)}
                            className="w-4 h-4 text-red-600 border-zinc-700 rounded focus:ring-red-500"
                        />
                        <label htmlFor="rsvpCompleted" className="text-sm font-medium text-zinc-300">
                            Mark RSVP as completed (team can participate directly)
                        </label>
                    </div>

                    {rsvpCompleted && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                City *
                            </label>
                            <select
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                required={rsvpCompleted}
                            >
                                <option value="">Select City</option>
                                {cities.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Team Members */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white">Team Members ({members.length}/4)</h2>
                        {members.length < 4 && (
                            <button
                                type="button"
                                onClick={addMember}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Member
                            </button>
                        )}
                    </div>

                    {members.map((member, index) => (
                        <div key={index} className="p-4 border-2 border-zinc-800 rounded-lg space-y-3 relative">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-white">
                                    {index === 0 ? 'Team Leader' : `Member ${index + 1}`}
                                </h3>
                                {index > 0 && members.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => removeMember(index)}
                                        className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Remove
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={member.name}
                                        onChange={(e) => updateMember(index, 'name', e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                        placeholder="Enter full name"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        value={member.email}
                                        onChange={(e) => updateMember(index, 'email', e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                        placeholder="email@example.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={member.phone}
                                        onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '');
                                            updateMember(index, 'phone', cleaned.slice(0, 10));
                                        }}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                                        placeholder="9876543210"
                                        maxLength={10}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="bg-blue-950/30 border border-blue-800/50 p-4 rounded-lg">
                        <p className="text-sm text-blue-300">
                            ℹ️ Teams must have 2-4 members. The first member is automatically designated as the team leader.
                        </p>
                    </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 px-6 py-3 border-2 border-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-900 transition-all font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-red-600/30"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Adding Team...
                            </span>
                        ) : (
                            'Add Team'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
