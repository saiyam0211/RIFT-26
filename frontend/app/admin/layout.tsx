'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdminToken, getAdminUser, removeAdminToken } from '../../src/lib/admin-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = getAdminToken();
        if (!token && pathname !== '/admin/login') {
            router.push('/admin/login');
        } else {
            setUser(getAdminUser());
        }
    }, [pathname, router]);

    const handleLogout = () => {
        removeAdminToken();
        router.push('/admin/login');
    };

    if (pathname === '/admin/login') {
        return children;
    }

    const navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
        { name: 'Bulk Upload', path: '/admin/bulk-upload', icon: '📤' },
        { name: 'Teams', path: '/admin/teams', icon: '👥' },
        { name: 'Announcements', path: '/admin/announcements', icon: '📢' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gradient-to-b from-purple-700 to-purple-900 text-white">
                <div className="p-6">
                    <h1 className="text-2xl font-bold">RIFT '26</h1>
                    <p className="text-purple-200 text-sm">Admin Panel</p>
                </div>

                <nav className="mt-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center px-6 py-3 hover:bg-purple-800 transition-colors ${pathname === item.path ? 'bg-purple-800 border-l-4 border-white' : ''
                                }`}
                        >
                            <span className="mr-3">{item.icon}</span>
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {user && (
                    <div className="absolute bottom-0 w-64 p-6 border-t border-purple-600">
                        <div className="text-sm">
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-purple-300 text-xs">{user.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-4 w-full bg-purple-800 hover:bg-purple-700 py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </aside>

            {/* Main content */}
            <main className="flex-1 p-8">{children}</main>
        </div>
    );
}
