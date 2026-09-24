export interface Event {
  id: string;
  name: string;
  date: string;
  time?: string;
  venue: string;
  description?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  created_at: string;
  attendee_count?: number;
}

export type ScholarshipCategory = 'UGS' | 'JLSS' | 'MOST';
export type ScholarshipSubcategory = 'RA 7687' | 'MERIT' | 'RA 10612' | '';

export interface Scholar {
  id: string;
  student_id: string;
  name: string; // Formatted as "Last Name, First Name M.I." (e.g. "La Cruz, Juan D.")
  last_name?: string;
  first_name?: string;
  middle_initial?: string;
  year_level?: string; // "1" to "5"
  academic_program?: string; // e.g. "BS Computer Science"
  year_program: string; // e.g. "1st Year - BS Computer Science"
  college: string;
  scholarship_category?: ScholarshipCategory;
  scholarship_subcategory?: ScholarshipSubcategory;
  scholarship_type?: string; // e.g. "RA 7687", "JLSS (MERIT)", "MOST"
  email: string;
  qr_code: string;
  created_at: string;
  attendance_count?: number;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  scholar_id: string;
  student_id: string;
  timestamp: string;
  sign_in_time?: string;
  sign_out_time?: string | null;
  status: 'Present' | 'Late' | 'Excused';
  check_in_method: string;
  sign_out_method?: string | null;
  notes?: string;
  scholar_name?: string;
  year_program?: string;
  college?: string;
  scholarship_type?: string;
  email?: string;
  qr_code?: string;
  event_name?: string;
  event_venue?: string;
  event_date?: string;
}

export interface DashboardStats {
  total_scholars: number;
  total_events: number;
  active_events: number;
  total_attendance: number;
  recent_attendance: AttendanceRecord[];
  event_breakdown: Array<{
    id: string;
    name: string;
    date: string;
    time?: string;
    venue: string;
    status: string;
    attendance_count: number;
    total_scholars: number;
    rate: number;
  }>;
}

export interface CheckInResponse {
  success: boolean;
  action?: 'sign_in' | 'sign_out' | 'completed';
  alreadyCheckedIn?: boolean;
  alreadyCompleted?: boolean;
  message: string;
  scholar?: Scholar;
  attendanceRecord?: AttendanceRecord;
  existingRecord?: AttendanceRecord;
  event?: Event;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  recipient_count: number;
  sent_at: string;
  status: string;
  details?: string;
}

export interface BatchEmailResponse {
  success: boolean;
  campaignId: string;
  recipientCount: number;
  sentAt: string;
  recipients: Array<{
    scholar_id: string;
    student_id: string;
    name: string;
    email: string;
    qr_code: string;
    subject: string;
    body: string;
    status: string;
    timestamp: string;
  }>;
  message: string;
}

export type TabType = 'dashboard' | 'events' | 'scholars' | 'attendance';
