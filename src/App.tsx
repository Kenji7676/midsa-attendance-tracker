/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { TabType, Event, Scholar, DashboardStats, AdminUser } from './types';
import { api, getStoredUser } from './services/api';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { EventsView } from './components/EventsView';
import { ScholarsView } from './components/ScholarsView';
import { AttendanceView } from './components/AttendanceView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { QrBadgeModal } from './components/QrBadgeModal';
import { CsvUploadModal } from './components/CsvUploadModal';
import { EventModal } from './components/EventModal';
import { ScholarModal } from './components/ScholarModal';
import { BatchEmailModal } from './components/BatchEmailModal';
import { realtimeSync } from './services/realtime';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import midsaLogo from './assets/midsa-logo.png';

export default function App() {
  // Real-time Clock for Footer (updates every second)
  const [currentClockTime, setCurrentClockTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClockTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(getStoredUser());
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // App Navigation & Data State
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

  // Initial Auth Check: Checks ephemeral session storage and validates with backend
  useEffect(() => {
    async function verifyAuth() {
      try {
        const session = await api.checkSession();
        if (session.authenticated && session.user) {
          setIsAuthenticated(true);
          setAdminUser(session.user);
        } else {
          setIsAuthenticated(false);
          setAdminUser(null);
        }
      } catch (err) {
        setIsAuthenticated(false);
        setAdminUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    }

    verifyAuth();

    // Listen for unauthorized events to auto-redirect to login
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setAdminUser(null);
      realtimeSync.disconnect();
    };

    window.addEventListener('midsa-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('midsa-unauthorized', handleUnauthorized);
    };
  }, []);

  // Fetch all core datasets from SQLite backend (Only when authenticated)
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
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
      if (err.message?.includes('Unauthorized')) {
        setIsAuthenticated(false);
      } else {
        setError('Failed to connect to backend server. Retrying...');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedEventId]);

  // Load data and connect realtime sync once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      loadData();
      realtimeSync.connect();

      const unsubscribe = realtimeSync.subscribe(() => {
        loadData();
      });

      return () => {
        unsubscribe();
      };
    } else {
      realtimeSync.disconnect();
    }
  }, [isAuthenticated, loadData]);

  // Handlers for Authentication
  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAuthenticated(true);
    setCurrentTab('dashboard');
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setAdminUser(null);
    setCurrentTab('dashboard');
    realtimeSync.disconnect();
  };

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

  // 1. Initial Authentication Check Loading State
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white px-4">
        <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-2xl mb-4 border border-white/20 animate-pulse">
          <img
            src={midsaLogo}
            alt="MIDSA Logo"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-[#00F7FF] mb-3" />
        <p className="text-xs font-bold tracking-wider uppercase text-blue-200">
          Securing MIDSA Attendance System...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated: Display Login Page strictly (blocks entire app from bypass)
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Authenticated: Render Main Portal Application
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-[#333333]">
      {/* Top Main Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        totalEventsCount={events.length}
        totalScholarsCount={scholars.length}
        adminUser={adminUser}
        onLogout={handleLogout}
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
              className="text-xs font-bold text-[#004ACD] hover:underline cursor-pointer"
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

            {currentTab === 'settings' && (
              <SettingsView
                user={adminUser}
                onUserUpdated={(updatedUser) => setAdminUser(updatedUser)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="bg-white border-t border-slate-200 py-3 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <span className="font-semibold text-slate-700">MIDSA Attendance System</span>
          <div className="flex items-center space-x-2 text-xs text-slate-700">
            <Clock className="w-3.5 h-3.5 text-[#004ACD] shrink-0" />
            <span className="font-semibold text-slate-700">
              {currentClockTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">
              {currentClockTime.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
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
