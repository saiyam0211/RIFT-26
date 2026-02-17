'use client';

const VOLUNTEER_ADMIN_TOKEN_KEY = 'volunteer_admin_token';
const VOLUNTEER_ADMIN_USER_KEY = 'volunteer_admin_user';

export interface VolunteerAdminUser {
  email: string;
  city: string;
}

export function getVolunteerAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VOLUNTEER_ADMIN_TOKEN_KEY);
}

export function setVolunteerAdminToken(token: string): void {
  localStorage.setItem(VOLUNTEER_ADMIN_TOKEN_KEY, token);
}

export function removeVolunteerAdminToken(): void {
  localStorage.removeItem(VOLUNTEER_ADMIN_TOKEN_KEY);
}

export function getVolunteerAdminUser(): VolunteerAdminUser | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(VOLUNTEER_ADMIN_USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function setVolunteerAdminUser(user: VolunteerAdminUser): void {
  localStorage.setItem(VOLUNTEER_ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearVolunteerAdminAuth(): void {
  removeVolunteerAdminToken();
  localStorage.removeItem(VOLUNTEER_ADMIN_USER_KEY);
}
