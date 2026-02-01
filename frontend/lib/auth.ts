// Auth utility functions for managing team authentication

export interface TeamAuth {
    id: string;
    team_name: string;
    status: string;
    rsvp_locked: boolean;
    dashboard_token: string | null;
}

export function setAuth(token: string, team: TeamAuth) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('team_data', JSON.stringify(team));
    }
}

export function getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('auth_token');
    }
    return null;
}

export function getTeamData(): TeamAuth | null {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem('team_data');
        return data ? JSON.parse(data) : null;
    }
    return null;
}

export function clearAuth() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('team_data');
    }
}

export function isAuthenticated(): boolean {
    return getAuthToken() !== null;
}
