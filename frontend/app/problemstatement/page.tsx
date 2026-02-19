'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import RIFTBackground from '@/components/RIFTBackground'
import { FileDown, RotateCcw } from 'lucide-react'
import { getAdminToken } from '@/src/lib/admin-auth'

// 19 Feb 2026 11:45 AM IST = 06:15 UTC
const RELEASE_TIME = new Date(Date.UTC(2026, 1, 19, 6, 15, 0))

interface PSItem {
  id: string
  track: string
  name: string
  download_url: string
  created_at: string
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = Math.max(0, target.getTime() - now.getTime())
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  const isPast = diff <= 0
  return { days, hours, minutes, seconds, isPast }
}

export default function ProblemStatementPage() {
  const [released, setReleased] = useState(false)
  const [list, setList] = useState<PSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const hasAdminToken = typeof window !== 'undefined' && !!getAdminToken()
  const { days, hours, minutes, seconds, isPast } = useCountdown(RELEASE_TIME)

  const fetchPS = async () => {
    setError('')
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/problem-statements`)
      if (res.data.released && Array.isArray(res.data.problem_statements)) {
        setReleased(true)
        setList(res.data.problem_statements)
      }
    } catch (e: any) {
      if (e.response?.status === 403) {
        setReleased(false)
        setList([])
      } else {
        setError(e.response?.data?.error || 'Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPS()
  }, [])

  const handleEndCountdown = async () => {
    if (!hasAdminToken) return
    setReleasing(true)
    setError('')
    try {
      const token = getAdminToken()
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/problem-statements/release-early`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPS()
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.status === 403 ? 'Admin only' : 'Failed to release')
    } finally {
      setReleasing(false)
    }
  }

  const handleRestartTimer = async () => {
    if (!hasAdminToken) return
    setResetting(true)
    setError('')
    try {
      const token = getAdminToken()
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/problem-statements/reset-release`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchPS()
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.status === 403 ? 'Admin only' : 'Failed to reset')
    } finally {
      setResetting(false)
    }
  }

  if (loading && !released) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <RIFTBackground />
        <div className="text-white z-10">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <RIFTBackground />

      {!released ? (
        /* Countdown */
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl font-bold text-[#c0211f] text-center mb-20 font-[family-name:var(--font-tan)]">
            RIFT
          </h1>
          <h1 className="text-4xl md:text-8xl font-bold text-white text-center mb-2 font-[family-name:var(--font-tan)]">
            Problem Statements
          </h1>
          <p className="text-zinc-400 text-2xl mb-12">Releasing 19 Feb 2026 at 11:30 AM</p>

          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12">
            <div className=" border border-white/10 rounded-2xl px-8 py-6 pt-10 text-center min-w-[100px]">
              <div className="text-4xl md:text-8xl font-bold text-[#c0211f] tabular-nums font-[family-name:var(--font-tan)]">{String(days).padStart(2, '0')}</div>
              <div className="text-zinc-400 text-sm mt-1">Days</div>
            </div>
            <div className=" border border-white/10 rounded-2xl px-8 py-6 pt-10 text-center min-w-[100px]">
              <div className="text-4xl md:text-8xl font-bold text-[#c0211f] tabular-nums font-[family-name:var(--font-tan)]">{String(hours).padStart(2, '0')}</div>
              <div className="text-zinc-400 text-sm mt-1">Hours</div>
            </div>
            <div className=" border border-white/10 rounded-2xl px-8 py-6 pt-10 text-center min-w-[100px]">
              <div className="text-4xl md:text-8xl font-bold text-[#c0211f] tabular-nums font-[family-name:var(--font-tan)]">{String(minutes).padStart(2, '0')}</div>
              <div className="text-zinc-400 text-sm mt-1">Minutes</div>
            </div>
            <div className=" border border-white/10 rounded-2xl px-8 py-6 pt-10 text-center min-w-[100px]">
              <div className="text-4xl md:text-8xl font-bold text-[#c0211f] tabular-nums font-[family-name:var(--font-tan)]">{String(seconds).padStart(2, '0')}</div>
              <div className="text-zinc-400 text-sm mt-1">Seconds</div>
            </div>
          </div>

          {/* {hasAdminToken && (
            <button
              onClick={handleEndCountdown}
              disabled={releasing}
              className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-600 text-white font-medium"
            >
              {releasing ? 'Releasing...' : 'End countdown (test)'}
            </button>
          )} */}

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </div>
      ) : (
        /* Grid of PS */
        <div className="relative z-10 min-h-screen py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-8xl font-bold text-white text-center mb-2 font-[family-name:var(--font-tan)]">
              Problem Statements
            </h1>
            <p className="text-zinc-400 text-center mb-2 text-xl">All 4 tracks are now live.</p>
            <p className="text-amber-300/90 text-center text-lg mb-10">
              You can easily access the problem statements from your dashboard too!
            </p>

            {/* {hasAdminToken && (
              <div className="flex justify-center mb-6">
                <button
                  onClick={handleRestartTimer}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-600 hover:bg-zinc-500 disabled:bg-zinc-700 text-white text-sm font-medium"
                >
                  <RotateCcw size={16} />
                  {resetting ? 'Resetting...' : 'Restart timer (test)'}
                </button>
              </div>
            )} */}

            {list.length === 0 ? (
              <p className="text-center text-zinc-500">No problem statements uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {list.map((ps) => (
                  <a
                    key={ps.id}
                    href={ps.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white/5 border border-white/10 hover:border-amber-500/50 rounded-2xl p-6 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-amber-400 text-sm font-medium">{ps.track}</span>
                        <h3 className="text-white font-semibold text-lg mt-1 group-hover:text-amber-200">{ps.name}</h3>
                      </div>
                      <FileDown className="text-zinc-400 group-hover:text-amber-400 shrink-0" size={24} />
                    </div>
                    <p className="text-zinc-500 text-sm mt-2">Click to download PDF</p>
                  </a>
                ))}
              </div>
            )}

            {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
          </div>
        </div>  
      )}
    </div>
  )
}
