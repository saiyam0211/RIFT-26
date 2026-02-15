'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Team } from '../../../src/types/admin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export default function EmailsPage() {
    const [subject, setSubject] = useState('');
    const [htmlContent, setHTMLContent] = useState('');
    const [teamSizes, setTeamSizes] = useState<number[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [onlyRSVP1Done, setOnlyRSVP1Done] = useState(false);
    const [sending, setSending] = useState(false);
    const [emailLogs, setEmailLogs] = useState<any[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [showSearch, setShowSearch] = useState(false);

    const cityOptions = ['BLR', 'LKO', 'NOIDA', 'PUNE'];
    const teamSizeOptions = [1, 2, 3, 4, 5];

    useEffect(() => {
        fetchEmailLogs();
        fetchTeams();
    }, []);

    const fetchEmailLogs = async () => {
        try {
            const token = getAdminToken();
            const response = await axios.get(`${API_URL}/admin/email-logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmailLogs(response.data.logs || []);
        } catch (error) {
            console.error('Failed to fetch email logs:', error);
        }
    };

    const fetchTeams = async () => {
        try {
            const token = getAdminToken();
            const response = await axios.get(`${API_URL}/admin/teams`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeams(response.data.teams || []);
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        }
    };

    const filteredTeams = teams.filter(team => {
        if (!searchQuery) return false;
        const query = searchQuery.toLowerCase();
        return (
            team.team_name?.toLowerCase().includes(query) ||
            team.members?.some(m => 
                m.name?.toLowerCase().includes(query) || 
                m.email?.toLowerCase().includes(query)
            )
        );
    });

    const handleSendEmail = async () => {
        if (!subject || !htmlContent) {
            alert('Please fill in subject and content');
            return;
        }

        setSending(true);
        try {
            const token = getAdminToken();
            const response = await axios.post(
                `${API_URL}/admin/send-bulk-email`,
                {
                    subject,
                    html_content: htmlContent,
                    filters: {
                        team_sizes: teamSizes,
                        cities,
                        only_rsvp1_done: onlyRSVP1Done,
                    },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`Email sent successfully to ${response.data.recipients_count} recipients!`);
            setSubject('');
            setHTMLContent('');
            setTeamSizes([]);
            setCities([]);
            setOnlyRSVP1Done(false);
            setSelectedTeam(null);
            fetchEmailLogs();
        } catch (error: any) {
            console.error('Failed to send email:', error);
            alert('Failed to send email: ' + (error.response?.data?.error || error.message));
        } finally {
            setSending(false);
        }
    };

    const handleSendToSpecificTeam = async () => {
        if (!selectedTeam) {
            alert('Please select a team');
            return;
        }
        if (!subject || !htmlContent) {
            alert('Please fill in subject and content');
            return;
        }

        setSending(true);
        try {
            const token = getAdminToken();
            const teamMembers = selectedTeam.members || [];
            const emails = teamMembers.map(m => m.email).filter(Boolean);
            
            if (emails.length === 0) {
                alert('Selected team has no email addresses');
                setSending(false);
                return;
            }

            // Send email to each member of the team
            const response = await axios.post(
                `${API_URL}/admin/send-bulk-email`,
                {
                    subject,
                    html_content: htmlContent,
                    filters: {
                        team_sizes: [teamMembers.length],
                        cities: [selectedTeam.city],
                    },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`Email sent successfully to ${selectedTeam.team_name} (${emails.length} members)!`);
            setSubject('');
            setHTMLContent('');
            setSelectedTeam(null);
            setSearchQuery('');
            setShowSearch(false);
            fetchEmailLogs();
        } catch (error: any) {
            console.error('Failed to send email:', error);
            alert('Failed to send email: ' + (error.response?.data?.error || error.message));
        } finally {
            setSending(false);
        }
    };

    const generateTemplate = () => {
        const template = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060010; color: #fff; padding: 0; margin: 0; }
    .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a0420 0%, #060010 100%); border: 1px solid #c0211f30; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(90deg, #c0211f 0%, #8a1816 100%); padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .content { padding: 30px; }
    .footer { padding: 20px 30px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 RIFT '26 Update</h1>
    </div>
    <div class="content">
      <p>Hi Team,</p>
      <p>This is an important update from the RIFT '26 team.</p>
      <!-- Add your content here -->
      <p>Thank you for being part of RIFT '26!</p>
    </div>
    <div class="footer">
      <strong>RIFT '26 Hackathon Team</strong>
    </div>
  </div>
</body>
</html>`;
        setHTMLContent(template);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Bulk Email Sender</h1>
                    <p className="text-zinc-400 mt-1">Send custom emails to filtered teams</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setShowSearch(!showSearch);
                            setShowLogs(false);
                        }}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        {showSearch ? 'Hide Search' : 'Search Team'}
                    </button>
                    <button
                        onClick={() => {
                            setShowLogs(!showLogs);
                            setShowSearch(false);
                        }}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        {showLogs ? 'Hide Logs' : 'View Logs'}
                    </button>
                </div>
            </div>

            {showSearch && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Search and Email Specific Team</h2>
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Search by team name, member name, or email..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setSelectedTeam(null);
                            }}
                            className="w-full px-4 py-3 pl-12 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                        <svg className="w-5 h-5 text-zinc-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    
                    {searchQuery && filteredTeams.length > 0 && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-h-60 overflow-y-auto mb-4">
                            {filteredTeams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => {
                                        setSelectedTeam(team);
                                        setSearchQuery('');
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"
                                >
                                    <div className="font-medium text-white">{team.team_name}</div>
                                    <div className="text-sm text-zinc-400">
                                        {team.city} • {team.members?.length || 0} members
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedTeam && (
                        <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-semibold">{selectedTeam.team_name}</p>
                                    <p className="text-zinc-400 text-sm">
                                        {selectedTeam.city} • {selectedTeam.members?.length || 0} members
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedTeam(null)}
                                    className="text-red-500 hover:text-red-400"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showLogs ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Email History</h2>
                    {emailLogs.length === 0 ? (
                        <p className="text-zinc-400">No emails sent yet</p>
                    ) : (
                        <div className="space-y-3">
                            {emailLogs.map((log) => (
                                <div key={log.id} className="border-b border-zinc-800 pb-3">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-white">{log.subject}</span>
                                        <span className="text-sm text-zinc-400">
                                            {log.sent_count} recipients
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {new Date(log.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                    {/* Filters */}
                    {!selectedTeam && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-white mb-3">Target Filters</h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Team Sizes
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {teamSizeOptions.map((size) => (
                                            <button
                                                key={size}
                                                onClick={() =>
                                                    setTeamSizes((prev) =>
                                                        prev.includes(size)
                                                            ? prev.filter((s) => s !== size)
                                                            : [...prev, size]
                                                    )
                                                }
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${teamSizes.includes(size)
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {size} {size === 1 ? 'member' : 'members'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={onlyRSVP1Done}
                                            onChange={(e) => setOnlyRSVP1Done(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-600"
                                        />
                                        <span className="text-sm text-zinc-300 group-hover:text-white">
                                            Only teams with <strong>RSVP I done</strong>, <strong>Final Confirmation pending</strong> (RSVP II not done)
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Cities
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {cityOptions.map((city) => (
                                            <button
                                                key={city}
                                                onClick={() =>
                                                    setCities((prev) =>
                                                        prev.includes(city)
                                                            ? prev.filter((c) => c !== city)
                                                            : [...prev, city]
                                                    )
                                                }
                                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${cities.includes(city)
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {city}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {(teamSizes.length > 0 || cities.length > 0 || onlyRSVP1Done) && (
                                <div className="mt-3 text-sm text-zinc-400">
                                    <strong className="text-white">Targeting:</strong>{' '}
                                    {onlyRSVP1Done && 'RSVP I done, Final Confirmation pending only'}
                                    {onlyRSVP1Done && (teamSizes.length > 0 || cities.length > 0) && ' • '}
                                    {teamSizes.length > 0 && `Teams of ${teamSizes.join(', ')} members`}
                                    {teamSizes.length > 0 && cities.length > 0 && ' in '}
                                    {cities.length > 0 && cityOptions.filter((c) => cities.includes(c)).join(', ')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Email Content */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            placeholder="Email subject..."
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-zinc-300">
                                HTML Content
                            </label>
                            <button
                                onClick={generateTemplate}
                                className="text-sm text-red-500 hover:text-red-400"
                            >
                                Load Template
                            </button>
                        </div>
                        <textarea
                            value={htmlContent}
                            onChange={(e) => setHTMLContent(e.target.value)}
                            rows={12}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent font-mono text-sm"
                            placeholder="Paste your HTML email content here..."
                        />
                    </div>

                    {/* Preview */}
                    {htmlContent && (
                        <details className="mb-4">
                            <summary className="cursor-pointer text-sm font-medium text-zinc-300 mb-2">
                                Preview Email
                            </summary>
                            <div
                                className="border border-zinc-800 rounded-lg p-4 bg-zinc-950"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </details>
                    )}

                    {/* Send Button */}
                    <button
                        onClick={selectedTeam ? handleSendToSpecificTeam : handleSendEmail}
                        disabled={sending || !subject || !htmlContent}
                        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {sending ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {selectedTeam ? `Send to ${selectedTeam.team_name}` : 'Send Bulk Email'}
                            </>
                        )}
                    </button>

                    {!selectedTeam && teamSizes.length === 0 && cities.length === 0 && !onlyRSVP1Done && (
                        <p className="mt-3 text-sm text-yellow-500 text-center">
                            ⚠️ No filters selected - email will be sent to ALL teams
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
