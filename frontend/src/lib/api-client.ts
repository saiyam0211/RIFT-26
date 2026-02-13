import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Check for participant token first, then volunteer token
    const token = localStorage.getItem('auth_token') || localStorage.getItem('volunteer_token')
    console.log('[apiClient] Token found:', token ? `${token.substring(0, 20)}...` : 'NONE')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this is a volunteer or participant
      const isVolunteer = localStorage.getItem('volunteer_token')
      
      console.error('[apiClient] 401 ERROR - Unauthorized')
      console.error('[apiClient] Is Volunteer:', !!isVolunteer)
      console.error('[apiClient] Error details:', error.response?.data)
      
      // TEMPORARILY DISABLED FOR DEBUGGING
      // if (isVolunteer) {
      //   // Volunteer - redirect to volunteer login
      //   localStorage.removeItem('volunteer_token')
      //   localStorage.removeItem('volunteer_user')
      //   window.location.href = '/volunteer/login'
      // } else {
      //   // Participant - redirect to home
      //   localStorage.removeItem('auth_token')
      //   localStorage.removeItem('team_data')
      //   window.location.href = '/'
      // }
    }
    return Promise.reject(error)
  }
)

export default apiClient
