'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Upload,
    Users,
    Ticket,
    Megaphone,
    Mail,
    LogOut,
    User,
    Table,
    MapPin,
    ShieldCheck,
    FileText,
    CheckCircle
} from 'lucide-react';
import { getAdminToken, getAdminUser, removeAdminToken } from '../../src/lib/admin-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = getAdminToken();
        if (!token && pathname !== '/organisersdashboard/login') {
            router.push('/organisersdashboard/login');
        } else {
            setUser(getAdminUser());
        }
    }, [pathname, router]);

    const handleLogout = () => {
        removeAdminToken();
        router.push('/organisersdashboard/login');
    };

    if (pathname === '/organisersdashboard/login') {
        return children;
    }


    const navItems = [
        { name: 'Dashboard', path: '/organisersdashboard/dashboard', icon: LayoutDashboard },
        { name: 'Bulk Upload', path: '/organisersdashboard/bulk-upload', icon: Upload },
        { name: 'Teams', path: '/organisersdashboard/teams', icon: Users },
        { name: 'Check-ins', path: '/organisersdashboard/checkins', icon: CheckCircle },
        { name: 'Semi Finalists', path: '/organisersdashboard/semi-finalists', icon: CheckCircle },
        { name: 'Volunteers', path: '/organisersdashboard/volunteers', icon: Users },
        { name: 'Tables', path: '/organisersdashboard/tables', icon: Table },
        { name: 'Problem Statements', path: '/organisersdashboard/problem-statements', icon: FileText },
        { name: 'Seat Allocation', path: '/organisersdashboard/seat-allocation', icon: MapPin },
        { name: 'Tickets', path: '/organisersdashboard/tickets', icon: Ticket },
        { name: 'Announcements', path: '/organisersdashboard/announcements', icon: Megaphone },
        { name: 'Emails', path: '/organisersdashboard/emails', icon: Mail },
        { name: 'Volunteer Admins', path: '/organisersdashboard/volunteer-admins', icon: ShieldCheck },
    ];

    return (
        <div className="min-h-screen bg-black flex">
            {/* Fixed Sidebar */}
            <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-zinc-800 text-white flex flex-col">
                {/* Logo Section */}
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-3xl font-tan text-white">
                                RIFT '26
                            </h1>
                            <p className="text-zinc-400 text-xs">Admin Panel</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3">
                    <div className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-red-600 text-white'
                                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* User Section */}
                {user && (
                    <div className="p-4 border-t border-zinc-800">
                        <div className="bg-zinc-900 rounded-lg p-4 mb-3">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white truncate">{user.name}</p>
                                    <p className="text-zinc-400 text-xs truncate">{user.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main content with left margin to account for fixed sidebar */}
            <main className="flex-1 ml-64 overflow-y-auto bg-zinc-950">
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
