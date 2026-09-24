import React, { useState, useRef, useEffect } from 'react';
import { Scholar } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import {
  formatScholarName,
  getFirstNameInitials,
  resolveScholarScholarshipType,
  parseYearProgram,
  DEFAULT_MSUIIT_COLLEGES,
} from '../utils/formatters';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  QrCode,
  Edit2,
  Trash2,
  Mail,
  GraduationCap,
  Building2,
  Download,
  ShieldCheck,
  CheckCircle2,
  Send,
  Award,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  AlertTriangle,
  Pencil,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface ScholarsViewProps {
  scholars: Scholar[];
  onOpenRegisterModal: () => void;
  onOpenCsvModal: () => void;
  onOpenBatchEmailModal: () => void;
  onEditScholar: (scholar: Scholar) => void;
  onViewQrBadge: (scholar: Scholar) => void;
  onRefresh: () => void;
}

type SortField = 'scholar' | 'student_id' | 'scholarship' | 'year' | 'program' | 'college';
type SortDirection = 'asc' | 'desc';

export const ScholarsView: React.FC<ScholarsViewProps> = ({
  scholars,
  onOpenRegisterModal,
  onOpenCsvModal,
  onOpenBatchEmailModal,
  onEditScholar,
  onViewQrBadge,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<string>('All');
  const [selectedScholarship, setSelectedScholarship] = useState<string>('All');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scholarToDelete, setScholarToDelete] = useState<Scholar | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const colleges = Array.from(
    new Set([...DEFAULT_MSUIIT_COLLEGES, ...scholars.map((s) => s.college).filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b));

  const filteredScholars = scholars.filter((s) => {
    const sType = resolveScholarScholarshipType(s);
    const matchesCollege = selectedCollege === 'All' || s.college === selectedCollege;
    const matchesScholarship =
      selectedScholarship === 'All' ||
      s.scholarship_category === selectedScholarship ||
      sType.includes(selectedScholarship);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.year_program.toLowerCase().includes(q) ||
      s.college.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      sType.toLowerCase().includes(q);

    return matchesCollege && matchesScholarship && matchesSearch;
  });

  // Extract sorting value for scholar
  const getSortValue = (s: Scholar, field: SortField): string | number => {
    switch (field) {
      case 'scholar':
        return formatScholarName(s).toLowerCase();
      case 'student_id':
        return (s.student_id || '').toLowerCase();
      case 'scholarship':
        return resolveScholarScholarshipType(s).toLowerCase();
      case 'year': {
        const { yearLevel } = parseYearProgram(s.year_program || '');
        const y = s.year_level || yearLevel || '0';
        return parseInt(y, 10) || 0;
      }
      case 'program': {
        const { academicProgram } = parseYearProgram(s.year_program || '');
        return (s.academic_program || academicProgram || s.year_program || '').toLowerCase();
      }
      case 'college':
        return (s.college || '').toLowerCase();
      default:
        return '';
    }
  };

  // Sort filtered scholars
  const sortedScholars = [...filteredScholars].sort((a, b) => {
    if (!sortField) return 0;
    const valA = getSortValue(a, sortField);
    const valB = getSortValue(b, sortField);

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    const cmp = String(valA).localeCompare(String(valB));
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Check state of select all checkbox
  const filteredIds = sortedScholars.map((s) => s.id);
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.has(id)).length;
  const isAllFilteredSelected = sortedScholars.length > 0 && selectedFilteredCount === sortedScholars.length;
  const isIndeterminate = selectedFilteredCount > 0 && selectedFilteredCount < sortedScholars.length;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect all filtered scholars
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered scholars
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleSelectEveryScholar = () => {
    setSelectedIds(new Set(scholars.map((s) => s.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectionMode(true);
    }
  };

  const handleDeleteSingle = (scholar: Scholar, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScholarToDelete(scholar);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!scholarToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteScholar(scholarToDelete.id);
      const name = formatScholarName(scholarToDelete);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(scholarToDelete.id);
        return next;
      });
      setScholarToDelete(null);
      onRefresh();
      setToastMessage(`Scholar ${name} successfully deleted.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert('Failed to delete scholar: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const count = selectedIds.size;
    try {
      await api.batchDeleteScholars(Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
      onRefresh();
      setToastMessage(`Successfully deleted ${count} scholar${count > 1 ? 's' : ''}.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert('Failed to batch delete scholars: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportAll = () => {
    if (scholars.length === 0) return;

    const dataToExport = selectedIds.size > 0
      ? scholars.filter((s) => selectedIds.has(s.id))
      : scholars;

    const headers = [
      'Student ID',
      'Scholar Name (Last Name, First Name M.I.)',
      'Scholarship Type',
      'Year Level',
      'Academic Program',
      'College',
      'Email Address',
      'Unique QR Code',
    ];
    const rows = dataToExport.map((s) => {
      const { yearLevel, academicProgram } = parseYearProgram(s.year_program || '');
      const prog = s.academic_program || academicProgram || s.year_program;
      const yNum = s.year_level || yearLevel || '1';
      return [
        `"${s.student_id}"`,
        `"${formatScholarName(s)}"`,
        `"${resolveScholarScholarshipType(s)}"`,
        `"${yNum}"`,
        `"${prog}"`,
        `"${s.college}"`,
        `"${s.email}"`,
        `"${s.qr_code}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MIDSA_Scholars_${selectedIds.size > 0 ? 'Selected_' : ''}${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortableHeader = (label: string, field: SortField, className = 'whitespace-nowrap') => {
    const isActive = sortField === field;
    const isAsc = isActive ? sortDirection === 'asc' : true;

    return (
      <th className={`py-3 px-3 ${className}`}>
        <button
          type="button"
          onClick={() => handleSort(field)}
          className="group inline-flex items-center space-x-1.5 font-semibold text-slate-600 hover:text-[#004ACD] transition-colors cursor-pointer select-none text-left"
          title={`Sort by ${label} (${isActive && sortDirection === 'asc' ? 'Descending' : 'Ascending'})`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isActive ? (
              isAsc ? (
                <ArrowUp className="w-3.5 h-3.5 text-[#004ACD] stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-[#004ACD] stroke-[2.5]" />
              )
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
            )}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {/* Page Header & Actions Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F7FF]"></span>
            <h2 className="text-lg font-bold text-slate-800">MIDSA Scholar Directory</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage scholar master records, batch import CSV student rosters, and generate digital QR passes.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
          {/* Top Row: Register Scholar & Batch Email QR Codes */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              id="register-scholar-btn"
              onClick={onOpenRegisterModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#00F7FF]" />
              <span>+ Register Scholar</span>
            </button>

            <button
              id="batch-email-scholars-btn"
              onClick={onOpenBatchEmailModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#0165CB] hover:to-[#004ACD] text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20"
            >
              <Send className="w-3.5 h-3.5 text-[#00F7FF]" />
              <span>Batch Email QR Codes</span>
            </button>
          </div>

          {/* Bottom Row: Upload Batch CSV & Download Batch CSV */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              onClick={onOpenCsvModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border border-[#0165CB]/30 text-[#004ACD] hover:bg-blue-100 text-xs font-bold transition-all shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-[#004ACD]" />
              <span>Upload Batch CSV</span>
            </button>

            <button
              onClick={handleExportAll}
              title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected scholars to CSV` : 'Export all scholars to CSV'}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors relative"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Batch CSV</span>
              {selectedIds.size > 0 && (
                <span className="bg-[#004ACD] text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center">
                  {selectedIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, ID, program, scholarship, or college..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Scholarship Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500">Scholarship:</span>
            <select
              value={selectedScholarship}
              onChange={(e) => setSelectedScholarship(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
            >
              <option value="All">All Types</option>
              <option value="UGS">UGS (All)</option>
              <option value="RA 7687">RA 7687</option>
              <option value="MERIT">MERIT</option>
              <option value="JLSS">JLSS (All)</option>
              <option value="MOST">MOST</option>
            </select>
          </div>

          {/* College Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500">College:</span>
            <select
              value={selectedCollege}
              onChange={(e) => setSelectedCollege(e.target.value)}
              className="w-full sm:w-56 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
            >
              <option value="All">All Colleges ({scholars.length})</option>
              {colleges.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scholars Directory Table Card with Self-Contained Scrolling & Floating Action Button */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col relative">
        {/* Floating/Integrated Batch Selection Action Toolbar */}
        {isSelectionMode && selectedIds.size > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/80 border-b border-blue-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs animate-in fade-in duration-150">
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-1 bg-[#004ACD] text-white font-bold rounded-lg text-xs shadow-xs">
                {selectedIds.size} Selected
              </span>
              <span className="text-slate-600 font-medium hidden sm:inline">
                {selectedIds.size === 1 ? '1 scholar selected' : `${selectedIds.size} scholars selected`}
              </span>
              {sortedScholars.length > selectedIds.size && (
                <button
                  onClick={handleToggleSelectAll}
                  className="text-[#004ACD] hover:underline font-bold text-xs"
                >
                  Select all {sortedScholars.length} filtered
                </button>
              )}
              {scholars.length > sortedScholars.length && selectedIds.size < scholars.length && (
                <button
                  onClick={handleSelectEveryScholar}
                  className="text-slate-600 hover:text-slate-800 hover:underline font-medium text-xs hidden md:inline"
                >
                  Select all {scholars.length} in database
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleClearSelection}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm shadow-rose-600/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Self-contained Scrollable Table Viewport */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] divide-y divide-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-600 font-semibold border-b border-slate-200 shadow-xs">
              <tr>
                {/* Select All Checkbox Column - Only shown in Selection Mode */}
                {isSelectionMode && (
                  <th className="py-3 px-3 w-10 text-center animate-in fade-in duration-150">
                    <div className="flex items-center justify-center">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        title={isAllFilteredSelected ? 'Deselect all filtered' : 'Select all filtered'}
                        checked={isAllFilteredSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] focus:ring-offset-0 cursor-pointer"
                      />
                    </div>
                  </th>
                )}
                {renderSortableHeader('Scholar', 'scholar')}
                {renderSortableHeader('Student ID', 'student_id')}
                {renderSortableHeader('Scholarship', 'scholarship')}
                {renderSortableHeader('Year', 'year')}
                {renderSortableHeader('Program', 'program')}
                {renderSortableHeader('College', 'college')}
                <th className="py-3 px-3 whitespace-nowrap">QR Pass</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedScholars.length === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 9 : 8} className="py-16 text-center text-slate-400">
                    <Users className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 text-sm">No scholars match your query</p>
                    <p className="text-slate-400 text-xs mt-1">
                      {scholars.length === 0
                        ? 'Your scholar roster is currently empty. Click "+ Register Scholar" or "Upload CSV Batch" to add students.'
                        : 'Try resetting the search query or college/scholarship filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedScholars.map((sch) => {
                  const sType = resolveScholarScholarshipType(sch);
                  const isSelected = selectedIds.has(sch.id);
                  const { yearLevel, academicProgram } = parseYearProgram(sch.year_program || '');
                  const prog = sch.academic_program || academicProgram || sch.year_program;
                  const yNum = sch.year_level || yearLevel || '1';
                  const suffix = yNum === '1' ? '1st' : yNum === '2' ? '2nd' : yNum === '3' ? '3rd' : `${yNum}th`;

                  return (
                    <tr
                      key={sch.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          handleToggleSelectOne(sch.id);
                        }
                      }}
                      className={`transition-colors group ${
                        isSelectionMode ? 'cursor-pointer' : ''
                      } ${
                        isSelected && isSelectionMode ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Selection Checkbox - Only shown in Selection Mode */}
                      {isSelectionMode && (
                        <td className="py-3 px-3 text-center animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(sch.id)}
                              className="w-4 h-4 rounded text-[#004ACD] border-slate-300 focus:ring-[#004ACD] focus:ring-offset-0 cursor-pointer"
                            />
                          </div>
                        </td>
                      )}

                      {/* Scholar Info */}
                      <td className="py-3 px-3">
                        {(() => {
                          const displayName = formatScholarName(sch);
                          const initials = getFirstNameInitials(sch);

                          return (
                            <div className="flex items-center space-x-3 min-w-[180px]">
                              <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ${
                                isSelected && isSelectionMode
                                  ? 'bg-[#004ACD] text-white'
                                  : 'bg-gradient-to-br from-[#004ACD] to-[#0165CB] text-[#00F7FF]'
                              }`}>
                                {initials || 'S'}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 text-sm block leading-tight">
                                  {displayName}
                                </span>
                                <span className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{sch.email}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Student ID */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-700 font-medium whitespace-nowrap">
                          {sch.student_id}
                        </span>
                      </td>

                      {/* Scholarship */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-700 font-medium whitespace-nowrap">
                          {sType}
                        </span>
                      </td>

                      {/* Year */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-700 font-medium whitespace-nowrap">
                          {suffix} Year
                        </span>
                      </td>

                      {/* Program */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium whitespace-nowrap">{prog}</span>
                        </div>
                      </td>

                      {/* College */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="whitespace-nowrap">{sch.college}</span>
                        </div>
                      </td>

                      {/* QR Code Status */}
                      <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onViewQrBadge(sch)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View Pass</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onViewQrBadge(sch)}
                            title="View Digital QR Badge"
                            className="p-1.5 rounded-lg text-[#004ACD] hover:bg-blue-50 transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditScholar(sch)}
                            title="Edit scholar info"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteSingle(sch, e)}
                            title="Delete scholar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Circular Pencil/Close Button at Bottom-Right of the table */}
        <div className="absolute bottom-14 right-5 z-20 pointer-events-auto">
          {!isSelectionMode ? (
            <button
              onClick={handleToggleSelectionMode}
              title="Select Multiple Scholars"
              aria-label="Select Multiple Scholars"
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

        {/* Directory Footer Info */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-3">
            <span>
              Showing <strong className="text-slate-700">{sortedScholars.length}</strong> of{' '}
              <strong className="text-slate-700">{scholars.length}</strong> total scholars
            </span>
            {isSelectionMode && (
              <span className="font-bold text-[#004ACD] animate-in fade-in">
                • {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-700 font-medium pr-14 sm:pr-14">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Digital QR attendance passes active</span>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs border border-slate-700 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* In-App Single Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(scholarToDelete)}
        title="Delete Scholar Record"
        message={`Are you sure you want to permanently delete ${scholarToDelete?.name}? This will also delete their QR code registration and all associated attendance check-in history.`}
        detail={
          scholarToDelete
            ? `Student ID: ${scholarToDelete.student_id} • ${scholarToDelete.year_program} • ${scholarToDelete.college}`
            : undefined
        }
        confirmLabel="Yes, Delete Scholar"
        cancelLabel="Keep Scholar"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDeleteSingle}
        onClose={() => {
          if (!isDeleting) setScholarToDelete(null);
        }}
      />

      {/* In-App Batch Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title={`Delete ${selectedIds.size} Selected Scholar${selectedIds.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to permanently delete the ${selectedIds.size} selected scholar records? This will delete their profiles, QR codes, and any associated event attendance check-ins.`}
        detail={`This action cannot be undone. ${selectedIds.size} records will be removed from the master database.`}
        confirmLabel={`Yes, Delete ${selectedIds.size} Scholars`}
        cancelLabel="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmBatchDelete}
        onClose={() => {
          if (!isDeleting) setShowBatchDeleteConfirm(false);
        }}
      />
    </div>
  );
};
