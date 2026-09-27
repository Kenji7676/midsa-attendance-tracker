import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Download, Loader2, Award } from 'lucide-react';
import { api } from '../services/api';
import { ScholarshipCategory, ScholarshipSubcategory } from '../types';
import {
  formatScholarName,
  parseScholarName,
  formatYearProgram,
  parseYearProgram,
  formatScholarshipType,
  parseScholarshipType,
  normalizeYearLevel,
  cleanAcademicProgram,
} from '../utils/formatters';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedScholarRow {
  student_id: string;
  name: string;
  last_name: string;
  first_name: string;
  middle_initial: string;
  year_level: string;
  academic_program: string;
  year_program: string;
  college: string;
  scholarship_category: ScholarshipCategory;
  scholarship_subcategory: ScholarshipSubcategory;
  scholarship_type: string;
  email: string;
  gawad_isko_awardee?: 'yes' | 'no';
  valid: boolean;
  error?: string;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedScholarRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ addedCount: number; skippedCount: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'Student ID,Surname,First Name,M.I.,Year,Academic Program,College,Scholarship Type,Email Address,Gawad Isko Awardee\n' +
      '2024-0001,La Cruz,Juan,D.,3rd Year,BS Computer Science,College of Computer Studies,RA 7687,juan.lacruz@g.msuiit.edu.ph,yes\n' +
      '2024-0002,Santos,Maria Clara,L.,2nd Year,BS Information Technology,College of Computer Studies,JLSS (MERIT),maria.santos@midsa.org,no\n' +
      '2023-0003,Reyes,Angela Nicole,M.,1st Year,BS Computer Engineering,College of Engineering,MOST,angela.reyes@midsa.org,yes\n' +
      '2025-0004,Gomez,Rafael Mateo,P.,4th Year,BS Mathematics,College of Science and Mathematics,JLSS (RA 10612),rafael.gomez@midsa.org,no\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'MIDSA_Scholars_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (uploadedFile: File) => {
    if (!uploadedFile.name.endsWith('.csv') && uploadedFile.type !== 'text/csv') {
      alert('Please upload a valid .csv file.');
      return;
    }

    setFile(uploadedFile);
    setIsParsing(true);
    setSubmitResult(null);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedScholarRow[] = [];

        results.data.forEach((row: any) => {
          const student_id = (row['Student ID'] || row['student_id'] || row['StudentID'] || row['ID'] || '').toString().trim().toUpperCase();

          // Granular Name parsing
          let surname = (row['Surname'] || row['Last Name'] || row['last_name'] || row['lastName'] || row['surname'] || '').toString().trim();
          let firstName = (row['First Name'] || row['first_name'] || row['firstName'] || row['firstname'] || '').toString().trim();
          let mi = (row['M.I.'] || row['MI'] || row['Middle Initial'] || row['middle_initial'] || row['middleInitial'] || '').toString().trim();
          const legacyName = (row['Student Name'] || row['Name'] || row['student_name'] || row['Full Name'] || '').toString().trim();

          if (!surname || !firstName) {
            if (legacyName) {
              const parsed = parseScholarName(legacyName);
              surname = parsed.lastName;
              firstName = parsed.firstName;
              mi = parsed.middleInitial;
            }
          }

          const formattedName = formatScholarName({
            last_name: surname,
            first_name: firstName,
            middle_initial: mi,
          });

          // Year and Academic Program parsing
          const rawYear = (row['Year'] || row['Year Level'] || row['year_level'] || row['year'] || row['yearLevel'] || '').toString().trim();
          const rawProg = (row['Academic Program'] || row['Program'] || row['academic_program'] || row['academicProgram'] || row['Course'] || '').toString().trim();
          const legacyYearProgram = (row['Year/Program'] || row['year_program'] || '').toString().trim();

          let yearLevel = rawYear ? normalizeYearLevel(rawYear, student_id) : '';
          let academicProgram = cleanAcademicProgram(rawProg);

          if (!rawYear && legacyYearProgram) {
            const parsedYp = parseYearProgram(legacyYearProgram, student_id);
            yearLevel = parsedYp.yearLevel;
            if (!rawProg) {
              academicProgram = parsedYp.academicProgram;
            }
          }

          if (!yearLevel) {
            yearLevel = normalizeYearLevel(null, student_id);
          }

          if (!rawProg && !legacyYearProgram) {
            academicProgram = 'BS Computer Science';
          }

          const formattedYearProgram = formatYearProgram(yearLevel, academicProgram, student_id);
          const college = (row['College'] || row['Department'] || row['college'] || 'College of Computer Studies').toString().trim();
          const email = (row['Email Address'] || row['Email'] || row['email'] || `${student_id.toLowerCase()}@g.msuiit.edu.ph`).toString().trim();

          // Scholarship Type parsing
          const rawScholarship = (
            row['Scholarship Type'] ||
            row['Scholarship'] ||
            row['scholarship_type'] ||
            row['scholarshipType'] ||
            row['scholarship'] ||
            row['Category'] ||
            row['Type'] ||
            ''
          ).toString().trim();

          const parsedSt = parseScholarshipType(rawScholarship);
          const schCat = (row.scholarship_category || parsedSt.category) as ScholarshipCategory;
          const schSub = (row.scholarship_subcategory !== undefined ? row.scholarship_subcategory : parsedSt.subcategory) as ScholarshipSubcategory;
          const schType = formatScholarshipType(schCat, schSub);

          const rawAwardee = (
            row['Gawad Isko Awardee'] ||
            row['Gawad Isko Awardee?'] ||
            row['Gawad Isko'] ||
            row['gawad_isko_awardee'] ||
            row['gawad_isko'] ||
            ''
          ).toString().trim().toLowerCase();
          const schAwardee: 'yes' | 'no' = ['yes', 'y', 'true', '1'].includes(rawAwardee) ? 'yes' : 'no';

          const isFormatValid = /^\d{4}-\d{4}$/.test(student_id);

          let error: string | undefined;
          if (!student_id) {
            error = 'Missing Student ID';
          } else if (!isFormatValid) {
            error = 'ID must follow XXXX-XXXX format (e.g. 2024-0001)';
          } else if (!surname && !legacyName) {
            error = 'Missing Scholar Name';
          }

          const valid = Boolean(student_id && (surname || legacyName) && isFormatValid);
          rows.push({
            student_id,
            name: formattedName,
            last_name: surname,
            first_name: firstName,
            middle_initial: mi,
            year_level: yearLevel,
            academic_program: academicProgram,
            year_program: formattedYearProgram,
            college,
            scholarship_category: schCat,
            scholarship_subcategory: schSub,
            scholarship_type: schType,
            email,
            gawad_isko_awardee: schAwardee,
            valid,
            error,
          });
        });

        setParsedData(rows);
        setIsParsing(false);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        alert('Failed to parse CSV file: ' + err.message);
        setIsParsing(false);
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await api.batchRegisterScholars(validRows);
      setSubmitResult(res);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      alert('Error importing scholars: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setParsedData([]);
    setSubmitResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ACD] text-[#00F7FF] flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Batch Register Scholars via CSV</h3>
              <p className="text-xs text-slate-500">Automatically creates scholar accounts and generates unique QR codes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template Download Prompt */}
          <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-[#0165CB]/20 rounded-xl">
            <div className="flex items-center space-x-2.5">
              <FileText className="w-5 h-5 text-[#004ACD]" />
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#004ACD]">Need the standard CSV format?</span>
                  <span className="text-[10px] font-mono font-bold bg-[#004ACD]/10 text-[#004ACD] px-1.5 py-0.5 rounded border border-[#004ACD]/20">
                    ID Format: XXXX-XXXX (e.g. 2024-0001)
                  </span>
                </div>
                <p className="text-slate-600">Includes scholarship type (UGS RA 7687/MERIT, JLSS, MOST) and profile fields.</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#004ACD] text-[#004ACD] hover:bg-blue-50 text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {!file ? (
            /* Upload Drop Area */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-[#00F7FF] bg-cyan-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-[#004ACD] hover:bg-slate-50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#004ACD] flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Click to browse or drag & drop CSV file</h4>
              <p className="text-xs text-slate-500 mt-1">Columns: Student ID, Surname, First Name, M.I., Year, Academic Program, College, Scholarship Type, Email</p>
            </div>
          ) : (
            /* File Info & Data Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl text-xs">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-[#004ACD]" />
                  <span className="font-bold text-slate-800">{file.name}</span>
                  <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={resetAll}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Choose Different File
                </button>
              </div>

              {isParsing ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-[#004ACD] mb-2" />
                  <span>Parsing CSV rows...</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Parsed Preview: {parsedData.filter((r) => r.valid).length} valid scholars
                    </span>
                    {parsedData.some((r) => !r.valid) && (
                      <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {parsedData.filter((r) => !r.valid).length} invalid rows skipped
                      </span>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Student ID</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Year & Program</th>
                          <th className="py-2 px-3">Scholarship</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.map((row, idx) => (
                          <tr key={idx} className={row.valid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{row.student_id || '—'}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{row.name || '—'}</td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">{row.year_program}</td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#004ACD] border border-blue-200">
                                {row.scholarship_type}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {row.valid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {submitResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Import Complete! Added {submitResult.addedCount} scholars.</span>
                  </div>
                  {submitResult.skippedCount > 0 && (
                    <p className="text-emerald-700">
                      {submitResult.skippedCount} rows skipped (e.g. duplicate Student IDs already in SQLite).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isSubmitting || parsedData.filter((r) => r.valid).length === 0}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all ${
              isSubmitting || parsedData.filter((r) => r.valid).length === 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-[#004ACD] hover:bg-[#0165CB] shadow-md shadow-blue-500/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registering Scholars...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Register {parsedData.filter((r) => r.valid).length} Scholars & Generate QRs</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
