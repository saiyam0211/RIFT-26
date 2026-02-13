// Volunteer authentication library
const VOLUNTEER_TOKEN_KEY = 'volunteer_token'
const VOLUNTEER_DATA_KEY = 'volunteer_user' // Changed to match what pages expect

export interface Volunteer {
  id: string
  email: string
  table_id?: string
  table_name?: string
  table_number?: string
  city: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const volunteerAuth = {
  // Store volunteer token and data
  setAuth(token: string, volunteer: Volunteer) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VOLUNTEER_TOKEN_KEY, token)
      localStorage.setItem(VOLUNTEER_DATA_KEY, JSON.stringify(volunteer))
    }
  },

  // Get volunteer token
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(VOLUNTEER_TOKEN_KEY)
    }
    return null
  },

  // Get volunteer data
  getVolunteer(): Volunteer | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(VOLUNTEER_DATA_KEY)
      return data ? JSON.parse(data) : null
    }
    return null
  },

  // Check if volunteer is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken()
  },

  // Clear auth data (logout)
  clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(VOLUNTEER_TOKEN_KEY)
      localStorage.removeItem(VOLUNTEER_DATA_KEY)
    }
  },

  // Get auth header for API requests
  getAuthHeader(): { Authorization: string } | {} {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
}
