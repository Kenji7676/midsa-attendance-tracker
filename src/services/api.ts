import type { Event, Scholar, AttendanceRecord, DashboardStats, CheckInResponse, AdminUser } from '../types';

const AUTH_TOKEN_KEY = 'midsa_admin_token';
const AUTH_USER_KEY = 'midsa_admin_user';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthSession(token: string, user: AdminUser): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !url.includes('/api/auth/login')) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('midsa-unauthorized'));
    }
  }
  return res;
}

export const api = {
  // --- AUTHENTICATION API ---
  async login(username: string, password: string): Promise<{ success: boolean; token: string; user: AdminUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Login failed. Please verify your credentials.');
    }
    setAuthSession(data.token, data.user);
    return data;
  },

  async checkSession(): Promise<{ authenticated: boolean; user?: AdminUser }> {
    const token = getAuthToken();
    if (!token) {
      return { authenticated: false };
    }
    try {
      const res = await authFetch('/api/auth/session');
      if (!res.ok) {
        clearAuthSession();
        return { authenticated: false };
      }
      const data = await res.json();
      if (data.authenticated && data.user) {
        setAuthSession(token, data.user);
        return { authenticated: true, user: data.user };
      }
      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  },

  async logout(): Promise<void> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuthSession();
    }
  },

  async changeAccountDetails(payload: {
    current_password: string;
    new_username?: string;
    new_password?: string;
    confirm_password?: string;
  }): Promise<{ success: boolean; message: string; user: AdminUser }> {
    const res = await authFetch('/api/auth/change-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update account details');
    }
    if (data.user) {
      const token = getAuthToken();
      if (token) setAuthSession(token, data.user);
    }
    return data;
  },

  // --- CORE DATA APIS ---
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await authFetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to load dashboard statistics');
    return res.json();
  },

  async getEvents(): Promise<Event[]> {
    const res = await authFetch('/api/events');
    if (!res.ok) throw new Error('Failed to load events');
    return res.json();
  },

  async createEvent(event: Omit<Event, 'id' | 'created_at'>): Promise<Event> {
    const res = await authFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create event');
    }
    return res.json();
  },

  async updateEvent(id: string, event: Partial<Event>): Promise<Event> {
    const res = await authFetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update event');
    }
    return res.json();
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await authFetch(`/api/events/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete event');
  },

  async getColleges(): Promise<string[]> {
    const res = await authFetch('/api/colleges');
    if (!res.ok) throw new Error('Failed to load colleges');
    return res.json();
  },

  async addCollege(name: string): Promise<{ success: boolean; college: string; colleges: string[] }> {
    const res = await authFetch('/api/colleges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add college');
    }
    return res.json();
  },

  async getScholars(): Promise<Scholar[]> {
    const res = await authFetch('/api/scholars');
    if (!res.ok) throw new Error('Failed to load scholars');
    return res.json();
  },

  async createScholar(scholar: Partial<Scholar> & { student_id: string; college: string; email: string }): Promise<Scholar> {
    const res = await authFetch('/api/scholars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scholar),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register scholar');
    }
    return res.json();
  },

  async batchRegisterScholars(scholars: any[]): Promise<{ addedCount: number; skippedCount: number; totalProcessed: number; errors: string[] }> {
    const res = await authFetch('/api/scholars/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scholars }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to batch register scholars');
    }
    return res.json();
  },

  async updateScholar(id: string, scholar: Partial<Scholar>): Promise<Scholar> {
    const res = await authFetch(`/api/scholars/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scholar),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update scholar');
    }
    return res.json();
  },

  async deleteScholar(id: string): Promise<void> {
    const res = await authFetch(`/api/scholars/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete scholar');
  },

  async updateScholarCertificate(id: string, claimed: boolean): Promise<Scholar> {
    const res = await authFetch(`/api/scholars/${id}/certificate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimed: claimed ? 'yes' : 'no' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update certificate status');
    }
    return res.json();
  },

  async toggleGawadIskoAwardee(id: string, isAwardee: boolean): Promise<Scholar> {
    const res = await authFetch(`/api/scholars/${id}/gawad-isko`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gawad_isko_awardee: isAwardee ? 'yes' : 'no' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update Gawad Isko Awardee status');
    }
    return res.json();
  },

  async batchDeleteScholars(ids: string[]): Promise<{ count: number }> {
    const res = await authFetch('/api/scholars/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete scholars');
    }
    return res.json();
  },

  async getAttendance(eventId?: string): Promise<AttendanceRecord[]> {
    const url = eventId ? `/api/attendance?event_id=${encodeURIComponent(eventId)}` : '/api/attendance';
    const res = await authFetch(url);
    if (!res.ok) throw new Error('Failed to load attendance records');
    return res.json();
  },

  async checkIn(payload: {
    event_id: string;
    qr_code?: string;
    student_id?: string;
    check_in_method?: string;
    status?: string;
    notes?: string;
  }): Promise<CheckInResponse> {
    const res = await authFetch('/api/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  },

  async signOut(id: string, sign_out_method = 'Manual Entry'): Promise<{ success: boolean; attendanceRecord: AttendanceRecord; message: string; scholar?: Scholar }> {
    const res = await authFetch(`/api/attendance/${id}/sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sign_out_method }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record sign out');
    }
    return res.json();
  },

  async deleteAttendance(id: string): Promise<void> {
    const res = await authFetch(`/api/attendance/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete attendance record');
  },

  async batchDeleteAttendance(ids: string[]): Promise<{ count: number }> {
    const res = await authFetch('/api/attendance/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete attendance records');
    }
    return res.json();
  },

  async getEmailTemplates(): Promise<import('../types').EmailTemplate[]> {
    const res = await authFetch('/api/email-templates');
    if (!res.ok) throw new Error('Failed to load email templates');
    return res.json();
  },

  async createEmailTemplate(template: { name: string; subject: string; body: string }): Promise<import('../types').EmailTemplate> {
    const res = await authFetch('/api/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error('Failed to save email template');
    return res.json();
  },

  async updateEmailTemplate(id: string, template: { name: string; subject: string; body: string }): Promise<import('../types').EmailTemplate> {
    const res = await authFetch(`/api/email-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error('Failed to update email template');
    return res.json();
  },

  async deleteEmailTemplate(id: string): Promise<void> {
    const res = await authFetch(`/api/email-templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete template');
  },

  async sendBatchEmail(payload: {
    subject: string;
    body: string;
    scholar_ids?: string[];
    sender_name?: string;
  }): Promise<import('../types').BatchEmailResponse> {
    const res = await authFetch('/api/scholars/batch-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to dispatch batch emails');
    }
    return res.json();
  },

  async getEmailCampaigns(): Promise<import('../types').EmailCampaign[]> {
    const res = await authFetch('/api/email-campaigns');
    if (!res.ok) throw new Error('Failed to load email campaigns');
    return res.json();
  },
};
