'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getVolunteerAdminToken } from '../../src/lib/volunteer-admin-auth'

export default function VolunteerAdminPage() {
  const router = useRouter()

  useEffect(() => {
    const token = getVolunteerAdminToken()
    if (token) {
      router.replace('/volunteeradmin/dashboard')
    } else {
      router.replace('/volunteeradmin/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <p className="text-zinc-500">Redirecting...</p>
    </div>
  )
}
