import React from 'react';
import { DashboardStats, TabType, Event, Scholar } from '../types';
import midsaLogo from '../assets/midsa-logo.png';
import { formatScholarName, getFirstNameInitials } from '../utils/formatters';
import {
  Users,
  Calendar,
  QrCode,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MapPin,
  Upload,
  UserPlus,
  Radio,
  Send,
} from 'lucide-react';

interface DashboardViewProps {
  stats: DashboardStats | null;
  events: Event[];
  scholars: Scholar[];
  onNavigateTab: (tab: TabType) => void;
  onSelectEventForAttendance: (eventId: string) => void;
  onOpenCreateEvent: () => void;
  onOpenRegisterScholar: () => void;
  onOpenCsvUpload: () => void;
  onOpenBatchEmailModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  events,
  scholars,
  onNavigateTab,
  onSelectEventForAttendance,
  onOpenCreateEvent,
  onOpenRegisterScholar,
  onOpenCsvUpload,
  onOpenBatchEmailModal,
}) => {
  const totalScholars = stats?.total_scholars ?? scholars.length;
  const totalEvents = stats?.total_events ?? events.length;
  const activeEvents = events.filter((e) => e.status === 'ongoing' || e.status === 'upcoming').length;
  const totalAttendance = stats?.total_attendance ?? 0;

  // Active ongoing event if any
  const ongoingEvent = events.find((e) => e.status === 'ongoing') || events[0];

  return (
    <div className="space-y-6">
      {/* Admin Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#004ACD] via-[#0165CB] to-[#004ACD] p-6 sm:p-8 text-white shadow-lg border-2 border-[#00F7FF]/30">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#00F7FF]/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl border-2 border-white/40 shrink-0">
              <img
                src={midsaLogo}
                alt="MIDSA Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-white/10 border border-[#00F7FF]/30 text-xs font-bold text-[#00F7FF]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>MSU-IIT DOST-SEI Scholars' Association</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                MIDSA Attendance Portal
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
                Official attendance tracking system for DOST-SEI scholars with automated QR passes, batch registration, and event sign-ins & sign-outs.
              </p>
            </div>
          </div>

          {/* Quick Launch Button */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {ongoingEvent && (
              <button
                id="hero-start-scanner"
                onClick={() => {
                  onSelectEventForAttendance(ongoingEvent.id);
                  onNavigateTab('attendance');
                }}
                className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-[#00F7FF] hover:bg-[#33f9ff] text-[#004ACD] font-extrabold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-102 cursor-pointer"
              >
                <Radio className="w-4 h-4 text-[#004ACD] animate-pulse" />
                <span>Launch QR Scanner ({ongoingEvent.name.split(' ')[0]})</span>
              </button>
            )}
            <button
              onClick={onOpenCreateEvent}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm border border-white/30 transition-all cursor-pointer"
            >
              <span>+ Schedule Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Core Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Registered Scholars */}
        <div
          onClick={() => onNavigateTab('scholars')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-[#004ACD] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Scholars</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ACD] flex items-center justify-center group-hover:bg-[#004ACD] group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalScholars}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>All equipped with unique QR</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#004ACD] transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Active Events */}
        <div
          onClick={() => onNavigateTab('events')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-[#004ACD] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Events</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-[#004ACD] flex items-center justify-center group-hover:bg-[#004ACD] group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeEvents}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{totalEvents} total scheduled</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#004ACD] transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Total Attendance Sign-Ins */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-[#004ACD] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sign-Ins</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalAttendance}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Across all assemblies</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Admin Quick Actions</span>
          <span className="text-[11px] text-slate-400">Direct shortcuts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigateTab('attendance')}
            className="flex items-center space-x-2 p-3 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60 text-[#004ACD] text-xs font-bold transition-all text-left"
          >
            <QrCode className="w-4 h-4 text-[#004ACD] shrink-0" />
            <span>QR Scanner Mode</span>
          </button>

          <button
            onClick={onOpenCreateEvent}
            className="flex items-center space-x-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all text-left"
          >
            <Calendar className="w-4 h-4 text-[#004ACD] shrink-0" />
            <span>+ Add New Event</span>
          </button>

          <button
            onClick={onOpenRegisterScholar}
            className="flex items-center space-x-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all text-left"
          >
            <UserPlus className="w-4 h-4 text-[#004ACD] shrink-0" />
            <span>+ Register Scholar</span>
          </button>

          <button
            onClick={onOpenCsvUpload}
            className="flex items-center space-x-2 p-3 rounded-xl bg-cyan-50/70 hover:bg-cyan-100/70 border border-cyan-200 text-[#004ACD] text-xs font-bold transition-all text-left"
          >
            <Upload className="w-4 h-4 text-[#004ACD] shrink-0" />
            <span>Upload CSV</span>
          </button>

          <button
            onClick={onOpenBatchEmailModal}
            className="col-span-2 sm:col-span-1 flex items-center space-x-2 p-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-[#004ACD]/30 text-[#004ACD] text-xs font-bold transition-all text-left"
          >
            <Send className="w-4 h-4 text-[#004ACD] shrink-0" />
            <span>Batch Email QRs</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Event Attendance Breakdown & Recent Check-In Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Event Attendance Performance Breakdown */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Event Attendance Breakdown</h3>
              <p className="text-xs text-slate-500">Attendee count and percentage turnout per activity</p>
            </div>
            <button
              onClick={() => onNavigateTab('events')}
              className="text-xs font-bold text-[#004ACD] hover:underline flex items-center gap-1"
            >
              <span>Manage Events</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No events recorded yet. Click "+ Schedule Event" above.
              </div>
            ) : (
              events.slice(0, 5).map((evt) => {
                const attendees = evt.attendee_count || 0;
                const rate = totalScholars > 0 ? Math.round((attendees / totalScholars) * 100) : 0;
                return (
                  <div key={evt.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              evt.status === 'ongoing'
                                ? 'bg-cyan-100 text-[#004ACD]'
                                : evt.status === 'completed'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-50 text-[#004ACD]'
                            }`}
                          >
                            {evt.status}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{evt.name}</h4>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-3 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {evt.date}
                          </span>
                          <span className="flex items-center gap-1 truncate max-w-[160px]">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {evt.venue}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onSelectEventForAttendance(evt.id);
                          onNavigateTab('attendance');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-[#004ACD] text-[#004ACD] hover:text-white text-xs font-bold transition-colors shrink-0"
                      >
                        Record
                      </button>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Scholars Signed In</span>
                        <span className="font-bold text-[#004ACD]">
                          {attendees} / {totalScholars} ({rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#004ACD] to-[#00F7FF] rounded-full"
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Recent Live Sign-In Activity Feed */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <span>Recent Activity Feed</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                </h3>
                <p className="text-xs text-slate-500">Live attendance stream</p>
              </div>
              <button
                onClick={() => onNavigateTab('attendance')}
                className="text-xs font-bold text-[#004ACD] hover:underline"
              >
                View Roster
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {!stats?.recent_attendance || stats.recent_attendance.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No sign-ins logged yet.
                </div>
              ) : (
                stats.recent_attendance.map((rec) => {
                  const scholar = scholars.find((s) => s.id === rec.scholar_id || s.student_id === rec.student_id);
                  const displayStudentId = scholar?.student_id || rec.student_id;
                  const displayName = scholar ? formatScholarName(scholar) : formatScholarName(rec.scholar_name);
                  const initials = scholar ? getFirstNameInitials(scholar) : getFirstNameInitials(rec.scholar_name);

                  return (
                    <div key={rec.id} className="p-3.5 hover:bg-blue-50/30 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#004ACD] to-[#0165CB] text-[#00F7FF] font-bold text-xs flex items-center justify-center shrink-0">
                          {initials || 'S'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">{displayName}</span>
                          <span className="text-[11px] text-slate-500 truncate block">
                            <span className="font-mono font-bold text-[#004ACD]">{displayStudentId}</span> • {rec.event_name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {rec.sign_out_time ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                            Signed Out
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Signed In
                          </span>
                        )}
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {new Date(rec.sign_out_time || rec.sign_in_time || rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigateTab('attendance')}
              className="w-full py-2 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white font-bold text-xs shadow-xs transition-colors"
            >
              Open Live Attendance Scanner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
