import React, { useState, useEffect } from 'react';
import { Event } from '../types';
import { X, Calendar, MapPin, Clock, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface EventModalProps {
  isOpen: boolean;
  eventToEdit?: Event | null;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: (event: Event) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  eventToEdit,
  onClose,
  onSuccess,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (eventToEdit) {
      setName(eventToEdit.name);
      setDate(eventToEdit.date);
      setTime(eventToEdit.time || '');
      setVenue(eventToEdit.venue);
      setDescription(eventToEdit.description || '');
      setStatus(eventToEdit.status);
    } else {
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('09:00 AM - 12:00 PM');
      setVenue('');
      setDescription('');
      setStatus('upcoming');
    }
    setError('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date.trim() || !venue.trim()) {
      setError('Please fill out Event Name, Date, and Venue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (eventToEdit) {
        await api.updateEvent(eventToEdit.id, {
          name,
          date,
          time,
          venue,
          description,
          status,
        });
      } else {
        await api.createEvent({
          name,
          date,
          time,
          venue,
          description,
          status,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ACD] text-white flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4 text-[#00F7FF]" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              {eventToEdit ? 'Edit Event Details' : 'Create New MIDSA Event'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Event Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MIDSA 2026 Scholars Summit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Event Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Time Schedule
              </label>
              <input
                type="text"
                placeholder="e.g. 09:00 AM - 04:00 PM"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Venue / Location <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. University Grand Hall / Zoom Online"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Event Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs bg-white"
            >
              <option value="upcoming">Upcoming (Planned)</option>
              <option value="ongoing">Active / Ongoing (Ready for QR Scanning)</option>
              <option value="completed">Completed (Archived)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description / Program Agenda
            </label>
            <textarea
              rows={3}
              placeholder="Provide a summary of the activity, attendees expected, objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {eventToEdit ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Event</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{eventToEdit ? 'Save Changes' : 'Create Event'}</span>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Event Confirmation Modal */}
        {eventToEdit && (
          <ConfirmModal
            isOpen={showDeleteConfirm}
            title="Delete Event"
            message={`Are you sure you want to permanently delete "${eventToEdit.name}"? All associated attendance logs will also be removed.`}
            detail={`Date: ${eventToEdit.date} • Venue: ${eventToEdit.venue}`}
            confirmLabel="Yes, Delete Event"
            cancelLabel="Keep Event"
            isDanger={true}
            isLoading={isDeleting}
            onConfirm={async () => {
              setIsDeleting(true);
              try {
                await api.deleteEvent(eventToEdit.id);
                setShowDeleteConfirm(false);
                if (onDelete) onDelete(eventToEdit);
                onSuccess();
                onClose();
              } catch (err: any) {
                alert('Failed to delete event: ' + err.message);
              } finally {
                setIsDeleting(false);
              }
            }}
            onClose={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    </div>
  );
};
