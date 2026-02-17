'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getVolunteerAdminToken } from '../../src/lib/volunteer-admin-auth'

export default function VolunteerAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = getVolunteerAdminToken()
    const isLoginPage = pathname === '/volunteeradmin/login'
    if (!token && !isLoginPage) {
      router.replace('/volunteeradmin/login')
    }
  }, [pathname, router])

  return <>{children}</>
}
