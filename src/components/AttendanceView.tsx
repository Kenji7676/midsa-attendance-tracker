import React, { useState, useEffect, useRef } from 'react';
import { Event, Scholar, AttendanceRecord, CheckInResponse } from '../types';
import { api } from '../services/api';
import { playSuccessSound, playWarningSound } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ConfirmModal } from './ConfirmModal';
import { formatScholarName, resolveScholarScholarshipType } from '../utils/formatters';
import {
  QrCode,
  Calendar,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  Trash2,
  UserCheck,
  RefreshCw,
  Users,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
  Pencil,
  LogIn,
  LogOut,
  Check,
  Lock,
  Play,
  RotateCcw,
  Radio,
} from 'lucide-react';

interface AttendanceViewProps {
  events: Event[];
  scholars: Scholar[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onRefreshData: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  events,
  scholars,
  selectedEventId,
  onSelectEvent,
  onRefreshData,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Scanner modal & states
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Last scan response popup/banner
  const [lastCheckIn, setLastCheckIn] = useState<CheckInResponse | null>(null);
  const [scanSuccessFeedback, setScanSuccessFeedback] = useState<CheckInResponse | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual input state (integrated sub-feature)
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualStatus, setManualStatus] = useState<'Present' | 'Late' | 'Excused'>('Present');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Filter roster tab
  const [rosterTab, setRosterTab] = useState<'checked' | 'absent'>('checked');
  const [rosterSearch, setRosterSearch] = useState('');

  // Single record delete
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  // Multi-select & Selection Mode states for uniform UX
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Sub-filter for Checked In list: all, signed_in only, signed_out only
  const [checkedSubFilter, setCheckedSubFilter] = useState<'all' | 'signed_in' | 'signed_out'>('all');
  const [signingOutRecordId, setSigningOutRecordId] = useState<string | null>(null);

  // Multi-select for Absent scholars to batch mark present
  const [selectedAbsentIds, setSelectedAbsentIds] = useState<Set<string>>(new Set());
  const [isBatchMarkingAbsent, setIsBatchMarkingAbsent] = useState(false);

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const headerAbsentCheckboxRef = useRef<HTMLInputElement | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingScanRef = useRef(false);

  // Sync selected event object
  useEffect(() => {
    if (selectedEventId) {
      const found = events.find((e) => e.id === selectedEventId);
      setSelectedEvent(found || null);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId, events]);

  // Load attendance records whenever selected event changes
  useEffect(() => {
    if (selectedEvent?.id) {
      loadAttendance(selectedEvent.id);
      setIsSelectionMode(false);
      setSelectedRecordIds(new Set());
      setSelectedAbsentIds(new Set());
    } else {
      setAttendanceRecords([]);
      setIsSelectionMode(false);
      setSelectedRecordIds(new Set());
      setSelectedAbsentIds(new Set());
    }
  }, [selectedEvent?.id]);

  const loadAttendance = async (eventId: string) => {
    setLoadingRecords(true);
    try {
      const records = await api.getAttendance(eventId);
      setAttendanceRecords(records);
    } catch (err) {
      console.error('Error fetching event attendance:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // State & handler to update event status directly from Attendance Workspace
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleUpdateEventStatus = async (newStatus: 'upcoming' | 'ongoing' | 'completed') => {
    if (!selectedEvent) return;
    setIsUpdatingStatus(true);
    try {
      if (newStatus !== 'ongoing' && isScannerModalOpen) {
        handleCloseScannerModal();
      }
      const updated = await api.updateEvent(selectedEvent.id, {
        ...selectedEvent,
        status: newStatus,
      });
      // Optimistically update local selectedEvent immediately so the UI reflects the change with zero lag
      setSelectedEvent((prev) => (prev ? { ...prev, ...updated, status: newStatus } : null));
      onRefreshData();
    } catch (err: any) {
      console.error('Failed to update event status:', err);
      alert('Failed to update event status: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Auto-close scanner modal immediately if the event is marked as completed or upcoming
  useEffect(() => {
    if (selectedEvent && selectedEvent.status !== 'ongoing') {
      if (isScannerModalOpen) {
        handleCloseScannerModal();
      }
    }
  }, [selectedEvent?.status, isScannerModalOpen]);

  // Start QR Scanner via Html5Qrcode
  const startScanner = async () => {
    setScannerError(null);
    setIsScanning(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const element = document.getElementById('reader');
      if (!element) {
        throw new Error('Scanner element not found in DOM');
      }

      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {
          // Ignore clear error
        }
      }

      const html5QrCode = new Html5Qrcode('reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      const isMobile = window.innerWidth < 640;
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          // Calculate an exact square that fits safely within both mobile and desktop viewfinders
          const calculated = Math.floor(minEdge * (isMobile ? 0.72 : 0.65));
          const edgeSize = Math.min(Math.max(calculated, 160), Math.max(minEdge - 24, 160));
          return { width: edgeSize, height: edgeSize };
        },
        aspectRatio: isMobile ? 1.0 : 1.333333,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        async (decodedText) => {
          if (isProcessingScanRef.current) return;
          isProcessingScanRef.current = true;
          await handleProcessScan(decodedText);
          setTimeout(() => {
            isProcessingScanRef.current = false;
          }, 1800);
        },
        () => {}
      );
    } catch (err: any) {
      console.error('Failed to start camera scanner:', err);
      setIsScanning(false);
      setScannerError(
        'Unable to access camera. Please allow camera permissions in your browser or use the Manual Lookup sub-feature.'
      );
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop warning:', err);
      }
    }
    setIsScanning(false);
  };

  // Open & Close Fullscreen Scanner Pop-Up
  const handleOpenScannerModal = () => {
    if (!selectedEvent) return;
    if (selectedEvent.status === 'upcoming') {
      alert('The QR Scanner is unavailable because this event is Upcoming. Please mark the event as Ongoing / Active first.');
      return;
    }
    if (selectedEvent.status === 'completed') {
      alert('The QR Scanner is closed because this event is marked as Completed.');
      return;
    }
    setScanSuccessFeedback(null);
    setIsScannerModalOpen(true);
  };

  const handleCloseScannerModal = async () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setScanSuccessFeedback(null);
    await stopScanner();
    setIsScannerModalOpen(false);
  };

  // Switch between front/back camera
  const toggleCameraFacing = async () => {
    await stopScanner();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setTimeout(() => {
      startScanner();
    }, 250);
  };

  // Start scanner when modal opens, stop when closes
  useEffect(() => {
    if (isScannerModalOpen) {
      startScanner();
    } else {
      stopScanner();
    }
  }, [isScannerModalOpen]);

  // Disable scrolling when QR scanner pop-up is active
  useEffect(() => {
    if (isScannerModalOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalBodyTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalBodyTouchAction;
      };
    }
  }, [isScannerModalOpen]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Keyboard shortcut: Esc to close scanner modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScannerModalOpen) {
        handleCloseScannerModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScannerModalOpen]);

  // Toggle selection mode via circular pencil button
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedRecordIds(new Set());
      setSelectedAbsentIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  };

  // Process a scanned QR code
  const handleProcessScan = async (qrString: string) => {
    if (!selectedEvent) return;

    try {
      const res = await api.checkIn({
        event_id: selectedEvent.id,
        qr_code: qrString,
        check_in_method: 'QR Scanner',
        status: 'Present',
      });

      setLastCheckIn(res);

      if (res.success) {
        setScanSuccessFeedback(res);
        if (audioFeedback) playSuccessSound();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#00F7FF', '#004ACD', '#0165CB', '#FFFFFF'],
        });
        loadAttendance(selectedEvent.id);
        onRefreshData();

        // Auto-close scanner pop up after acknowledging successful student QR scan
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
        }
        autoCloseTimerRef.current = setTimeout(() => {
          handleCloseScannerModal();
        }, 1400);
      } else if (res.alreadyCheckedIn) {
        if (audioFeedback) playWarningSound();
      } else {
        if (audioFeedback) playWarningSound();
      }
    } catch (err: any) {
      if (audioFeedback) playWarningSound();
      setLastCheckIn({
        success: false,
        message: err.message || 'Check-in failed. Please retry.',
      });
    }
  };

  // Manual Check-In
  const handleManualCheckIn = async (scholarIdOrNumber: string, statusOverride?: 'Present' | 'Late' | 'Excused') => {
    if (!selectedEvent || !scholarIdOrNumber.trim()) return;
    if (selectedEvent.status === 'upcoming') {
      alert('Attendance recording is unavailable because this event is Upcoming. Please mark the event as Ongoing / Active first.');
      return;
    }
    if (selectedEvent.status === 'completed') {
      alert('Attendance recording is closed because this event is marked as Completed.');
      return;
    }
    setIsManualSubmitting(true);

    try {
      const res = await api.checkIn({
        event_id: selectedEvent.id,
        student_id: scholarIdOrNumber.trim(),
        check_in_method: 'Manual Entry',
        status: statusOverride || manualStatus,
      });

      setLastCheckIn(res);
      setManualQuery('');

      if (res.success) {
        if (audioFeedback) playSuccessSound();
        loadAttendance(selectedEvent.id);
        onRefreshData();
      } else {
        if (audioFeedback) playWarningSound();
      }
    } catch (err: any) {
      if (audioFeedback) playWarningSound();
      setLastCheckIn({
        success: false,
        message: err.message || 'Check-in failed.',
      });
    } finally {
      setIsManualSubmitting(false);
    }
  };

  // Manual Sign-Out for a scholar with an existing sign-in record
  const handleManualSignOut = async (recordId: string) => {
    if (!selectedEvent) return;
    if (selectedEvent.status === 'upcoming') {
      alert('Cannot sign out: Event is Upcoming.');
      return;
    }
    setSigningOutRecordId(recordId);
    try {
      const res = await api.signOut(recordId, 'Manual Entry');
      if (res.success) {
        if (audioFeedback) playSuccessSound();
        setLastCheckIn({
          success: true,
          action: 'sign_out',
          alreadyCheckedIn: false,
          message: res.message || `Successfully signed out ${res.attendanceRecord?.scholar_name || 'scholar'}!`,
          scholar: res.scholar || scholars.find((s) => s.id === res.attendanceRecord?.scholar_id || s.student_id === res.attendanceRecord?.student_id),
          attendanceRecord: res.attendanceRecord,
        });
        loadAttendance(selectedEvent.id);
        onRefreshData();
      }
    } catch (err: any) {
      if (audioFeedback) playWarningSound();
      alert('Failed to record sign out: ' + err.message);
    } finally {
      setSigningOutRecordId(null);
    }
  };

  // Delete Attendance Record (Single)
  const handleDeleteAttendance = (record: AttendanceRecord) => {
    setRecordToDelete(record);
  };

  const handleConfirmDeleteAttendance = async () => {
    if (!recordToDelete) return;
    setIsDeletingRecord(true);
    try {
      await api.deleteAttendance(recordToDelete.id);
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        next.delete(recordToDelete.id);
        return next;
      });
      setRecordToDelete(null);
      if (selectedEvent) {
        loadAttendance(selectedEvent.id);
        onRefreshData();
      }
    } catch (err: any) {
      alert('Failed to remove record: ' + err.message);
    } finally {
      setIsDeletingRecord(false);
    }
  };

  // Batch Delete Attendance Records
  const handleConfirmBatchDelete = async () => {
    if (selectedRecordIds.size === 0 || !selectedEvent) return;
    setIsBatchDeleting(true);
    try {
      const ids = Array.from(selectedRecordIds);
      await api.batchDeleteAttendance(ids);
      setSelectedRecordIds(new Set());
      setShowBatchDeleteModal(false);
      loadAttendance(selectedEvent.id);
      onRefreshData();
    } catch (err: any) {
      alert('Failed to delete selected records: ' + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Batch Mark Absent Scholars as Present
  const handleBatchMarkAbsentPresent = async () => {
    if (selectedAbsentIds.size === 0 || !selectedEvent) return;
    if (selectedEvent.status !== 'ongoing') {
      alert(`Cannot check in scholars: Event is ${selectedEvent.status}. Mark the event as Ongoing / Active first.`);
      return;
    }
    setIsBatchMarkingAbsent(true);
    try {
      const studentIdsToMark = scholars
        .filter((s) => selectedAbsentIds.has(s.id))
        .map((s) => s.student_id);

      for (const sId of studentIdsToMark) {
        await api.checkIn({
          event_id: selectedEvent.id,
          student_id: sId,
          check_in_method: 'Manual Batch',
          status: 'Present',
        });
      }

      if (audioFeedback) playSuccessSound();
      setSelectedAbsentIds(new Set());
      loadAttendance(selectedEvent.id);
      onRefreshData();
    } catch (err: any) {
      alert('Failed to mark scholars present: ' + err.message);
    } finally {
      setIsBatchMarkingAbsent(false);
    }
  };

  // Roster calculations
  const checkedScholarIds = new Set(attendanceRecords.map((a) => a.scholar_id));
  const absentScholars = scholars.filter((s) => !checkedScholarIds.has(s.id));

  const signedInOnlyRecords = attendanceRecords.filter((a) => !a.sign_out_time);
  const signedOutRecords = attendanceRecords.filter((a) => Boolean(a.sign_out_time));

  const filteredChecked = attendanceRecords.filter((r) => {
    if (checkedSubFilter === 'signed_in' && r.sign_out_time) return false;
    if (checkedSubFilter === 'signed_out' && !r.sign_out_time) return false;
    if (!rosterSearch) return true;
    const scholar = scholars.find((s) => s.id === r.scholar_id || s.student_id === r.student_id);
    const q = rosterSearch.toLowerCase();
    const name = (scholar ? formatScholarName(scholar) : r.scholar_name || '').toLowerCase();
    const sId = (scholar?.student_id || r.student_id).toLowerCase();
    const col = (scholar?.college || r.college || '').toLowerCase();
    const prog = (scholar?.year_program || r.year_program || '').toLowerCase();
    return name.includes(q) || sId.includes(q) || col.includes(q) || prog.includes(q);
  });

  const filteredAbsent = absentScholars.filter((s) => {
    if (!rosterSearch) return true;
    const q = rosterSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.college.toLowerCase().includes(q)
    );
  });

  // Select Multiple & Select All Logic (Checked In Tab)
  const isAllCheckedSelected =
    filteredChecked.length > 0 && filteredChecked.every((r) => selectedRecordIds.has(r.id));
  const isSomeCheckedSelected =
    filteredChecked.some((r) => selectedRecordIds.has(r.id)) && !isAllCheckedSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeCheckedSelected;
    }
  }, [isSomeCheckedSelected]);

  const handleToggleSelectAllChecked = () => {
    if (isAllCheckedSelected) {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredChecked.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredChecked.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleToggleRecordSelection = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select Multiple & Select All Logic (Absent Tab)
  const isAllAbsentSelected =
    filteredAbsent.length > 0 && filteredAbsent.every((s) => selectedAbsentIds.has(s.id));
  const isSomeAbsentSelected =
    filteredAbsent.some((s) => selectedAbsentIds.has(s.id)) && !isAllAbsentSelected;

  useEffect(() => {
    if (headerAbsentCheckboxRef.current) {
      headerAbsentCheckboxRef.current.indeterminate = isSomeAbsentSelected;
    }
  }, [isSomeAbsentSelected]);

  const handleToggleSelectAllAbsent = () => {
    if (isAllAbsentSelected) {
      setSelectedAbsentIds((prev) => {
        const next = new Set(prev);
        filteredAbsent.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedAbsentIds((prev) => {
        const next = new Set(prev);
        filteredAbsent.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const handleToggleAbsentSelection = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Export Attendance to CSV (supports exporting all or just selected)
  const handleExportCSV = (onlySelected: boolean = false) => {
    if (!selectedEvent || attendanceRecords.length === 0) {
      alert('No attendance records to export for this event.');
      return;
    }

    const targetRecords = onlySelected
      ? attendanceRecords.filter((r) => selectedRecordIds.has(r.id))
      : attendanceRecords;

    if (targetRecords.length === 0) {
      alert('No records selected to export.');
      return;
    }

    const headers = [
      'Student ID',
      'Scholar Name',
      'Scholarship Type',
      'College',
      'Year/Program',
      'Email',
      'Sign-in Timestamp',
      'Sign-out Timestamp',
      'Status',
      'Sign-in Method',
      'Sign-out Method',
      'Event Name',
    ];

    const rows = targetRecords.map((r) => {
      const scholar = scholars.find((s) => s.id === r.scholar_id || s.student_id === r.student_id);
      const signInStr = r.sign_in_time || r.timestamp ? new Date(r.sign_in_time || r.timestamp).toLocaleString() : '';
      const signOutStr = r.sign_out_time ? new Date(r.sign_out_time).toLocaleString() : 'Pending Sign-Out';
      return [
        `"${scholar?.student_id || r.student_id}"`,
        `"${scholar ? formatScholarName(scholar) : formatScholarName(r.scholar_name || '')}"`,
        `"${scholar ? resolveScholarScholarshipType(scholar) : ''}"`,
        `"${scholar?.college || r.college || ''}"`,
        `"${scholar?.year_program || r.year_program || ''}"`,
        `"${scholar?.email || r.email || ''}"`,
        `"${signInStr}"`,
        `"${signOutStr}"`,
        `"${r.status}"`,
        `"${r.check_in_method}"`,
        `"${r.sign_out_method || ''}"`,
        `"${selectedEvent.name}"`,
      ];
    });

    const csvString = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filenamePrefix = onlySelected
      ? `${selectedEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}_Selected_Attendance`
      : `${selectedEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance`;
    link.setAttribute('download', `${filenamePrefix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Manual query matches for instant search in the integrated lookup feature
  const manualSearchMatches = manualQuery.trim()
    ? scholars
        .filter((s) => {
          const q = manualQuery.toLowerCase().trim();
          return (
            s.student_id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q)
          );
        })
        .slice(0, 5)
    : [];

  const attendancePercentage =
    scholars.length > 0 ? Math.round((attendanceRecords.length / scholars.length) * 100) : 0;

  // Find the latest attendance record regardless if it is sign in or sign out
  const latestAttendanceRecord = React.useMemo(() => {
    if (attendanceRecords.length === 0) return null;
    return [...attendanceRecords].sort((a, b) => {
      const timeA = new Date(a.sign_out_time || a.sign_in_time || a.timestamp).getTime();
      const timeB = new Date(b.sign_out_time || b.sign_in_time || b.timestamp).getTime();
      return timeB - timeA;
    })[0];
  }, [attendanceRecords]);

  // Unified latest person display item: shows the latest person regardless if action was sign in or sign out
  const latestPersonDisplay = React.useMemo(() => {
    if (lastCheckIn?.attendanceRecord && lastCheckIn.attendanceRecord.event_id === selectedEvent?.id) {
      const rec = lastCheckIn.attendanceRecord;
      const sch = lastCheckIn.scholar || scholars.find((s) => s.id === rec.scholar_id || s.student_id === rec.student_id);
      const isSignOut = lastCheckIn.action === 'sign_out' || Boolean(rec.sign_out_time && !lastCheckIn.alreadyCheckedIn);
      return {
        scholar: sch,
        attendanceRecord: rec,
        action: (isSignOut ? 'sign_out' : 'sign_in') as 'sign_out' | 'sign_in',
        message: lastCheckIn.message,
        isFreshScan: true,
      };
    }

    if (latestAttendanceRecord) {
      const sch = scholars.find(
        (s) => s.id === latestAttendanceRecord.scholar_id || s.student_id === latestAttendanceRecord.student_id
      );
      const isSignOut = Boolean(latestAttendanceRecord.sign_out_time);
      return {
        scholar: sch,
        attendanceRecord: latestAttendanceRecord,
        action: (isSignOut ? 'sign_out' : 'sign_in') as 'sign_out' | 'sign_in',
        message: isSignOut ? 'Most recent activity: Signed Out' : 'Most recent activity: Signed In',
        isFreshScan: false,
      };
    }

    return null;
  }, [lastCheckIn, latestAttendanceRecord, selectedEvent?.id, scholars]);

  return (
    <div className="space-y-6">
      {/* Event Selection Header Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Select Event for Attendance Recording
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose the MIDSA event to activate live QR scanning and real-time scholar check-in.
            </p>
          </div>

          {/* Event Dropdown Picker */}
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-80">
              <select
                id="event-picker-dropdown"
                value={selectedEvent?.id || ''}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border-2 border-[#004ACD] bg-white text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#00F7FF] shadow-xs cursor-pointer appearance-none"
              >
                <option value="">-- Select an Event to Take Attendance --</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name} ({evt.status.toUpperCase()}) - {evt.date}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#004ACD] absolute right-3 top-3 pointer-events-none" />
            </div>

            {selectedEvent && (
              <button
                onClick={() => loadAttendance(selectedEvent.id)}
                title="Refresh attendance records"
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Event Details Strip */}
        {selectedEvent && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-center space-x-2 text-slate-700">
              <Calendar className="w-4 h-4 text-[#004ACD]" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium uppercase">Date</span>
                <span className="font-bold">{selectedEvent.date}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <Clock className="w-4 h-4 text-[#004ACD]" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium uppercase">Time</span>
                <span className="font-bold truncate">{selectedEvent.time || 'All Day'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <MapPin className="w-4 h-4 text-[#004ACD]" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium uppercase">Venue</span>
                <span className="font-bold truncate max-w-[150px]">{selectedEvent.venue}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <Users className="w-4 h-4 text-[#004ACD]" />
              <div>
                <span className="block text-[10px] text-slate-400 font-medium uppercase">Attendance</span>
                <span className="font-bold text-[#004ACD]">
                  {attendanceRecords.length} / {scholars.length} ({attendancePercentage}%)
                </span>
                <div className="text-[10px] text-slate-500 font-medium flex gap-1.5 mt-0.5">
                  <span className="text-emerald-700 font-bold">{signedInOnlyRecords.length} In</span>
                  <span>•</span>
                  <span className="text-cyan-700 font-bold">{signedOutRecords.length} Out</span>
                </div>
              </div>
            </div>

            {/* Event Status & Quick Action Switch */}
            <div className="flex items-center space-x-2 text-slate-700">
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {selectedEvent.status === 'ongoing' ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                ) : selectedEvent.status === 'upcoming' ? (
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] text-slate-400 font-medium uppercase">Event Status</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      selectedEvent.status === 'ongoing'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : selectedEvent.status === 'upcoming'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {selectedEvent.status === 'ongoing' ? 'Ongoing / Active' : selectedEvent.status}
                  </span>

                  {selectedEvent.status === 'completed' && (
                    <button
                      onClick={() => handleUpdateEventStatus('ongoing')}
                      disabled={isUpdatingStatus}
                      className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      title="Reopen event and set status to Active / Ongoing"
                    >
                      <RotateCcw className={`w-2.5 h-2.5 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
                      <span>{isUpdatingStatus ? 'Reopening...' : 'Reopen'}</span>
                    </button>
                  )}

                  {selectedEvent.status === 'upcoming' && (
                    <button
                      onClick={() => handleUpdateEventStatus('ongoing')}
                      disabled={isUpdatingStatus}
                      className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 hover:bg-amber-500 text-white flex items-center space-x-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      title="Activate event and set status to Active / Ongoing"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{isUpdatingStatus ? 'Activating...' : 'Activate'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Attendance Workspace: Revealed only once an event is selected */}
      {selectedEvent && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 1. QR Scanner Launcher Banner Card (Spans across page) */}
          {selectedEvent.status === 'upcoming' ? (
            /* Upcoming State: Scanner is unavailable */
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight">QR Scanner Unavailable</h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 uppercase">
                    Event is Upcoming
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 max-w-xl">
                  The QR Scanner and attendance recording are unavailable while this event is marked as <span className="font-bold text-amber-300">Upcoming</span>. Mark the event as <span className="font-bold text-[#00F7FF]">Active / Ongoing</span> to unlock attendance scanning.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleUpdateEventStatus('ongoing')}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isUpdatingStatus ? 'Activating...' : 'Mark as Active / Ongoing'}</span>
                </button>

                <button
                  disabled
                  title="Scanner is locked until event is marked as Ongoing / Active"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-bold text-xs flex items-center space-x-2 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Scanner Unavailable</span>
                </button>
              </div>
            </div>
          ) : selectedEvent.status === 'completed' ? (
            /* Completed State: Scanner is closed */
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md border-2 border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight">Attendance Scanner Closed</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-600 uppercase">
                    Event Completed
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-xl">
                  This event has concluded and is marked as <span className="font-bold text-white">Completed</span>. Attendance scanning is closed. All logs are preserved and available for review and CSV export.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  id="reopen-event-btn"
                  onClick={() => handleUpdateEventStatus('ongoing')}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/40 border border-emerald-400 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Reopen this completed event and set status to Active / Ongoing"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingStatus ? 'Reopening Event...' : 'Reopen Event (Set Ongoing)'}</span>
                </button>

                <button
                  disabled
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-bold text-xs flex items-center space-x-2 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Scanner Closed</span>
                </button>
              </div>
            </div>
          ) : (
            /* Ongoing State: Scanner is available & ready */
            <div className="bg-gradient-to-r from-[#004ACD] via-[#0165CB] to-[#004ACD] text-white rounded-2xl p-5 shadow-md border border-blue-400/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-white/15 text-[#00F7FF] flex items-center justify-center border border-[#00F7FF]/30">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight">QR Scanner Ready</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/40 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Event Active / Ongoing</span>
                  </span>
                </div>
                <p className="text-xs text-blue-100 max-w-xl">
                  Scan scholar QR badges rapidly. 1st scan records <span className="font-bold text-[#00F7FF]">Sign In</span>; the next scan for the same event automatically records <span className="font-bold text-[#00F7FF]">Sign Out</span>.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={() => setAudioFeedback(!audioFeedback)}
                  title={audioFeedback ? 'Sound effects enabled' : 'Sound effects muted'}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center space-x-1.5 text-xs font-semibold cursor-pointer border border-white/20"
                >
                  {audioFeedback ? (
                    <>
                      <Volume2 className="w-4 h-4 text-[#00F7FF]" />
                      <span className="text-[11px] hidden md:inline">Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-slate-300" />
                      <span className="text-[11px] hidden md:inline">Muted</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleUpdateEventStatus('completed')}
                  disabled={isUpdatingStatus}
                  className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer"
                  title="Mark this event as completed to finalize attendance"
                >
                  <span>Mark Completed</span>
                </button>

                <button
                  id="launch-qr-scanner-btn"
                  onClick={handleOpenScannerModal}
                  className="px-5 py-2.5 rounded-xl bg-[#00F7FF] hover:bg-cyan-300 text-slate-900 font-extrabold text-xs shadow-lg shadow-cyan-500/30 transition-all flex items-center space-x-2 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Camera className="w-4 h-4 text-slate-900" />
                  <span>Launch QR Scanner</span>
                </button>
              </div>
            </div>
          )}

          {/* Latest Scholar Attendance Activity Card (Always shows latest person regardless if sign in or sign out) */}
          {latestPersonDisplay ? (
            <div
              className={`p-4 rounded-2xl border text-xs shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
                latestPersonDisplay.action === 'sign_out'
                  ? 'bg-gradient-to-r from-cyan-50/90 via-sky-50/70 to-blue-50/60 border-cyan-300 text-cyan-950'
                  : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-green-50/60 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  {latestPersonDisplay.action === 'sign_out' ? (
                    <div className="w-10 h-10 rounded-xl bg-[#004ACD] text-white flex items-center justify-center shrink-0 shadow-sm border border-[#00F7FF]/30">
                      <LogOut className="w-5 h-5 text-[#00F7FF]" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm border border-emerald-400/30">
                      <LogIn className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          latestPersonDisplay.action === 'sign_out'
                            ? 'bg-[#004ACD] text-[#00F7FF]'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        {latestPersonDisplay.action === 'sign_out' ? 'Latest Person: Signed Out' : 'Latest Person: Signed In'}
                      </span>
                      {latestPersonDisplay.isFreshScan && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.2 rounded-full border border-amber-300 animate-pulse">
                          Just Now
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-sm sm:text-base text-slate-900 mt-0.5">
                      {formatScholarName(latestPersonDisplay.scholar || latestPersonDisplay.attendanceRecord.scholar_name || 'Scholar')}
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Student ID: <span className="font-mono font-bold text-[#004ACD]">{latestPersonDisplay.scholar?.student_id || latestPersonDisplay.attendanceRecord.student_id}</span> • {latestPersonDisplay.scholar?.college || latestPersonDisplay.attendanceRecord.college || 'MIDSA Scholar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-start sm:self-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      latestPersonDisplay.action === 'sign_out'
                        ? 'bg-cyan-100/80 text-cyan-900 border-cyan-300'
                        : 'bg-emerald-100/80 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    {latestPersonDisplay.action === 'sign_out' ? (
                      <>
                        <LogOut className="w-3.5 h-3.5 mr-1 text-[#004ACD]" />
                        <span>Signed Out</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                        <span>Signed In</span>
                      </>
                    )}
                  </span>

                  {lastCheckIn && (
                    <button
                      onClick={() => setLastCheckIn(null)}
                      title="Dismiss popup notice"
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-black/5 cursor-pointer text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Roster-level Details for the Latest Person */}
              <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="bg-white/60 p-2 rounded-xl border border-black/5">
                  <span className="block text-[10px] text-slate-500 font-medium uppercase">Sign-In Time</span>
                  <span className="font-bold text-emerald-800 text-xs">
                    {latestPersonDisplay.attendanceRecord.sign_in_time
                      ? new Date(latestPersonDisplay.attendanceRecord.sign_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : latestPersonDisplay.attendanceRecord.timestamp
                      ? new Date(latestPersonDisplay.attendanceRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'Recorded'}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    via {latestPersonDisplay.attendanceRecord.check_in_method || 'QR Scanner'}
                  </span>
                </div>

                <div className="bg-white/60 p-2 rounded-xl border border-black/5">
                  <span className="block text-[10px] text-slate-500 font-medium uppercase">Sign-Out Time</span>
                  {latestPersonDisplay.attendanceRecord.sign_out_time ? (
                    <>
                      <span className="font-bold text-cyan-800 text-xs">
                        {new Date(latestPersonDisplay.attendanceRecord.sign_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        via {latestPersonDisplay.attendanceRecord.sign_out_method || 'QR Scanner'}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-400 italic text-xs">
                      Pending (next scan)
                    </span>
                  )}
                </div>

                <div className="bg-white/60 p-2 rounded-xl border border-black/5">
                  <span className="block text-[10px] text-slate-500 font-medium uppercase">Year & Program</span>
                  <span className="font-bold text-slate-800 truncate block text-xs">
                    {latestPersonDisplay.scholar?.year_program || latestPersonDisplay.attendanceRecord.year_program || 'N/A'}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 truncate">
                    {latestPersonDisplay.scholar?.academic_program || 'DOST Scholar'}
                  </span>
                </div>

                <div className="bg-white/60 p-2 rounded-xl border border-black/5">
                  <span className="block text-[10px] text-slate-500 font-medium uppercase">Latest Action Recorded</span>
                  <span className="font-bold text-slate-800 block text-xs">
                    {latestPersonDisplay.action === 'sign_out' ? 'Sign Out Complete' : 'Sign In Active'}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                    {latestPersonDisplay.message || 'Updated in live roster'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-slate-600 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="font-bold text-slate-700 block">No Attendance Recorded Yet</span>
                  <span className="text-[11px] text-slate-500">
                    {selectedEvent.status === 'upcoming'
                      ? 'The event is Upcoming. Mark it as Active/Ongoing to unlock live scanning.'
                      : selectedEvent.status === 'completed'
                      ? 'This event has concluded with 0 records logged.'
                      : 'Launch the QR Scanner or use Manual Lookup to record scholar attendance.'}
                  </span>
                </div>
              </div>
              {selectedEvent.status === 'ongoing' && (
                <button
                  onClick={handleOpenScannerModal}
                  className="px-3 py-1.5 rounded-lg bg-[#004ACD] hover:bg-[#0165CB] text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Start Scanning
                </button>
              )}
            </div>
          )}

          {/* 2. Live Attendance Roster Section with Circle Pencil Button and Selection Mode */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden w-full relative flex flex-col">
            {/* Roster Main Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base flex flex-wrap items-center gap-2">
                  <span>Live Attendance Roster</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#004ACD] text-[#00F7FF]">
                    {attendanceRecords.length} Total
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {signedInOnlyRecords.length} Signed In
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800">
                    {signedOutRecords.length} Signed Out
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time attendance log for <span className="font-semibold text-slate-700">{selectedEvent.name}</span>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowManualLookup(!showManualLookup)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    showManualLookup
                      ? 'bg-[#004ACD] text-white shadow-xs'
                      : 'bg-blue-50 text-[#004ACD] border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{showManualLookup ? 'Hide Manual Lookup' : 'Manual Lookup'}</span>
                </button>

                <button
                  onClick={() => handleExportCSV(false)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#004ACD] text-slate-700 hover:text-[#004ACD] text-xs font-bold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export All CSV</span>
                </button>
              </div>
            </div>

            {/* Integrated Manual Lookup Sub-Feature Panel (Expandable / Inline) */}
            {showManualLookup && (
              <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-200 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <UserCheck className="w-4 h-4 text-[#004ACD]" />
                    <span>Manual Lookup & Quick Check-In</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Search by Student ID, Name, or select from directory</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type Student ID or scholar name (e.g. 2024-0001)..."
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualCheckIn(manualQuery);
                      }}
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                    />
                    {manualQuery && (
                      <button
                        onClick={() => setManualQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as any)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Excused">Excused</option>
                  </select>

                  <button
                    onClick={() => handleManualCheckIn(manualQuery)}
                    disabled={!manualQuery.trim() || isManualSubmitting || selectedEvent.status !== 'ongoing'}
                    title={
                      selectedEvent.status !== 'ongoing'
                        ? `Attendance is unavailable because the event is ${selectedEvent.status}.`
                        : undefined
                    }
                    className="px-5 py-2 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400 transition-colors shrink-0 flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Check In</span>
                  </button>
                </div>

                {/* Event Status Warning for Manual Entry */}
                {selectedEvent.status !== 'ongoing' && (
                  <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>
                      Attendance check-ins are restricted because this event is currently{' '}
                      <strong className="capitalize">{selectedEvent.status}</strong>. Mark event as Ongoing above to enable entry.
                    </span>
                  </div>
                )}

                {/* Instant Search Results Dropdown Preview */}
                {manualSearchMatches.length > 0 && (
                  <div className="mt-2.5 p-2 bg-white rounded-xl border border-blue-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Matching Scholars:
                    </span>
                    {manualSearchMatches.map((sch) => {
                      const existingRecord = attendanceRecords.find(
                        (a) => a.scholar_id === sch.id || a.student_id === sch.student_id
                      );
                      const isChecked = Boolean(existingRecord);
                      const isSignedOut = Boolean(existingRecord?.sign_out_time);

                      return (
                        <div
                          key={sch.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{formatScholarName(sch)}</span>
                            <span className="text-slate-500 text-[11px] ml-2">
                              {sch.student_id} • {sch.year_program}
                            </span>
                          </div>
                          <div>
                            {!isChecked ? (
                              <button
                                onClick={() => handleManualCheckIn(sch.student_id)}
                                disabled={selectedEvent.status !== 'ongoing'}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold transition-colors flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <LogIn className="w-3 h-3" />
                                <span>Sign In</span>
                              </button>
                            ) : !isSignedOut ? (
                              <button
                                onClick={() => handleManualCheckIn(sch.student_id)}
                                disabled={selectedEvent.status !== 'ongoing'}
                                className="px-2.5 py-1 rounded-lg bg-[#004ACD] hover:bg-[#0165CB] disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-bold transition-colors flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
                                title="Record Sign Out"
                              >
                                <LogOut className="w-3 h-3 text-[#00F7FF]" />
                                <span>Sign Out</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-cyan-700 text-[11px] font-semibold bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                <CheckCircle2 className="w-3 h-3 text-cyan-600" />
                                <span>Completed</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Batch Action Toolbar: Visible when in Selection Mode and 1 or more items are selected */}
            {isSelectionMode && rosterTab === 'checked' && selectedRecordIds.size > 0 && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-[#004ACD] text-white text-xs font-extrabold shadow-xs">
                    {selectedRecordIds.size} Selected
                  </span>
                  <span className="text-xs text-slate-600">
                    of {filteredChecked.length} filtered attendees
                  </span>
                  {!isAllCheckedSelected && (
                    <button
                      onClick={handleToggleSelectAllChecked}
                      className="text-xs font-bold text-[#004ACD] hover:underline"
                    >
                      Select all {filteredChecked.length}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRecordIds(new Set())}
                    className="text-xs text-slate-500 hover:text-slate-800 underline ml-1"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExportCSV(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#004ACD] text-slate-700 hover:text-[#004ACD] text-xs font-bold shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#004ACD]" />
                    <span>Export Selected CSV ({selectedRecordIds.size})</span>
                  </button>

                  <button
                    id="batch-delete-attendance-btn"
                    onClick={() => setShowBatchDeleteModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedRecordIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Batch Action Toolbar for Absent Scholars tab in Selection Mode */}
            {isSelectionMode && rosterTab === 'absent' && selectedAbsentIds.size > 0 && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-extrabold shadow-xs">
                    {selectedAbsentIds.size} Selected
                  </span>
                  <span className="text-xs text-slate-600">
                    of {filteredAbsent.length} absent scholars
                  </span>
                  {!isAllAbsentSelected && (
                    <button
                      onClick={handleToggleSelectAllAbsent}
                      className="text-xs font-bold text-amber-700 hover:underline"
                    >
                      Select all {filteredAbsent.length}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedAbsentIds(new Set())}
                    className="text-xs text-slate-500 hover:text-slate-800 underline ml-1"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBatchMarkAbsentPresent}
                    disabled={isBatchMarkingAbsent}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#00F7FF]" />
                    <span>
                      {isBatchMarkingAbsent ? 'Marking Present...' : `Mark Selected Present (${selectedAbsentIds.size})`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Roster Tabs & Search Filter */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => {
                      setRosterTab('checked');
                      setSelectedRecordIds(new Set());
                      setSelectedAbsentIds(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      rosterTab === 'checked'
                        ? 'bg-white text-[#004ACD] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Attended ({attendanceRecords.length})
                  </button>
                  <button
                    onClick={() => {
                      setRosterTab('absent');
                      setSelectedRecordIds(new Set());
                      setSelectedAbsentIds(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      rosterTab === 'absent'
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending / Absent ({absentScholars.length})
                  </button>
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search attendee by name or ID..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                  />
                </div>
              </div>

              {/* Sub-filter tabs when in Attended tab */}
              {rosterTab === 'checked' && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100/80 text-[11px]">
                  <span className="text-slate-400 font-medium">Filter:</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 font-medium">
                    <button
                      onClick={() => setCheckedSubFilter('all')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        checkedSubFilter === 'all'
                          ? 'bg-white text-slate-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({attendanceRecords.length})
                    </button>
                    <button
                      onClick={() => setCheckedSubFilter('signed_in')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                        checkedSubFilter === 'signed_in'
                          ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Signed In Only ({signedInOnlyRecords.length})</span>
                    </button>
                    <button
                      onClick={() => setCheckedSubFilter('signed_out')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                        checkedSubFilter === 'signed_out'
                          ? 'bg-white text-cyan-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                      <span>Signed Out / Completed ({signedOutRecords.length})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Roster Table Content */}
            <div className="max-h-[480px] overflow-y-auto min-h-[260px]">
              {rosterTab === 'checked' ? (
                filteredChecked.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <QrCode className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No attendance records match filter</p>
                    <p className="text-slate-400 mt-0.5">Start scanning scholar QR codes or use Manual Lookup to log check-ins.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        {/* Select All Checkbox Column - Only shown in Selection Mode */}
                        {isSelectionMode && (
                          <th className="py-2.5 px-3 w-10 text-center animate-in fade-in duration-150">
                            <input
                              type="checkbox"
                              ref={headerCheckboxRef}
                              checked={isAllCheckedSelected}
                              onChange={handleToggleSelectAllChecked}
                              className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] cursor-pointer"
                              title="Select All Attendees"
                            />
                          </th>
                        )}
                        <th className="py-2.5 px-4">Scholar</th>
                        <th className="py-2.5 px-3">Sign In</th>
                        <th className="py-2.5 px-3">Sign Out</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredChecked.map((rec) => {
                        const isSelected = selectedRecordIds.has(rec.id);
                        const scholar = scholars.find((s) => s.id === rec.scholar_id || s.student_id === rec.student_id);
                        const displayStudentId = scholar?.student_id || rec.student_id;
                        const displayName = scholar ? formatScholarName(scholar) : formatScholarName(rec.scholar_name);
                        const displayYearProgram = scholar?.year_program || rec.year_program;
                        const displayScholarship = scholar ? resolveScholarScholarshipType(scholar) : '';
                        const signInTimeStr = rec.sign_in_time || rec.timestamp;
                        const hasSignedOut = Boolean(rec.sign_out_time);

                        return (
                          <tr
                            key={rec.id}
                            onClick={() => {
                              if (isSelectionMode) handleToggleRecordSelection(rec.id);
                            }}
                            className={`transition-colors ${
                              isSelectionMode ? 'cursor-pointer' : ''
                            } ${
                              isSelected && isSelectionMode
                                ? 'bg-blue-50/80 hover:bg-blue-100/70 border-l-4 border-[#004ACD]'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Individual Row Checkbox - Only shown in Selection Mode */}
                            {isSelectionMode && (
                              <td className="py-2.5 px-3 text-center animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleRecordSelection(rec.id, e)}
                                  className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] cursor-pointer"
                                />
                              </td>
                            )}

                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{displayName}</span>
                                {displayScholarship && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#004ACD] border border-blue-200">
                                    {displayScholarship}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                                <span className="text-[#004ACD] font-semibold">{displayStudentId}</span>
                                <span>•</span>
                                <span className="truncate max-w-[180px]">{displayYearProgram}</span>
                              </div>
                            </td>

                            {/* Sign In Cell */}
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 text-[11px]">
                              <div className="font-semibold text-emerald-800 flex items-center gap-1">
                                <LogIn className="w-3 h-3 text-emerald-600" />
                                <span>
                                  {signInTimeStr
                                    ? new Date(signInTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                    : 'Recorded'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block ml-4">
                                {rec.check_in_method}
                              </span>
                            </td>

                            {/* Sign Out Cell */}
                            <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                              {hasSignedOut ? (
                                <div>
                                  <div className="font-semibold text-cyan-800 flex items-center gap-1">
                                    <LogOut className="w-3 h-3 text-cyan-600" />
                                    <span>
                                      {new Date(rec.sign_out_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block ml-4">
                                    {rec.sign_out_method || 'QR Scanner'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    Pending
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleManualSignOut(rec.id);
                                    }}
                                    disabled={signingOutRecordId === rec.id}
                                    className="px-2 py-0.5 rounded-md bg-[#004ACD] hover:bg-[#0165CB] text-white text-[10px] font-bold shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                    title="Mark Sign Out manually"
                                  >
                                    <LogOut className="w-2.5 h-2.5 text-[#00F7FF]" />
                                    <span>{signingOutRecordId === rec.id ? 'Saving...' : 'Sign Out'}</span>
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Status Cell */}
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rec.status === 'Late'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {rec.status}
                              </span>
                              {hasSignedOut && (
                                <span className="block text-[9px] font-semibold text-cyan-700 mt-0.5">
                                  ✓ Signed Out
                                </span>
                              )}
                            </td>

                            {/* Action Cell */}
                            <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteAttendance(rec)}
                                title="Remove attendance record"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              ) : (
                /* Absent / Pending Tab */
                filteredAbsent.length === 0 ? (
                  <div className="py-16 text-center text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    100% Attendance Achieved! All registered scholars are checked in.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        {/* Select All Checkbox for Absent in Selection Mode */}
                        {isSelectionMode && (
                          <th className="py-2.5 px-3 w-10 text-center animate-in fade-in duration-150">
                            <input
                              type="checkbox"
                              ref={headerAbsentCheckboxRef}
                              checked={isAllAbsentSelected}
                              onChange={handleToggleSelectAllAbsent}
                              className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] cursor-pointer"
                              title="Select All Absent Scholars"
                            />
                          </th>
                        )}
                        <th className="py-2.5 px-4">Scholar</th>
                        <th className="py-2.5 px-3">College</th>
                        <th className="py-2.5 px-3 text-right">Manual Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAbsent.map((sch) => {
                        const isSelected = selectedAbsentIds.has(sch.id);
                        return (
                          <tr
                            key={sch.id}
                            onClick={() => {
                              if (isSelectionMode) handleToggleAbsentSelection(sch.id);
                            }}
                            className={`transition-colors ${
                              isSelectionMode ? 'cursor-pointer' : ''
                            } ${
                              isSelected && isSelectionMode
                                ? 'bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-amber-500'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Checkbox only in Selection Mode */}
                            {isSelectionMode && (
                              <td className="py-2.5 px-3 text-center animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleAbsentSelection(sch.id, e)}
                                  className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] cursor-pointer"
                                />
                              </td>
                            )}

                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-800">{formatScholarName(sch)}</div>
                              <div className="text-[11px] text-slate-500">{sch.student_id} • {sch.year_program}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-[180px]">
                              {sch.college}
                            </td>
                            <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleManualCheckIn(sch.student_id)}
                                disabled={selectedEvent.status !== 'ongoing'}
                                title={
                                  selectedEvent.status !== 'ongoing'
                                    ? `Event is ${selectedEvent.status}. Mark as Ongoing first.`
                                    : undefined
                                }
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-[#004ACD] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-[#004ACD] hover:text-white text-[11px] font-bold border border-blue-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              >
                                Mark Present
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>

            {/* Floating Circular Pencil/Close Button at Bottom-Right of the roster table for UI Uniformity */}
            <div className="absolute bottom-14 right-5 z-20 pointer-events-auto">
              {!isSelectionMode ? (
                <button
                  onClick={handleToggleSelectionMode}
                  title="Select Multiple Attendees"
                  aria-label="Select Multiple Attendees"
                  className="w-11 h-11 rounded-full bg-[#004ACD] hover:bg-[#0165CB] text-white shadow-lg hover:shadow-xl shadow-blue-900/30 transition-all border border-white/20 group hover:scale-110 flex items-center justify-center cursor-pointer"
                >
                  <Pencil className="w-5 h-5 text-[#00F7FF] group-hover:rotate-12 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={handleToggleSelectionMode}
                  title="Exit Selection Mode"
                  aria-label="Exit Selection Mode"
                  className="w-11 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl shadow-slate-900/40 transition-all border border-slate-700 group hover:scale-110 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5 text-rose-400 group-hover:rotate-90 transition-transform" />
                </button>
              )}
            </div>

            {/* Directory/Roster Footer Info */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center space-x-3">
                <span>
                  Showing <strong className="text-slate-700">{rosterTab === 'checked' ? filteredChecked.length : filteredAbsent.length}</strong> {rosterTab === 'checked' ? 'attendees' : 'absent scholars'}
                </span>
                {isSelectionMode && (
                  <span className="font-bold text-[#004ACD] animate-in fade-in">
                    • {rosterTab === 'checked' ? selectedRecordIds.size : selectedAbsentIds.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-700 font-medium pr-14 sm:pr-14">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live attendance synchronized</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN QR SCANNER POP-UP (Spans Entire Website Screen) */}
      {isScannerModalOpen && selectedEvent && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between overflow-hidden touch-none overscroll-none select-none animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Top Bar Spanning Full Width - Optimized for Mobile & Desktop */}
          <div className="px-3 sm:px-6 py-2 sm:py-3 bg-slate-900/95 border-b border-white/10 flex items-center justify-between z-10 shrink-0 gap-2">
            {/* Left: Event & Scanner Info (Gracefully truncates on mobile) */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#004ACD] text-[#00F7FF] flex items-center justify-center shadow-inner border border-[#00F7FF]/30 shrink-0">
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <h3 className="font-extrabold text-xs sm:text-base text-white truncate">QR Scanner</h3>
                  <span className="inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] sm:text-[10px] font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live</span>
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                  <span className="text-[#00F7FF] font-medium">{selectedEvent.name}</span>
                </p>
              </div>
            </div>

            {/* Right: Controls & Guaranteed-Visible Closable X Button */}
            <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
              {/* Sound Toggle Button */}
              <button
                onClick={() => setAudioFeedback(!audioFeedback)}
                title={audioFeedback ? 'Sound effects enabled' : 'Sound effects muted'}
                className="w-8 h-8 sm:w-auto sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center space-x-1.5 text-xs font-semibold cursor-pointer shrink-0 border border-white/10"
              >
                {audioFeedback ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00F7FF]" />
                    <span className="text-[11px] hidden md:inline">Sound</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                    <span className="text-[11px] hidden md:inline">Muted</span>
                  </>
                )}
              </button>

              {/* Flip Camera Button */}
              <button
                onClick={toggleCameraFacing}
                title="Flip between rear and front camera"
                className="w-8 h-8 sm:w-auto sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 border border-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00F7FF]" />
                <span className="text-[11px] hidden md:inline">Flip</span>
              </button>

              {/* Prominent Closable X Button - Always visible with shrink-0 and rose accent */}
              <button
                id="close-fullscreen-scanner-btn"
                onClick={handleCloseScannerModal}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-600/30 hover:bg-rose-600 active:bg-rose-700 text-rose-200 hover:text-white transition-colors cursor-pointer flex items-center justify-center shadow-lg border border-rose-500/50 shrink-0"
                title="Close Scanner (Esc)"
                aria-label="Close Scanner"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Center: Fullscreen Camera Viewfinder Viewport */}
          <div className="relative flex-1 flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden">
            <div className="relative w-full max-w-[min(320px,85vw)] sm:max-w-3xl aspect-square sm:aspect-[4/3] max-h-[62vh] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black flex items-center justify-center">
              {/* html5-qrcode mount target (renders native white scanning box) */}
              <div id="reader" className="w-full h-full"></div>

              {/* Tooltip in white, located below the white square */}
              {isScanning && !scanSuccessFeedback && (
                <div className="absolute bottom-2.5 sm:bottom-6 pointer-events-none flex justify-center w-full z-20 px-2 animate-in fade-in duration-200">
                  <span className="text-[10px] sm:text-xs font-medium text-white bg-black/85 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-white/20 backdrop-blur-md shadow-xl flex items-center space-x-1.5 text-center">
                    <QrCode className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                    <span>Align scholar QR badge inside viewfinder</span>
                  </span>
                </div>
              )}

              {/* Feedback Response Popup Overlay: Acknowledges student QR successfully scanned before auto-closing */}
              {scanSuccessFeedback && (
                <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
                  <div
                    className={`bg-slate-900 border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-xs sm:max-w-md w-full shadow-2xl text-center space-y-2.5 sm:space-y-3 relative overflow-hidden ${
                      scanSuccessFeedback.action === 'sign_out'
                        ? 'border-cyan-400'
                        : 'border-emerald-500'
                    }`}
                  >
                    {/* Atmospheric ambient glow */}
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#00F7FF]/20 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-[#004ACD]/25 rounded-full blur-2xl pointer-events-none"></div>

                    <div
                      className={`w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center mx-auto shadow-lg ${
                        scanSuccessFeedback.action === 'sign_out'
                          ? 'bg-gradient-to-tr from-[#004ACD] to-[#00F7FF] text-white shadow-cyan-500/30'
                          : 'bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-emerald-500/30'
                      }`}
                    >
                      {scanSuccessFeedback.action === 'sign_out' ? (
                        <LogOut className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                      ) : (
                        <LogIn className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border inline-block ${
                          scanSuccessFeedback.action === 'sign_out'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {scanSuccessFeedback.action === 'sign_out'
                          ? '2nd Scan: Sign-Out Recorded!'
                          : '1st Scan: Sign-In Recorded!'}
                      </span>
                      <h4 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                        {scanSuccessFeedback.action === 'sign_out'
                          ? 'Sign-Out Confirmed'
                          : 'Sign-In Confirmed'}
                      </h4>

                      {scanSuccessFeedback.scholar ? (
                        <div className="mt-2 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-center space-y-1">
                          <div className="text-sm sm:text-base font-extrabold text-white">
                            {formatScholarName(scanSuccessFeedback.scholar)}
                          </div>
                          <div className="text-[11px] sm:text-xs text-[#00F7FF] font-bold">
                            {scanSuccessFeedback.scholar.student_id} • {resolveScholarScholarshipType(scanSuccessFeedback.scholar)}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                            {scanSuccessFeedback.scholar.college} • {scanSuccessFeedback.scholar.year_program}
                          </div>

                          {/* Timestamps strip */}
                          <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-left">
                            <div className="bg-white/5 rounded-lg p-1.5 px-2">
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                                Sign In
                              </span>
                              <span className="text-xs font-bold text-emerald-300">
                                {scanSuccessFeedback.attendanceRecord?.sign_in_time
                                  ? new Date(scanSuccessFeedback.attendanceRecord.sign_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                  : scanSuccessFeedback.attendanceRecord?.timestamp
                                  ? new Date(scanSuccessFeedback.attendanceRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                  : 'Recorded'}
                              </span>
                            </div>
                            <div className="bg-white/5 rounded-lg p-1.5 px-2">
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                                Sign Out
                              </span>
                              <span className={`text-xs font-bold ${scanSuccessFeedback.action === 'sign_out' ? 'text-cyan-300' : 'text-slate-400 italic'}`}>
                                {scanSuccessFeedback.attendanceRecord?.sign_out_time
                                  ? new Date(scanSuccessFeedback.attendanceRecord.sign_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                  : 'Pending 2nd scan'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-300 mt-2">{scanSuccessFeedback.message}</p>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-center space-x-2 text-[10px] sm:text-xs text-slate-300 font-semibold">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#00F7FF] animate-ping"></span>
                      <span>
                        {scanSuccessFeedback.action === 'sign_out'
                          ? 'Sign-out recorded • Closing scanner...'
                          : 'Sign-in saved • Closing scanner...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message if camera failed */}
            {scannerError && (
              <div className="mt-3 p-3 max-w-sm sm:max-w-xl w-full bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{scannerError}</span>
              </div>
            )}

            {/* Notice banner inside modal when not success (e.g. duplicate scan or error) */}
            {lastCheckIn && !lastCheckIn.success && !scanSuccessFeedback && (
              <div
                className={`mt-3 p-3.5 rounded-xl border max-w-sm sm:max-w-xl w-full text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
                  lastCheckIn.alreadyCheckedIn
                    ? 'bg-amber-950/90 border-amber-500/60 text-amber-100'
                    : 'bg-rose-950/90 border-rose-500/60 text-rose-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs sm:text-sm leading-tight text-white">
                        {lastCheckIn.alreadyCheckedIn
                          ? 'Duplicate Scan Detected'
                          : 'Check-In Notice'}
                      </h5>
                      <p className="text-[10px] sm:text-[11px] font-medium opacity-90">{lastCheckIn.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLastCheckIn(null)}
                    className="text-white/60 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {lastCheckIn.scholar && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] sm:text-[11px]">
                    <div>
                      <span className="text-white/60 font-medium">Scholar: </span>
                      <strong className="text-white">{formatScholarName(lastCheckIn.scholar)}</strong>
                    </div>
                    <div>
                      <span className="text-white/60 font-medium">Scholarship: </span>
                      <strong className="text-[#00F7FF]">{resolveScholarScholarshipType(lastCheckIn.scholar)}</strong>
                    </div>
                    <div>
                      <span className="text-white/60 font-medium">Student ID: </span>
                      <strong className="text-white">{lastCheckIn.scholar.student_id}</strong>
                    </div>
                    <div className="truncate">
                      <span className="text-white/60 font-medium">Program: </span>
                      <span className="text-white/90">{lastCheckIn.scholar.year_program}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Bar: Quick Counter & Escape Notice */}
          <div className="px-3 sm:px-6 py-2 sm:py-3.5 bg-slate-900/90 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 gap-2 shrink-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00F7FF] shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">
                Attendance: <strong className="text-white">{attendanceRecords.length}</strong> / {scholars.length} ({attendancePercentage}%)
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="hidden sm:inline text-slate-400 text-[11px]">
                Press <kbd className="px-1.5 py-0.5 bg-white/15 rounded text-white font-mono text-[10px] border border-white/20">Esc</kbd> or click ✕ to close
              </span>
            </div>
          </div>

        </div>
      )}

      {/* In-App Attendance Delete Confirmation Modal (Single) */}
      <ConfirmModal
        isOpen={Boolean(recordToDelete)}
        title="Remove Attendance Record"
        message={`Are you sure you want to remove the check-in log for ${
          recordToDelete
            ? formatScholarName(
                scholars.find((s) => s.id === recordToDelete.scholar_id || s.student_id === recordToDelete.student_id) ||
                  recordToDelete.scholar_name ||
                  ''
              )
            : 'this scholar'
        }?`}
        detail={
          recordToDelete
            ? `Student ID: ${
                scholars.find((s) => s.id === recordToDelete.scholar_id || s.student_id === recordToDelete.student_id)?.student_id ||
                recordToDelete.student_id
              } • Status: ${recordToDelete.status} • Method: ${recordToDelete.check_in_method} • Logged: ${new Date(
                recordToDelete.timestamp
              ).toLocaleTimeString()}`
            : undefined
        }
        confirmLabel="Yes, Remove Record"
        cancelLabel="Keep Record"
        isDanger={true}
        isLoading={isDeletingRecord}
        onConfirm={handleConfirmDeleteAttendance}
        onClose={() => {
          if (!isDeletingRecord) setRecordToDelete(null);
        }}
      />

      {/* Batch Attendance Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title={`Remove ${selectedRecordIds.size} Attendance Record(s)`}
        message={`Are you sure you want to delete ${selectedRecordIds.size} check-in record(s) from "${selectedEvent?.name}"?`}
        detail="The selected scholars will be removed from the checked-in roster and returned to the Pending/Absent list for this event."
        confirmLabel={`Yes, Delete ${selectedRecordIds.size} Records`}
        cancelLabel="Cancel"
        isDanger={true}
        isLoading={isBatchDeleting}
        onConfirm={handleConfirmBatchDelete}
        onClose={() => {
          if (!isBatchDeleting) setShowBatchDeleteModal(false);
        }}
      />
    </div>
  );
};
