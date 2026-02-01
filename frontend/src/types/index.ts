export interface Team {
  id: string
  team_name: string
  city?: 'BLR' | 'PUNE' | 'NOIDA' | 'LKO'
  status: 'shortlisted' | 'rsvp_done' | 'checked_in'
  problem_statement?: string
  qr_code_token?: string
  rsvp_locked: boolean
  rsvp_locked_at?: string
  checked_in_at?: string
  dashboard_token?: string
  created_at: string
  updated_at: string
  members?: TeamMember[]
}

export interface TeamMember {
  id: string
  team_id: string
  name: string
  email: string
  phone: string
  role: 'leader' | 'member'
  tshirt_size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  individual_qr_token?: string
  created_at: string
  updated_at: string
}

export interface TeamSearchResult {
  id: string
  team_name: string
  masked_phone: string
  city?: 'BLR' | 'PUNE' | 'NOIDA' | 'LKO'
  status: string
  member_count: number
}

export interface Announcement {
  id: string
  title: string
  content: string
  priority: number
  is_active: boolean
  created_at: string
}

export interface FirebaseAuthResponse {
  token: string
  team: Team
  phone_number: string
}

export interface RSVPSubmission {
  city: 'BLR' | 'PUNE' | 'NOIDA' | 'LKO'
  members: {
    id: string
    name: string
    email: string
    phone: string
  }[]
}
