import React, { useState } from 'react';
import { Event, Scholar } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { formatScholarName } from '../utils/formatters';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Search,
  QrCode,
  Edit2,
  Trash2,
  Download,
  Users,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface EventsViewProps {
  events: Event[];
  scholarsCount: number;
  onOpenCreateModal: () => void;
  onEditEvent: (event: Event) => void;
  onStartAttendance: (eventId: string) => void;
  onRefresh: () => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  scholarsCount,
  onOpenCreateModal,
  onEditEvent,
  onStartAttendance,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const handleReopenEvent = async (event: Event) => {
    setUpdatingEventId(event.id);
    try {
      await api.updateEvent(event.id, {
        ...event,
        status: 'ongoing',
      });
      setToastMessage(`"${event.name}" reopened and set to Active / Ongoing!`);
      setTimeout(() => setToastMessage(null), 3500);
      onRefresh();
    } catch (err: any) {
      alert('Failed to reopen event: ' + err.message);
    } finally {
      setUpdatingEventId(null);
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !searchQuery ||
      e.name.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      (e.description && e.description.toLowerCase().includes(q));

    return matchesStatus && matchesQuery;
  });

  const handleDelete = (event: Event) => {
    setEventToDelete(event);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteEvent(eventToDelete.id);
      const name = eventToDelete.name;
      setEventToDelete(null);
      onRefresh();
      setToastMessage(`Event "${name}" and its attendance logs were deleted.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert('Failed to delete event: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportEventAttendance = async (event: Event) => {
    try {
      const records = await api.getAttendance(event.id);
      if (records.length === 0) {
        alert('No attendance records logged yet for this event.');
        return;
      }

      const headers = ['Student ID', 'Name', 'College', 'Program', 'Time', 'Method', 'Status'];
      const rows = records.map((r) => [
        `"${r.student_id}"`,
        `"${formatScholarName(r.scholar_name || '')}"`,
        `"${r.college || ''}"`,
        `"${r.year_program || ''}"`,
        `"${new Date(r.timestamp).toLocaleString()}"`,
        `"${r.check_in_method}"`,
        `"${r.status}"`,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to export: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#004ACD]"></span>
            <h2 className="text-lg font-bold text-slate-800">MIDSA Events & Activities</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize assemblies, training workshops, and manage session attendance checkpoints.
          </p>
        </div>

        <button
          id="create-event-btn"
          onClick={onOpenCreateModal}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <Calendar className="w-4 h-4 text-[#00F7FF]" />
          <span>+ Create New Event</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search events by title, venue, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-stretch sm:self-auto justify-center">
          {(['all', 'ongoing', 'upcoming', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                statusFilter === st
                  ? 'bg-white text-[#004ACD] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'all' ? 'All Events' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">No Events Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No events match your current filter. Click "+ Create New Event" above to schedule an activity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((evt) => {
            const attendees = evt.attendee_count || 0;
            const rate = scholarsCount > 0 ? Math.round((attendees / scholarsCount) * 100) : 0;

            const isOngoing = evt.status === 'ongoing';
            const isCompleted = evt.status === 'completed';

            return (
              <div
                key={evt.id}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isOngoing
                    ? 'border-[#00F7FF] ring-2 ring-[#00F7FF]/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Event Card Header */}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          isOngoing
                            ? 'bg-cyan-100 text-[#004ACD] border border-[#00F7FF]'
                            : isCompleted
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-blue-50 text-[#004ACD] border border-blue-200'
                        }`}
                      >
                        {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-[#004ACD] animate-ping mr-1"></span>}
                        {evt.status}
                      </span>

                      {isCompleted && (
                        <button
                          onClick={() => handleReopenEvent(evt)}
                          disabled={updatingEventId === evt.id}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          title="Reopen event and set status to Active / Ongoing"
                        >
                          <RotateCcw className={`w-2.5 h-2.5 ${updatingEventId === evt.id ? 'animate-spin' : ''}`} />
                          <span>{updatingEventId === evt.id ? 'Reopening...' : 'Reopen'}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onEditEvent(evt)}
                        title="Edit Event"
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(evt)}
                        title="Delete Event"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug hover:text-[#004ACD] transition-colors">
                    {evt.name}
                  </h3>

                  {evt.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  {/* Metadata items */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-[#004ACD] shrink-0" />
                      <span className="font-medium text-slate-800">{evt.date}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-[#004ACD] shrink-0" />
                      <span>{evt.time || 'Schedule TBA'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-[#004ACD] shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                  </div>
                </div>

                {/* Event Attendance Gauge & Footer */}
                <div className="bg-slate-50/70 p-4 border-t border-slate-100 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#004ACD]" />
                        <span>Attendance Turnout</span>
                      </span>
                      <span className="font-bold text-[#004ACD]">
                        {attendees} / {scholarsCount} ({rate}%)
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#004ACD] to-[#00F7FF] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    {isCompleted && (
                      <button
                        onClick={() => handleReopenEvent(evt)}
                        disabled={updatingEventId === evt.id}
                        className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        title="Reopen event and set status to Active / Ongoing"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${updatingEventId === evt.id ? 'animate-spin' : ''}`} />
                        <span>{updatingEventId === evt.id ? 'Reopening Event...' : 'Reopen Event (Set Ongoing)'}</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onStartAttendance(evt.id)}
                        className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#00F7FF]" />
                        <span>{isCompleted ? 'Attendance Logs' : 'Scan Attendance'}</span>
                      </button>

                      <button
                        onClick={() => handleExportEventAttendance(evt)}
                        className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Logs</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs border border-slate-700 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* In-App Delete Event Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(eventToDelete)}
        title="Delete Event"
        message={`Are you sure you want to delete "${eventToDelete?.name}"? All associated scholar attendance records for this event will also be permanently deleted.`}
        detail={
          eventToDelete
            ? `Date: ${eventToDelete.date} • Venue: ${eventToDelete.venue} • Status: ${eventToDelete.status.toUpperCase()}`
            : undefined
        }
        confirmLabel="Yes, Delete Event"
        cancelLabel="Keep Event"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setEventToDelete(null);
        }}
      />
    </div>
  );
};
