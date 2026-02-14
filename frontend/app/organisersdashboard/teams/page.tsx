'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Team } from '../../../src/types/admin';

interface CityStats {
    city: string;
    teamCount: number;
    totalParticipants: number;
    rsvpParticipants: number;
    rsvpCount: number;
    rsvp2Participants: number;
    rsvp2Count: number;
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
    const [currentPage, setCurrentPage] = useState(1);
    const teamsPerPage = 7;

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
                    rsvpParticipants: 0,
                    rsvpCount: 0,
                    rsvp2Participants: 0,
                    rsvp2Count: 0,
                    checkedInCount: 0,
                    teamSizeBreakdown: {}
                });
            }
            
            const stats = statsMap.get(city)!;
            stats.teamCount++;
            stats.totalParticipants += memberCount;
            if (team.rsvp_locked) {
                stats.rsvpCount++;
                stats.rsvpParticipants += memberCount;
            }
            if (team.status === 'rsvp2_done') {
                stats.rsvp2Count++;
                stats.rsvp2Participants += memberCount;
                // Team size breakdown based on RSVP II selected members (actual attending members)
                stats.teamSizeBreakdown[memberCount] = (stats.teamSizeBreakdown[memberCount] || 0) + 1;
            }
            if (team.checked_in) stats.checkedInCount++;
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
            (filter.rsvpStatus === 'rsvp1_completed' && team.rsvp_locked) ||
            (filter.rsvpStatus === 'rsvp2_completed' && team.status === 'rsvp2_done') ||
            (filter.rsvpStatus === 'pending' && !team.rsvp_locked);
        
        const matchesSize = !filter.teamSize || 
            (team.members?.length || 0).toString() === filter.teamSize;
        
        const matchesCheckedIn = !filter.checkedIn ||
            (filter.checkedIn === 'yes' && team.checked_in) ||
            (filter.checkedIn === 'no' && !team.checked_in);
        
        return matchesSearch && matchesStatus && matchesCity && matchesRsvp && matchesSize && matchesCheckedIn;
    });

    const uniqueCities = [...new Set(teams.map(t => t.city).filter(Boolean))].sort();

    // Pagination logic
    const totalPages = Math.ceil(filteredTeams.length / teamsPerPage);
    const startIndex = (currentPage - 1) * teamsPerPage;
    const endIndex = startIndex + teamsPerPage;
    const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filter]);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const downloadCSV = () => {
        // Use filtered teams for download
        const dataToExport = filteredTeams;
        
        if (dataToExport.length === 0) {
            alert('No teams to export with current filters');
            return;
        }

        // Create CSV header
        const headers = [
            'Team Name',
            'City',
            'Status',
            'RSVP Status',
            'Checked In',
            'Member Count',
            'Leader Name',
            'Leader Email',
            'Leader Phone',
            'Member 2 Name',
            'Member 2 Email',
            'Member 2 Phone',
            'Member 3 Name',
            'Member 3 Email',
            'Member 3 Phone',
            'Member 4 Name',
            'Member 4 Email',
            'Member 4 Phone',
            'Created At'
        ];

        // Create CSV rows
        const rows = dataToExport.map(team => {
            const leader = team.members?.find(m => m.role === 'leader');
            const otherMembers = team.members?.filter(m => m.role !== 'leader') || [];
            
            return [
                team.team_name || '',
                team.city || '',
                team.status || '',
                team.rsvp_locked ? 'Completed' : 'Pending',
                team.checked_in ? 'Yes' : 'No',
                team.members?.length || 0,
                leader?.name || '',
                leader?.email || '',
                leader?.phone || '',
                otherMembers[0]?.name || '',
                otherMembers[0]?.email || '',
                otherMembers[0]?.phone || '',
                otherMembers[1]?.name || '',
                otherMembers[1]?.email || '',
                otherMembers[1]?.phone || '',
                otherMembers[2]?.name || '',
                otherMembers[2]?.email || '',
                otherMembers[2]?.phone || '',
                team.created_at || ''
            ];
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filterSuffix = Object.values(filter).some(v => v) || searchQuery ? '_filtered' : '';
        
        link.setAttribute('href', url);
        link.setAttribute('download', `teams_export_${timestamp}${filterSuffix}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Teams Management</h1>
                <div className="flex gap-3">
                    <button
                        onClick={downloadCSV}
                        className="bg-zinc-900 border border-zinc-800 text-white px-6 py-2 rounded-lg hover:bg-zinc-800 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download CSV
                    </button>
                    <button
                        onClick={() => router.push('/organisersdashboard/teams/add')}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Team Manually
                    </button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-6 py-2 rounded-lg transition-all ${
                            viewMode === 'list' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                    >
                        List View
                    </button>
                    <button
                        onClick={() => setViewMode('stats')}
                        className={`px-6 py-2 rounded-lg transition-all ${
                            viewMode === 'stats' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                    >
                        Statistics View
                    </button>
                </div>
            </div>

            {viewMode === 'stats' ? (
                <div className="space-y-6">
                    {/* Overall Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                            <div className="text-4xl font-bold">{teams.length}</div>
                            <div className="text-zinc-400 mt-2">Total Teams</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                            <div className="text-4xl font-bold">
                                {teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                            </div>
                            <div className="text-zinc-400 mt-2">Total Participants</div>
                        </div>
                        <div className="bg-red-600 text-white rounded-lg p-6">
                            <div className="text-4xl font-bold">
                                {teams.filter(t => t.rsvp_locked).length}
                            </div>
                            <div className="text-red-100 mt-2">RSVP I Completed</div>
                        </div>
                        <div className="bg-blue-600 text-white rounded-lg p-6">
                            <div className="text-4xl font-bold">
                                {teams.filter(t => t.status === 'rsvp2_done').length}
                            </div>
                            <div className="text-blue-100 mt-2">RSVP II Completed</div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                            <div className="text-4xl font-bold">{uniqueCities.length}</div>
                            <div className="text-zinc-400 mt-2">Cities</div>
                        </div>
                    </div>

                    {/* City-wise Statistics */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-white mb-6">City-wise Statistics</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-red-600 text-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">City</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Teams</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Total Participants</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">RSVP I Done (Teams)</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">RSVP I Done (Participants)</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">RSVP II Done (Teams)</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">RSVP II Done (Participants)</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Checked In</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Team Size Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {cityStats.map((stat, idx) => (
                                        <tr key={stat.city} className={idx % 2 === 0 ? 'bg-zinc-950' : 'bg-black'}>
                                            <td className="px-6 py-4 font-semibold text-white">{stat.city}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full font-semibold">
                                                    {stat.teamCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full font-semibold">
                                                    {stat.totalParticipants}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full font-semibold">
                                                    {stat.rsvpCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full font-semibold">
                                                    {stat.rsvpParticipants}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full font-semibold">
                                                    {stat.rsvp2Count}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full font-semibold">
                                                    {stat.rsvp2Participants}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full font-semibold">
                                                    {stat.checkedInCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 justify-center flex-wrap">
                                                    {Object.entries(stat.teamSizeBreakdown)
                                                        .sort(([a], [b]) => Number(a) - Number(b))
                                                        .map(([size, count]) => (
                                                            <span key={size} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs">
                                                                {size} members: {count}
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
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-white mb-6">Overall Team Size Distribution (All Teams)</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[2, 3, 4].map(size => {
                                const count = teams.filter(t => (t.members?.length || 0) === size).length;
                                return (
                                    <div key={size} className="bg-zinc-800 border border-zinc-700 text-white rounded-lg p-6 text-center">
                                        <div className="text-3xl font-bold">{count}</div>
                                        <div className="text-zinc-400 mt-2">{size} Members</div>
                                    </div>
                                );
                            })}
                            <div className="bg-red-600 text-white rounded-lg p-6 text-center">
                                <div className="text-3xl font-bold">
                                    {teams.filter(t => (t.members?.length || 0) > 4 || (t.members?.length || 0) < 2).length}
                                </div>
                                <div className="text-red-100 mt-2">Other Sizes</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Download Info Banner */}
                    {(searchQuery || Object.values(filter).some(v => v)) && (
                        <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-white font-semibold">Filters Applied</p>
                                    <p className="text-zinc-300 text-sm mt-1">
                                        CSV download will export <span className="font-semibold">{filteredTeams.length} filtered teams</span> (out of {teams.length} total). 
                                        Clear filters to download all teams.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search & Filters */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6 space-y-4">
                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by team name, member name, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 pl-12 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                            <svg className="w-5 h-5 text-zinc-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Filter Options */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <select
                                value={filter.status}
                                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                                className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                            >
                                <option value="">All Status</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                            </select>

                            <select
                                value={filter.city}
                                onChange={(e) => setFilter({ ...filter, city: e.target.value })}
                                className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                            >
                                <option value="">All Cities</option>
                                {uniqueCities.map(city => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>

                            <select
                                value={filter.rsvpStatus}
                                onChange={(e) => setFilter({ ...filter, rsvpStatus: e.target.value })}
                                className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                            >
                                <option value="">RSVP Status</option>
                                <option value="rsvp1_completed">RSVP I Completed</option>
                                <option value="rsvp2_completed">RSVP II Completed</option>
                                <option value="pending">Pending</option>
                            </select>

                            <select
                                value={filter.teamSize}
                                onChange={(e) => setFilter({ ...filter, teamSize: e.target.value })}
                                className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                            >
                                <option value="">Team Size</option>
                                <option value="2">2 Members</option>
                                <option value="3">3 Members</option>
                                <option value="4">4 Members</option>
                            </select>

                            <select
                                value={filter.checkedIn}
                                onChange={(e) => setFilter({ ...filter, checkedIn: e.target.value })}
                                className="px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                            >
                                <option value="">Check-in Status</option>
                                <option value="yes">Checked In</option>
                                <option value="no">Not Checked In</option>
                            </select>
                        </div>

                        {/* Active Filters Display */}
                        {(searchQuery || filter.status || filter.city || filter.rsvpStatus || filter.teamSize || filter.checkedIn) && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                <span className="text-sm text-zinc-400">Active filters:</span>
                                {searchQuery && (
                                    <span className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                        Search: "{searchQuery}"
                                        <button onClick={() => setSearchQuery('')} className="hover:text-red-300">×</button>
                                    </span>
                                )}
                                {Object.entries(filter).map(([key, value]) => value && (
                                    <span key={key} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                        {key}: {value}
                                        <button onClick={() => setFilter({ ...filter, [key]: '' })} className="hover:text-white">×</button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilter({ status: '', city: '', rsvpStatus: '', teamSize: '', checkedIn: '' });
                                    }}
                                    className="text-sm text-red-500 hover:text-red-400 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                            <p className="mt-4 text-zinc-400">Loading teams...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-zinc-800">
                                    <thead className="bg-red-600 text-white">
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
                                                RSVP I
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                RSVP II
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                                                Checked In
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {paginatedTeams.map((team, idx) => (
                                            <tr key={team.id} className={`hover:bg-zinc-800 transition-colors ${idx % 2 === 0 ? 'bg-zinc-950' : 'bg-black'}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{team.team_name}</div>
                                                    {team.city && (
                                                        <div className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
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
                                                            <div className="text-sm font-medium text-white">
                                                                {team.members.find(m => m.role === 'leader')?.name}
                                                            </div>
                                                            <div className="text-xs text-zinc-400">
                                                                {team.members.find(m => m.role === 'leader')?.email}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                        team.status === 'confirmed' ? 'bg-red-600/20 text-red-400' :
                                                        team.status === 'shortlisted' ? 'bg-zinc-800 text-zinc-300' :
                                                        'bg-zinc-800 text-zinc-400'
                                                    }`}>
                                                        {team.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full text-sm font-semibold">
                                                        {team.members?.length || 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {team.rsvp_locked ? (
                                                        <span className="text-red-500 text-xl">✓</span>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xl">⏳</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {team.status === 'rsvp2_done' ? (
                                                        <span className="text-blue-500 text-xl">✓</span>
                                                    ) : team.status === 'rsvp_done' ? (
                                                        <span className="text-zinc-600 text-xl">⏳</span>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xl">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {team.checked_in ? (
                                                        <span className="text-red-500 text-xl">✓</span>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xl">✗</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {paginatedTeams.length === 0 && filteredTeams.length === 0 && (
                                    <div className="text-center py-12 text-zinc-400">
                                        <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-lg font-medium">No teams found</p>
                                        <p className="text-sm mt-2">Try adjusting your filters or search query</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 space-y-4">
                                {/* Pagination Controls */}
                                {filteredTeams.length > teamsPerPage && (
                                    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <div className="text-sm text-zinc-400">
                                            Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{' '}
                                            <span className="font-semibold text-white">{Math.min(endIndex, filteredTeams.length)}</span> of{' '}
                                            <span className="font-semibold text-white">{filteredTeams.length}</span> teams
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Previous Button */}
                                            <button
                                                onClick={() => goToPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all ${
                                                    currentPage === 1
                                                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                </svg>
                                                Previous
                                            </button>

                                            {/* Page Numbers */}
                                            <div className="flex gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                                    // Show first page, last page, current page, and pages around current
                                                    if (
                                                        page === 1 ||
                                                        page === totalPages ||
                                                        (page >= currentPage - 1 && page <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <button
                                                                key={page}
                                                                onClick={() => goToPage(page)}
                                                                className={`px-3 py-2 rounded-lg transition-all ${
                                                                    currentPage === page
                                                                        ? 'bg-red-600 text-white'
                                                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                                }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        );
                                                    } else if (
                                                        page === currentPage - 2 ||
                                                        page === currentPage + 2
                                                    ) {
                                                        return <span key={page} className="px-2 text-zinc-600">...</span>;
                                                    }
                                                    return null;
                                                })}
                                            </div>

                                            {/* Next Button */}
                                            <button
                                                onClick={() => goToPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all ${
                                                    currentPage === totalPages
                                                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                }`}
                                            >
                                                Next
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="text-sm text-zinc-400">
                                            Page <span className="font-semibold text-white">{currentPage}</span> of{' '}
                                            <span className="font-semibold text-white">{totalPages}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <div className="text-sm text-zinc-400">
                                        Total: <span className="font-semibold text-white">{filteredTeams.length}</span> teams{' '}
                                        {filteredTeams.length !== teams.length && (
                                            <span className="text-zinc-500">(filtered from {teams.length})</span>
                                        )}
                                    </div>
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-zinc-400">
                                            Total Participants: <span className="font-semibold text-white">
                                                {filteredTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                {/* Download Action */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-red-600 text-white p-2 rounded-lg">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Export Current View</p>
                                                <p className="text-xs text-zinc-400">
                                                    {filteredTeams.length === teams.length 
                                                        ? `Download all ${teams.length} teams with complete details`
                                                        : `Download ${filteredTeams.length} filtered teams (${teams.length - filteredTeams.length} teams excluded by filters)`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={downloadCSV}
                                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download CSV
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
