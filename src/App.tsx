/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TabType, Event, Scholar, DashboardStats } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { EventsView } from './components/EventsView';
import { ScholarsView } from './components/ScholarsView';
import { AttendanceView } from './components/AttendanceView';
import { QrBadgeModal } from './components/QrBadgeModal';
import { CsvUploadModal } from './components/CsvUploadModal';
import { EventModal } from './components/EventModal';
import { ScholarModal } from './components/ScholarModal';
import { BatchEmailModal } from './components/BatchEmailModal';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [events, setEvents] = useState<Event[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);
  const [scholarToEdit, setScholarToEdit] = useState<Scholar | null>(null);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState(false);
  const [selectedScholarForBadge, setSelectedScholarForBadge] = useState<Scholar | null>(null);

  // Fetch all core datasets from SQLite backend
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [eventsData, scholarsData, statsData] = await Promise.all([
        api.getEvents(),
        api.getScholars(),
        api.getDashboardStats(),
      ]);

      setEvents(eventsData);
      setScholars(scholarsData);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error fetching data from SQLite backend:', err);
      setError('Failed to connect to backend server. Retrying...');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers for Event operations
  const handleOpenCreateEvent = () => {
    setEventToEdit(null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEventToEdit(event);
    setIsEventModalOpen(true);
  };

  const handleEventSaved = () => {
    loadData();
  };

  // Handlers for Scholar operations
  const handleOpenRegisterScholar = () => {
    setScholarToEdit(null);
    setIsScholarModalOpen(true);
  };

  const handleEditScholar = (scholar: Scholar) => {
    setScholarToEdit(scholar);
    setIsScholarModalOpen(true);
  };

  const handleScholarSaved = (savedScholar?: Scholar) => {
    loadData();
    // If a new scholar was just created, open their QR badge immediately for preview/printing!
    if (savedScholar && !scholarToEdit) {
      setSelectedScholarForBadge(savedScholar);
    }
  };

  // Handlers for Attendance actions
  const handleStartAttendanceForEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setCurrentTab('attendance');
  };

  const activeEventsCount = events.filter((e) => e.status === 'ongoing' || e.status === 'upcoming').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-[#333333]">
      {/* Top Main Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        totalEventsCount={events.length}
        totalScholarsCount={scholars.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-bold text-[#004ACD] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#004ACD] mb-3" />
            <span className="text-xs font-bold text-slate-700">Connecting to MIDSA SQLite Database...</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Initializing relational schemas and attendance records</span>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                events={events}
                scholars={scholars}
                onNavigateTab={setCurrentTab}
                onSelectEventForAttendance={handleStartAttendanceForEvent}
                onOpenCreateEvent={handleOpenCreateEvent}
                onOpenRegisterScholar={handleOpenRegisterScholar}
                onOpenCsvUpload={() => setIsCsvModalOpen(true)}
                onOpenBatchEmailModal={() => setIsBatchEmailModalOpen(true)}
              />
            )}

            {currentTab === 'events' && (
              <EventsView
                events={events}
                scholarsCount={scholars.length}
                onOpenCreateModal={handleOpenCreateEvent}
                onEditEvent={handleEditEvent}
                onStartAttendance={handleStartAttendanceForEvent}
                onRefresh={loadData}
              />
            )}

            {currentTab === 'scholars' && (
              <ScholarsView
                scholars={scholars}
                onOpenRegisterModal={handleOpenRegisterScholar}
                onOpenCsvModal={() => setIsCsvModalOpen(true)}
                onOpenBatchEmailModal={() => setIsBatchEmailModalOpen(true)}
                onEditScholar={handleEditScholar}
                onViewQrBadge={(scholar) => setSelectedScholarForBadge(scholar)}
                onRefresh={loadData}
              />
            )}

            {currentTab === 'attendance' && (
              <AttendanceView
                events={events}
                scholars={scholars}
                selectedEventId={selectedEventId}
                onSelectEvent={(eventId) => setSelectedEventId(eventId)}
                onRefreshData={loadData}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          <span className="font-semibold text-slate-700">MIDSA Attendance System</span>
        </div>
      </footer>

      {/* Global Modals */}
      <EventModal
        isOpen={isEventModalOpen}
        eventToEdit={eventToEdit}
        onClose={() => setIsEventModalOpen(false)}
        onSuccess={handleEventSaved}
      />

      <ScholarModal
        isOpen={isScholarModalOpen}
        scholarToEdit={scholarToEdit}
        existingScholars={scholars}
        onClose={() => setIsScholarModalOpen(false)}
        onSuccess={handleScholarSaved}
      />

      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          setIsCsvModalOpen(false);
          loadData();
        }}
      />

      <BatchEmailModal
        isOpen={isBatchEmailModalOpen}
        scholars={scholars}
        onClose={() => setIsBatchEmailModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      <QrBadgeModal
        scholar={selectedScholarForBadge}
        onClose={() => setSelectedScholarForBadge(null)}
      />
    </div>
  );
}
