export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminLoginResponse {
  token: string;
  user: AdminUser;
}

export interface TeamStats {
  total_teams: number;
  rsvp_confirmed: number;
  checked_in: number;
  city_distribution: Record<string, number>;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  team_name: string;
  status: string;
  city?: string;
  rsvp_locked: boolean;
  checked_in: boolean;
  members: TeamMember[];
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'leader' | 'member';
}

export interface BulkUploadResponse {
  message: string;
  success_count: number;
  error_count: number;
  total_teams: number;
  errors: string[];
}
