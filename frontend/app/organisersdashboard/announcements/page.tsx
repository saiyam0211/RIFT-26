'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Announcement } from '../../../src/types/admin';

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', content: '', priority: 3 });

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const token = getAdminToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/announcements`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setAnnouncements(data.announcements || []);
        } catch (error) {
            console.error('Failed to fetch announcements:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = getAdminToken();
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });
            setFormData({ title: '', content: '', priority: 3 });
            setShowForm(false);
            fetchAnnouncements();
        } catch (error) {
            alert('Failed to create announcement');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Announcements</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                    {showForm ? 'Cancel' : '+ New Announcement'}
                </button>
            </div>

            {showForm && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4 text-white">Create Announcement</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Content
                            </label>
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                required
                                rows={4}
                                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Priority (1-5)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Create Announcement
                        </button>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                {announcements.map((announcement) => (
                    <div key={announcement.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-semibold text-white">{announcement.title}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${announcement.is_active ? 'bg-green-900/50 border border-green-800/50 text-green-400' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                    {announcement.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-red-900/50 border border-red-800/50 text-red-400">
                                    Priority: {announcement.priority}
                                </span>
                            </div>
                        </div>
                        <p className="text-zinc-300 whitespace-pre-wrap">{announcement.content}</p>
                        <div className="mt-4 text-xs text-zinc-500">
                            Created: {new Date(announcement.created_at).toLocaleString()}
                        </div>
                    </div>
                ))}
                {announcements.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        No announcements yet
                    </div>
                )}
            </div>
        </div>
    );
}
