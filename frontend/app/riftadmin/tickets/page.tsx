'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAdminToken } from '../../../src/lib/admin-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

interface Ticket {
    id: string;
    team_id: string;
    subject: string;
    description: string;
    message?: string;
    status: string;
    resolution?: string;
    created_at: string;
    resolved_at?: string;
    resolved_by_email?: string;
    team?: {
        team_name: string;
        city?: string;
        member_count: number;
    };
}

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [resolution, setResolution] = useState('');
    const [sendEmail, setSendEmail] = useState(true);
    const [allowEdit, setAllowEdit] = useState(false);
    const [editMinutes, setEditMinutes] = useState(30);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchTickets();
    }, [filterStatus]);

    const fetchTickets = async () => {
        try {
            const token = getAdminToken();
            const response = await axios.get(`${API_URL}/admin/tickets?status=${filterStatus}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTickets(response.data.tickets || []);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedTicket || !resolution) return;

        try {
            const token = getAdminToken();
            await axios.post(
                `${API_URL}/admin/tickets/${selectedTicket.id}/resolve`,
                {
                    resolution,
                    send_email: sendEmail,
                    allow_edit: allowEdit,
                    edit_minutes: allowEdit ? editMinutes : 0,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert('Ticket resolved successfully!');
            setShowResolveModal(false);
            setResolution('');
            fetchTickets();
        } catch (error) {
            console.error('Failed to resolve ticket:', error);
            alert('Failed to resolve ticket');
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            open: 'bg-red-100 text-red-800',
            in_progress: 'bg-yellow-100 text-yellow-800',
            resolved: 'bg-green-100 text-green-800',
            closed: 'bg-gray-100 text-gray-800',
        };
        return colors[status] || colors.open;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
                    <p className="text-gray-600 mt-1">{tickets.length} total tickets</p>
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="all">All Tickets</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                </select>
            </div>

            {tickets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <p className="text-gray-500 text-lg">No tickets found</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        {ticket.subject}
                                    </h3>
                                    <div className="flex gap-3 text-sm text-gray-600">
                                        <span>🏢 {ticket.team?.team_name || 'Unknown Team'}</span>
                                        {ticket.team?.city && <span>📍 {ticket.team.city}</span>}
                                        <span>👥 {ticket.team?.member_count || 0} members</span>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(ticket.status)}`}>
                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                </span>
                            </div>

                            <p className="text-gray-700 mb-4">{ticket.message || ticket.description}</p>

                            {ticket.resolution && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <p className="text-sm font-semibold text-green-900 mb-1">Resolution:</p>
                                    <p className="text-green-800">{ticket.resolution}</p>
                                    {ticket.resolved_by_email && (
                                        <p className="text-xs text-green-600 mt-2">
                                            Resolved by {ticket.resolved_by_email}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                                {ticket.status !== 'resolved' && (
                                    <button
                                        onClick={() => {
                                            setSelectedTicket(ticket);
                                            setShowResolveModal(true);
                                        }}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                    >
                                        Resolve Ticket
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolve Modal */}
            {showResolveModal && selectedTicket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
                        <h2 className="text-2xl font-bold mb-4">Resolve Ticket</h2>
                        <p className="text-gray-600 mb-6">{selectedTicket.subject}</p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Resolution Message
                            </label>
                            <textarea
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Explain how the issue was resolved..."
                            />
                        </div>

                        <div className="space-y-3 mb-6">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={sendEmail}
                                    onChange={(e) => setSendEmail(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                    Send email notification to team leader
                                </span>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={allowEdit}
                                    onChange={(e) => setAllowEdit(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                    Allow team to edit details temporarily
                                </span>
                            </label>

                            {allowEdit && (
                                <div className="ml-6">
                                    <label className="block text-sm text-gray-600 mb-1">
                                        Edit permission duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={editMinutes}
                                        onChange={(e) => setEditMinutes(parseInt(e.target.value) || 30)}
                                        min="5"
                                        max="1440"
                                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleResolve}
                                disabled={!resolution}
                                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Resolve Ticket
                            </button>
                            <button
                                onClick={() => {
                                    setShowResolveModal(false);
                                    setResolution('');
                                }}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
