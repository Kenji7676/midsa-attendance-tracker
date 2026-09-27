import React, { useState, useEffect } from 'react';
import { Scholar, ScholarshipCategory, ScholarshipSubcategory } from '../types';
import { X, UserPlus, QrCode, Loader2, Award, Trash2, Plus } from 'lucide-react';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import {
  formatScholarName,
  parseScholarName,
  formatYearProgram,
  parseYearProgram,
  formatScholarshipType,
  parseScholarshipType,
  normalizeYearLevel,
  cleanAcademicProgram,
  DEFAULT_MSUIIT_COLLEGES,
} from '../utils/formatters';

interface ScholarModalProps {
  isOpen: boolean;
  scholarToEdit?: Scholar | null;
  existingScholars?: Scholar[];
  onClose: () => void;
  onSuccess: (newScholar?: Scholar) => void;
  onDelete?: (scholar: Scholar) => void;
}

export const ScholarModal: React.FC<ScholarModalProps> = ({
  isOpen,
  scholarToEdit,
  existingScholars = [],
  onClose,
  onSuccess,
  onDelete,
}) => {
  const [studentId, setStudentId] = useState('');
  const [surname, setSurname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [yearLevel, setYearLevel] = useState('1');
  const [academicProgram, setAcademicProgram] = useState('');
  const [college, setCollege] = useState('');
  const [email, setEmail] = useState('');
  const [scholarshipCategory, setScholarshipCategory] = useState<ScholarshipCategory>('UGS');
  const [scholarshipSubcategory, setScholarshipSubcategory] = useState<ScholarshipSubcategory>('RA 7687');
  const [collegesList, setCollegesList] = useState<string[]>(DEFAULT_MSUIIT_COLLEGES);
  const [isAddingCollege, setIsAddingCollege] = useState(false);
  const [newCollegeName, setNewCollegeName] = useState('');
  const [isSavingCollege, setIsSavingCollege] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGawadIskoAwardee, setIsGawadIskoAwardee] = useState(false);

  // Fetch persistent colleges from backend
  useEffect(() => {
    if (isOpen) {
      api.getColleges()
        .then((fetched) => {
          if (fetched && fetched.length > 0) {
            const sorted = Array.from(new Set([...DEFAULT_MSUIIT_COLLEGES, ...fetched])).sort((a, b) => a.localeCompare(b));
            setCollegesList(sorted);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch colleges from API:', err);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (scholarToEdit) {
      setStudentId(scholarToEdit.student_id);

      // Handle name fields
      if (scholarToEdit.last_name && scholarToEdit.first_name) {
        setSurname(scholarToEdit.last_name);
        setFirstName(scholarToEdit.first_name);
        setMiddleInitial(scholarToEdit.middle_initial || '');
      } else if (scholarToEdit.name) {
        const parsed = parseScholarName(scholarToEdit.name);
        setSurname(parsed.lastName);
        setFirstName(parsed.firstName);
        setMiddleInitial(parsed.middleInitial);
      } else {
        setSurname('');
        setFirstName('');
        setMiddleInitial('');
      }

      // Handle year & academic program
      if (scholarToEdit.academic_program) {
        setYearLevel(normalizeYearLevel(scholarToEdit.year_level, scholarToEdit.student_id));
        setAcademicProgram(cleanAcademicProgram(scholarToEdit.academic_program));
      } else if (scholarToEdit.year_program) {
        const yp = parseYearProgram(scholarToEdit.year_program, scholarToEdit.student_id);
        setYearLevel(yp.yearLevel);
        setAcademicProgram(yp.academicProgram);
      } else {
        setYearLevel(normalizeYearLevel(null, scholarToEdit.student_id));
        setAcademicProgram('');
      }

      // Handle Scholarship Type
      if (scholarToEdit.scholarship_category) {
        setScholarshipCategory(scholarToEdit.scholarship_category);
        setScholarshipSubcategory(scholarToEdit.scholarship_subcategory || (scholarToEdit.scholarship_category === 'MOST' ? '' : 'RA 7687'));
      } else if (scholarToEdit.scholarship_type) {
        const parsedSt = parseScholarshipType(scholarToEdit.scholarship_type);
        setScholarshipCategory(parsedSt.category);
        setScholarshipSubcategory(parsedSt.subcategory);
      } else {
        setScholarshipCategory('UGS');
        setScholarshipSubcategory('RA 7687');
      }

      setCollege(scholarToEdit.college || collegesList[0] || 'College of Computer Studies');
      setEmail(scholarToEdit.email);
      setIsGawadIskoAwardee(scholarToEdit.gawad_isko_awardee?.toLowerCase() === 'yes');
    } else {
      setStudentId('');
      setSurname('');
      setFirstName('');
      setMiddleInitial('');
      setYearLevel('1');
      setAcademicProgram('');
      setScholarshipCategory('UGS');
      setScholarshipSubcategory('RA 7687');
      setCollege(collegesList[0] || 'College of Computer Studies');
      setEmail('');
      setIsGawadIskoAwardee(false);
    }
    setError('');
    setIsAddingCollege(false);
    setNewCollegeName('');
  }, [scholarToEdit, isOpen]);

  const handleCategoryChange = (category: ScholarshipCategory) => {
    setScholarshipCategory(category);
    if (category === 'MOST') {
      setScholarshipSubcategory('');
    } else if (category === 'UGS') {
      if (scholarshipSubcategory === 'RA 10612' || !scholarshipSubcategory) {
        setScholarshipSubcategory('RA 7687');
      }
    } else if (category === 'JLSS') {
      if (!scholarshipSubcategory) {
        setScholarshipSubcategory('RA 7687');
      }
    }
  };

  const handleAddNewCollege = async () => {
    if (!newCollegeName.trim()) return;
    setIsSavingCollege(true);
    try {
      const res = await api.addCollege(newCollegeName.trim());
      const updated = (res.colleges || [...collegesList, res.college]).sort((a, b) => a.localeCompare(b));
      setCollegesList(updated);
      setCollege(res.college);
      setIsAddingCollege(false);
      setNewCollegeName('');
    } catch (err: any) {
      alert('Failed to add college: ' + err.message);
    } finally {
      setIsSavingCollege(false);
    }
  };

  if (!isOpen) return null;

  const trimmedStudentId = studentId.trim();
  const isStudentIdFormatValid = /^\d{4}-\d{4}$/.test(trimmedStudentId);
  const isDuplicateId = Boolean(
    trimmedStudentId &&
    existingScholars.some(
      (s) => s.student_id.toLowerCase() === trimmedStudentId.toLowerCase() && s.id !== scholarToEdit?.id
    )
  );

  const handleStudentIdChange = (raw: string) => {
    setStudentId(raw.trim());
  };

  // Compute live formatted display name in "Last Name, First Name M.I." format
  const previewFormattedName = formatScholarName({
    last_name: surname.trim() || 'La Cruz',
    first_name: firstName.trim() || 'Juan',
    middle_initial: middleInitial.trim() || 'D.',
  });

  const formattedScholarshipTypePreview = formatScholarshipType(scholarshipCategory, scholarshipSubcategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStudentId = studentId.trim();
    const cleanSurname = surname.trim();
    const cleanFirstName = firstName.trim();
    const cleanMi = middleInitial.trim();
    const cleanProgram = academicProgram.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanStudentId || !cleanSurname || !cleanFirstName || !cleanProgram || !college.trim() || !cleanEmail) {
      setError('Please fill in all required scholar fields.');
      return;
    }

    if (!/^\d{4}-\d{4}$/.test(cleanStudentId)) {
      setError('Student ID must follow the format: 4 digits, a dash, and 4 digits (e.g. 2024-0001)');
      return;
    }

    if (isDuplicateId) {
      setError('This Student ID is already registered to another scholar.');
      return;
    }

    // Format MI with trailing dot if provided
    const miFormatted = cleanMi ? (cleanMi.endsWith('.') ? cleanMi : `${cleanMi}.`) : '';

    // Strictly format display name as "Last Name, First Name M.I." e.g. "La Cruz, Juan D."
    const formattedName = `${cleanSurname}, ${cleanFirstName}${miFormatted ? ' ' + miFormatted : ''}`;
    const cleanYear = normalizeYearLevel(yearLevel, cleanStudentId);
    const sanitizedProgram = cleanAcademicProgram(cleanProgram);
    const formattedYearProgram = formatYearProgram(cleanYear, sanitizedProgram, cleanStudentId);
    const finalScholarshipType = formatScholarshipType(scholarshipCategory, scholarshipSubcategory);

    setLoading(true);
    setError('');

    const payload = {
      student_id: cleanStudentId,
      name: formattedName,
      last_name: cleanSurname,
      first_name: cleanFirstName,
      middle_initial: miFormatted,
      year_level: cleanYear,
      academic_program: sanitizedProgram,
      year_program: formattedYearProgram,
      college: college.trim(),
      scholarship_category: scholarshipCategory,
      scholarship_subcategory: scholarshipSubcategory,
      scholarship_type: finalScholarshipType,
      email: cleanEmail,
      gawad_isko_awardee: isGawadIskoAwardee ? 'yes' : 'no',
    };

    try {
      if (scholarToEdit) {
        const updated = await api.updateScholar(scholarToEdit.id, payload);
        onSuccess(updated);
      } else {
        const created = await api.createScholar(payload);
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save scholar record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ACD] text-[#00F7FF] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {scholarToEdit ? 'Edit Scholar Information' : 'Register New MIDSA Scholar'}
              </h3>
              <p className="text-xs text-slate-500">
                {scholarToEdit ? 'Update student records' : 'Automatically generates unique QR badge'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Student ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Student ID <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-mono font-medium text-slate-500">
                Sample: <span className="font-bold text-[#004ACD]">2024-0001</span>
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={12}
                placeholder="2024-0001"
                value={studentId}
                onChange={(e) => handleStudentIdChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border font-mono font-bold text-xs focus:outline-none transition-all ${
                  trimmedStudentId
                    ? isStudentIdFormatValid && !isDuplicateId
                      ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900 focus:ring-2 focus:ring-emerald-500'
                      : 'border-rose-400 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-500'
                    : 'border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#004ACD]'
                }`}
              />
              {trimmedStudentId && isStudentIdFormatValid && !isDuplicateId && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                    ✓ Valid
                  </span>
                </div>
              )}
            </div>

            {/* Error messages at the bottom when violated or duplicate */}
            {trimmedStudentId && !isStudentIdFormatValid && (
              <p className="text-[11px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> Student ID must follow the format of 4 digits, a dash, and 4 digits (e.g. 2024-0001).
              </p>
            )}
            {trimmedStudentId && isStudentIdFormatValid && isDuplicateId && (
              <p className="text-[11px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                <span>⚠️</span> This Student ID is already registered to another scholar.
              </p>
            )}
          </div>

          {/* Separate Name Fields: Surname, First Name, M.I. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Scholar Full Name <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-medium text-slate-500">
                Format: <span className="font-semibold text-slate-700">Last Name, First Name M.I.</span>
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2.5">
              {/* Surname */}
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Surname <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="La Cruz"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
                />
              </div>

              {/* First Name */}
              <div className="col-span-8 sm:col-span-5">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
                />
              </div>

              {/* Middle Initial */}
              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  M.I.
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="D."
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs text-center"
                />
              </div>
            </div>

            {/* Live Display Preview */}
            <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Display Name:</span>
              <span className="font-bold text-slate-800 font-mono text-xs">
                {surname || firstName ? (
                  formatScholarName({
                    last_name: surname,
                    first_name: firstName,
                    middle_initial: middleInitial,
                  })
                ) : (
                  <span className="text-slate-400 italic">e.g. {previewFormattedName}</span>
                )}
              </span>
            </div>
          </div>

          {/* Scholarship Type Selection Section */}
          <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#004ACD]" />
                Scholarship Type <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Display Value:</span>
                <span className="px-2 py-0.5 rounded-md bg-[#004ACD] text-white font-bold font-mono text-[11px] shadow-xs">
                  {formattedScholarshipTypePreview}
                </span>
              </div>
            </div>

            {/* Primary Toggle: UGS | JLSS | MOST */}
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                Scholarship Program
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                {(['UGS', 'JLSS', 'MOST'] as ScholarshipCategory[]).map((cat) => {
                  const isActive = scholarshipCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                        isActive
                          ? 'bg-[#004ACD] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                      }`}
                    >
                      {cat}
                      {cat === 'UGS' && <span className="block text-[9px] font-normal opacity-80">Undergraduate</span>}
                      {cat === 'JLSS' && <span className="block text-[9px] font-normal opacity-80">Junior Level</span>}
                      {cat === 'MOST' && <span className="block text-[9px] font-normal opacity-80">Scholarship</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional Sub-selection */}
            {scholarshipCategory === 'UGS' && (
              <div className="pt-2 border-t border-blue-100">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  UGS Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['RA 7687', 'MERIT'] as ScholarshipSubcategory[]).map((sub) => {
                    const isSelected = scholarshipSubcategory === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setScholarshipSubcategory(sub)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'border-[#004ACD] bg-white text-[#004ACD] shadow-xs ring-2 ring-[#004ACD]/20'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#004ACD] bg-[#004ACD]' : 'border-slate-400'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span>{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scholarshipCategory === 'JLSS' && (
              <div className="pt-2 border-t border-blue-100">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  JLSS Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['RA 7687', 'MERIT', 'RA 10612'] as ScholarshipSubcategory[]).map((sub) => {
                    const isSelected = scholarshipSubcategory === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setScholarshipSubcategory(sub)}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'border-[#004ACD] bg-white text-[#004ACD] shadow-xs ring-2 ring-[#004ACD]/20'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#004ACD] bg-[#004ACD]' : 'border-slate-400'}`}>
                          {isSelected && <div className="w-1 h-1 bg-white rounded-full" />}
                        </div>
                        <span className="truncate">{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scholarshipCategory === 'MOST' && (
              <div className="pt-1 text-[11px] text-slate-500 italic">
                MOST scholarship has no subcategories and is displayed as <strong className="text-slate-700 not-italic">MOST</strong>.
              </div>
            )}
          </div>

          {/* Year (Dropdown 1-5) and Academic Program (Text Field) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Year Dropdown 1-5 showing 1st Year, etc. */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Year <span className="text-rose-500">*</span>
              </label>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs bg-white font-medium"
              >
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>

            {/* Academic Program as Text Field */}
            <div className="sm:col-span-8">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Academic Program <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BS Computer Science"
                value={academicProgram}
                onChange={(e) => setAcademicProgram(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* College with Add New College Function */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                College <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingCollege(!isAddingCollege)}
                className="text-[11px] font-semibold text-[#004ACD] hover:text-[#00389a] hover:underline flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {isAddingCollege ? 'Close' : 'Add College'}
              </button>
            </div>

            {isAddingCollege && (
              <div className="mb-2 p-3 bg-blue-50/70 border border-[#0165CB]/30 rounded-xl space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">Add New College / Academic Unit</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. College of Law"
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCollege();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newCollegeName.trim() || isSavingCollege}
                    onClick={handleAddNewCollege}
                    className="px-3 py-1.5 rounded-lg bg-[#004ACD] hover:bg-[#00389a] text-white text-xs font-bold disabled:bg-slate-300 transition-colors"
                  >
                    {isSavingCollege ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCollege(false);
                      setNewCollegeName('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <select
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs bg-white"
            >
              {collegesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Email Address with juan.lacruz@g.msuiit.edu.ph sample */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="juan.lacruz@g.msuiit.edu.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004ACD] focus:border-transparent text-slate-800 text-xs"
            />
          </div>

          {/* Gawad Isko Awardee Checkbox */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50/60 rounded-2xl border border-amber-200 flex items-start space-x-3">
            <div className="flex items-center h-5 mt-0.5">
              <input
                id="gawad_isko_checkbox"
                type="checkbox"
                checked={isGawadIskoAwardee}
                onChange={(e) => setIsGawadIskoAwardee(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>
            <label htmlFor="gawad_isko_checkbox" className="cursor-pointer select-none">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-800">Gawad Isko Awardee</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-900 uppercase">
                  Honor Awardee
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Check this box if this scholar is an official Gawad Isko Awardee. This enables certificate tracking and special recognition upon sign-in.
              </p>
            </label>
          </div>

          {!scholarToEdit && (
            <div className="p-3 bg-blue-50/80 border border-[#0165CB]/20 rounded-xl flex items-center space-x-2.5 text-xs text-[#004ACD]">
              <QrCode className="w-5 h-5 text-[#004ACD] shrink-0" />
              <div>
                <span className="font-bold">Automatic QR Code Generation</span>
                <p className="text-slate-600 text-[11px]">
                  Upon registration, a cryptographically signed MIDSA QR badge is instantly created with the formatted identity and ready for mobile scanner check-in.
                </p>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {scholarToEdit ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Scholar</span>
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
                  <span>{scholarToEdit ? 'Save Changes' : 'Register Scholar & Generate QR'}</span>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal for Scholar */}
        {scholarToEdit && (
          <ConfirmModal
            isOpen={showDeleteConfirm}
            title="Delete Scholar Record"
            message={`Are you sure you want to permanently delete ${scholarToEdit.name}? This will also delete their QR code registration and all attendance check-in records.`}
            detail={`Student ID: ${scholarToEdit.student_id} • ${scholarToEdit.year_program}`}
            confirmLabel="Yes, Delete Scholar"
            cancelLabel="Keep Scholar"
            isDanger={true}
            isLoading={isDeleting}
            onConfirm={async () => {
              setIsDeleting(true);
              try {
                await api.deleteScholar(scholarToEdit.id);
                setShowDeleteConfirm(false);
                if (onDelete) onDelete(scholarToEdit);
                onSuccess();
                onClose();
              } catch (err: any) {
                alert('Failed to delete scholar: ' + err.message);
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
