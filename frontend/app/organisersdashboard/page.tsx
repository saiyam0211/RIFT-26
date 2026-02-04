'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem('adminToken');

        if (token) {
            // Redirect to admin dashboard
            router.push('/organisersdashboard/dashboard');
        } else {
            // Redirect to login
            router.push('/organisersdashboard/login');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#060010] via-[#1a0420] to-[#060010] flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#c0211f] border-r-transparent"></div>
                <p className="mt-4 text-white text-sm">Redirecting...</p>
            </div>
        </div>
    );
}
