'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Team } from '../../../src/types/admin';

interface CityStats {
    city: string;
    teamCount: number;
    totalParticipants: number;
    rsvpCount: number;
    checkedInCount: number;
    teamSizeBreakdown: { [key: number]: number };
}

export default function TeamsPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState({ 
        status: '', 
        city: '', 
        rsvpStatus: '', 
        teamSize: '',
        checkedIn: '' 
    });
    const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
    const [cityStats, setCityStats] = useState<CityStats[]>([]);

    useEffect(() => {
        fetchTeams();
    }, []);

    useEffect(() => {
        calculateCityStats();
    }, [teams]);

    const fetchTeams = async () => {
        try {
            const token = getAdminToken();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/teams`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            setTeams(data.teams || []);
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateCityStats = () => {
        const statsMap = new Map<string, CityStats>();
        
        teams.forEach(team => {
            const city = team.city || 'Unknown';
            const memberCount = team.members?.length || 0;
            
            if (!statsMap.has(city)) {
                statsMap.set(city, {
                    city,
                    teamCount: 0,
                    totalParticipants: 0,
                    rsvpCount: 0,
                    checkedInCount: 0,
                    teamSizeBreakdown: {}
                });
            }
            
            const stats = statsMap.get(city)!;
            stats.teamCount++;
            stats.totalParticipants += memberCount;
            if (team.rsvp_locked) stats.rsvpCount++;
            if (team.checked_in) stats.checkedInCount++;
            stats.teamSizeBreakdown[memberCount] = (stats.teamSizeBreakdown[memberCount] || 0) + 1;
        });
        
        setCityStats(Array.from(statsMap.values()).sort((a, b) => b.totalParticipants - a.totalParticipants));
    };

    const filteredTeams = teams.filter(team => {
        const matchesSearch = !searchQuery || 
            team.team_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.members?.some(m => m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                   m.email?.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesStatus = !filter.status || team.status === filter.status;
        
        const matchesCity = !filter.city || team.city === filter.city;
        
        const matchesRsvp = !filter.rsvpStatus || 
            (filter.rsvpStatus === 'completed' && team.rsvp_locked) ||
            (filter.rsvpStatus === 'pending' && !team.rsvp_locked);
        
        const matchesSize = !filter.teamSize || 
            (team.members?.length || 0).toString() === filter.teamSize;
        
        const matchesCheckedIn = !filter.checkedIn ||
            (filter.checkedIn === 'yes' && team.checked_in) ||
            (filter.checkedIn === 'no' && !team.checked_in);
        
        return matchesSearch && matchesStatus && matchesCity && matchesRsvp && matchesSize && matchesCheckedIn;
    });

    const uniqueCities = [...new Set(teams.map(t => t.city).filter(Boolean))].sort();

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Teams Management</h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/organisersdashboard/teams/add')}
                        className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Team Manually
                    </button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-6 py-2 rounded-lg transition-all ${
                            viewMode === 'list' 
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        📋 List View
                    </button>
                    <button
                        onClick={() => setViewMode('stats')}
                        className={`px-6 py-2 rounded-lg transition-all ${
                            viewMode === 'stats' 
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        📊 Statistics View
                    </button>
                </div>
            </div>

            {viewMode === 'stats' ? (
                <div className="space-y-6">
                    {/* Overall Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
                            <div className="text-4xl font-bold">{teams.length}</div>
                            <div className="text-blue-100 mt-2">Total Teams</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
                            <div className="text-4xl font-bold">
                                {teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                            </div>
                            <div className="text-green-100 mt-2">Total Participants</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
                            <div className="text-4xl font-bold">
                                {teams.filter(t => t.rsvp_locked).length}
                            </div>
                            <div className="text-purple-100 mt-2">RSVP Completed</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
                            <div className="text-4xl font-bold">{uniqueCities.length}</div>
                            <div className="text-orange-100 mt-2">Cities</div>
                        </div>
                    </div>

                    {/* City-wise Statistics */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">City-wise Statistics</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">City</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Teams</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Total Participants</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">RSVP Done</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Checked In</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Team Size Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {cityStats.map((stat, idx) => (
                                        <tr key={stat.city} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-6 py-4 font-semibold text-gray-900">{stat.city}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                                                    {stat.teamCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                                                    {stat.totalParticipants}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                                                    {stat.rsvpCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-semibold">
                                                    {stat.checkedInCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 justify-center flex-wrap">
                                                    {Object.entries(stat.teamSizeBreakdown)
                                                        .sort(([a], [b]) => Number(a) - Number(b))
                                                        .map(([size, count]) => (
                                                            <span key={size} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                                                {size}👥: {count}
                                                            </span>
                                                        ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Team Size Distribution */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Overall Team Size Distribution</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[2, 3, 4].map(size => {
                                const count = teams.filter(t => (t.members?.length || 0) === size).length;
                                return (
                                    <div key={size} className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg p-6 text-center shadow-lg">
                                        <div className="text-3xl font-bold">{count}</div>
                                        <div className="text-indigo-100 mt-2">{size} Members</div>
                                    </div>
                                );
                            })}
                            <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-lg p-6 text-center shadow-lg">
                                <div className="text-3xl font-bold">
                                    {teams.filter(t => (t.members?.length || 0) > 4 || (t.members?.length || 0) < 2).length}
                                </div>
                                <div className="text-pink-100 mt-2">Other Sizes</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Search & Filters */}
                    <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="🔍 Search by team name, member name, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Filter Options */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <select
                                value={filter.status}
                                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">All Status</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                            </select>

                            <select
                                value={filter.city}
                                onChange={(e) => setFilter({ ...filter, city: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">All Cities</option>
                                {uniqueCities.map(city => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>

                            <select
                                value={filter.rsvpStatus}
                                onChange={(e) => setFilter({ ...filter, rsvpStatus: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">RSVP Status</option>
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                            </select>

                            <select
                                value={filter.teamSize}
                                onChange={(e) => setFilter({ ...filter, teamSize: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">Team Size</option>
                                <option value="2">2 Members</option>
                                <option value="3">3 Members</option>
                                <option value="4">4 Members</option>
                            </select>

                            <select
                                value={filter.checkedIn}
                                onChange={(e) => setFilter({ ...filter, checkedIn: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">Check-in Status</option>
                                <option value="yes">Checked In</option>
                                <option value="no">Not Checked In</option>
                            </select>
                        </div>

                        {/* Active Filters Display */}
                        {(searchQuery || filter.status || filter.city || filter.rsvpStatus || filter.teamSize || filter.checkedIn) && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                <span className="text-sm text-gray-600">Active filters:</span>
                                {searchQuery && (
                                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                        Search: "{searchQuery}"
                                        <button onClick={() => setSearchQuery('')} className="hover:text-purple-900">×</button>
                                    </span>
                                )}
                                {Object.entries(filter).map(([key, value]) => value && (
                                    <span key={key} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                        {key}: {value}
                                        <button onClick={() => setFilter({ ...filter, [key]: '' })} className="hover:text-blue-900">×</button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilter({ status: '', city: '', rsvpStatus: '', teamSize: '', checkedIn: '' });
                                    }}
                                    className="text-sm text-red-600 hover:text-red-800 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading teams...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                                Team Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                                Leader
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                Members
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                RSVP
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                Checked In
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredTeams.map((team, idx) => (
                                            <tr key={team.id} className={`hover:bg-purple-50 transition-colors ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">{team.team_name}</div>
                                                    {team.city && (
                                                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {team.city}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {team.members?.find(m => m.role === 'leader') && (
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {team.members.find(m => m.role === 'leader')?.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {team.members.find(m => m.role === 'leader')?.email}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                        team.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                        team.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {team.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                                                        {team.members?.length || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {team.rsvp_locked ? (
                                                        <span className="text-green-600 text-xl">✅</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xl">⏳</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {team.checked_in ? (
                                                        <span className="text-green-600 text-xl">✅</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xl">❌</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredTeams.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-lg font-medium">No teams found</p>
                                        <p className="text-sm mt-2">Try adjusting your filters or search query</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    Showing <span className="font-semibold text-gray-900">{filteredTeams.length}</span> of{' '}
                                    <span className="font-semibold text-gray-900">{teams.length}</span> teams
                                </div>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-gray-600">
                                        Total Participants: <span className="font-semibold text-gray-900">
                                            {filteredTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
