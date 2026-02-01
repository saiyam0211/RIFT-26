import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Team } from '@/types'

interface AuthStore {
  token: string | null
  team: Team | null
  isAuthenticated: boolean
  setAuth: (token: string, team: Team) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      team: null,
      isAuthenticated: false,
      setAuth: (token, team) => {
        localStorage.setItem('auth_token', token)
        set({ token, team, isAuthenticated: true })
      },
      clearAuth: () => {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('team_data')
        set({ token: null, team: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
