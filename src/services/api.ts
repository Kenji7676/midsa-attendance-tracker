import { Event, Scholar, AttendanceRecord, DashboardStats, CheckInResponse } from '../types';

export const api = {
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to load dashboard statistics');
    return res.json();
  },

  async getEvents(): Promise<Event[]> {
    const res = await fetch('/api/events');
    if (!res.ok) throw new Error('Failed to load events');
    return res.json();
  },

  async createEvent(event: Omit<Event, 'id' | 'created_at'>): Promise<Event> {
    const res = await fetch('/api/events', {
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
    const res = await fetch(`/api/events/${id}`, {
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
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete event');
  },

  async getColleges(): Promise<string[]> {
    const res = await fetch('/api/colleges');
    if (!res.ok) throw new Error('Failed to load colleges');
    return res.json();
  },

  async addCollege(name: string): Promise<{ success: boolean; college: string; colleges: string[] }> {
    const res = await fetch('/api/colleges', {
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
    const res = await fetch('/api/scholars');
    if (!res.ok) throw new Error('Failed to load scholars');
    return res.json();
  },

  async createScholar(scholar: Partial<Scholar> & { student_id: string; college: string; email: string }): Promise<Scholar> {
    const res = await fetch('/api/scholars', {
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
    const res = await fetch('/api/scholars/batch', {
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
    const res = await fetch(`/api/scholars/${id}`, {
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
    const res = await fetch(`/api/scholars/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete scholar');
  },

  async updateScholarCertificate(id: string, claimed: boolean): Promise<Scholar> {
    const res = await fetch(`/api/scholars/${id}/certificate`, {
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
    const res = await fetch(`/api/scholars/${id}/gawad-isko`, {
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
    const res = await fetch('/api/scholars/batch-delete', {
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
    const res = await fetch(url);
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
    const res = await fetch('/api/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  },

  async signOut(id: string, sign_out_method = 'Manual Entry'): Promise<{ success: boolean; attendanceRecord: AttendanceRecord; message: string; scholar?: Scholar }> {
    const res = await fetch(`/api/attendance/${id}/sign-out`, {
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
    const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete attendance record');
  },

  async batchDeleteAttendance(ids: string[]): Promise<{ count: number }> {
    const res = await fetch('/api/attendance/batch-delete', {
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
    const res = await fetch('/api/email-templates');
    if (!res.ok) throw new Error('Failed to load email templates');
    return res.json();
  },

  async createEmailTemplate(template: { name: string; subject: string; body: string }): Promise<import('../types').EmailTemplate> {
    const res = await fetch('/api/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error('Failed to save email template');
    return res.json();
  },

  async updateEmailTemplate(id: string, template: { name: string; subject: string; body: string }): Promise<import('../types').EmailTemplate> {
    const res = await fetch(`/api/email-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error('Failed to update email template');
    return res.json();
  },

  async deleteEmailTemplate(id: string): Promise<void> {
    const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete template');
  },

  async sendBatchEmail(payload: {
    subject: string;
    body: string;
    scholar_ids?: string[];
    sender_name?: string;
  }): Promise<import('../types').BatchEmailResponse> {
    const res = await fetch('/api/scholars/batch-email', {
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
    const res = await fetch('/api/email-campaigns');
    if (!res.ok) throw new Error('Failed to load email campaigns');
    return res.json();
  },
};
