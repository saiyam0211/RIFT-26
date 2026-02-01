'use client';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setAdminToken(token: string): void {
  localStorage.setItem('admin_token', token);
}

export function removeAdminToken(): void {
  localStorage.removeItem('admin_token');
}

export function getAdminUser(): any | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('admin_user');
  return user ? JSON.parse(user) : null;
}

export function setAdminUser(user: any): void {
  localStorage.setItem('admin_user', JSON.stringify(user));
}
