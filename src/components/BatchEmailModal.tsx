import React, { useState, useEffect } from 'react';
import { Scholar, EmailTemplate } from '../types';
import { api } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Mail,
  Send,
  X,
  Sparkles,
  Eye,
  Edit3,
  Users,
  CheckCircle2,
  FileText,
  Save,
  RotateCcw,
  Loader2,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  subscribeAuth,
  googleSignIn,
  getCurrentUser,
  getAccessToken,
} from '../services/googleAuth';
import { sendBatchScholarEmailPasses, SendResult } from '../services/gmail';
import { ConfirmEmailDispatchModal } from './ConfirmEmailDispatchModal';
import {
  formatScholarName,
  DEFAULT_MSUIIT_COLLEGES,
  personalizeEmailTemplate,
  EMAIL_PERSONALIZATION_TOKENS,
  EXAMPLE_SCHOLAR,
} from '../utils/formatters';
import { GoogleAuthButton } from './GoogleAuthButton';
import { User } from 'firebase/auth';

interface BatchEmailModalProps {
  isOpen: boolean;
  scholars: Scholar[];
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchEmailModal: React.FC<BatchEmailModalProps> = ({
  isOpen,
  scholars,
  onClose,
  onSuccess,
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState('My Custom QR Template');
  const [subject, setSubject] = useState('Your Official MIDSA Digital QR Pass - {{name}} ({{student_id}})');
  const [body, setBody] = useState(
    'Dear {{name}},\n\nWe are pleased to provide you with your official MIDSA Digital Scholar Attendance Pass.\n\nYour Scholar Profile:\n• Student ID: {{student_id}}\n• Program: {{program}}\n• College: {{college}}\n• Registered Email: {{email}}\n• Unique QR Code: {{qr_code}}\n\nYour unique QR code is attached below and ready for scanning at our attendance check-in stations. You can display this email on your smartphone or print out your pass.\n\nThank you for your active participation!\n\nBest regards,\nMIDSA Executive Committee & Secretariat'
  );
  const [senderName, setSenderName] = useState('MIDSA Attendance Office');

  // Google Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Filter recipients
  const [recipientFilter, setRecipientFilter] = useState<'all' | string>('all');
  const [previewScholarIndex, setPreviewScholarIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Sending status
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [currentSendingStatus, setCurrentSendingStatus] = useState<string>('');
  const [batchResults, setBatchResults] = useState<SendResult[] | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Confirmation dialog
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Colleges for filtering
  const colleges = Array.from(
    new Set([...DEFAULT_MSUIIT_COLLEGES, ...scholars.map((s) => s.college).filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b));

  const targetScholars = scholars.filter((s) => {
    if (recipientFilter === 'all') return true;
    return s.college === recipientFilter;
  });

  useEffect(() => {
    const unsub = subscribeAuth((state) => {
      setCurrentUser(state.user);
      setAccessToken(state.accessToken);
    });
    getAccessToken().then((t) => setAccessToken(t));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setBatchResults(null);
      setSendProgress(0);
      setCurrentSendingStatus('');
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const data = await api.getEmailTemplates();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
        setTemplateName(data[0].name);
        setSubject(data[0].subject);
        setBody(data[0].body);
      }
    } catch (err) {
      console.error('Error loading email templates:', err);
    }
  };

  if (!isOpen) return null;

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setTemplateName(tmpl.name);
      setSubject(tmpl.subject);
      setBody(tmpl.body);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (selectedTemplateId && !selectedTemplateId.startsWith('new')) {
        await api.updateEmailTemplate(selectedTemplateId, {
          name: templateName,
          subject,
          body,
        });
      } else {
        const created = await api.createEmailTemplate({
          name: templateName,
          subject,
          body,
        });
        setSelectedTemplateId(created.id);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      loadTemplates();
    } catch (err: any) {
      alert('Failed to save template: ' + err.message);
    }
  };

  const insertVariable = (variableTag: string) => {
    setBody((prev) => prev + ' ' + variableTag);
  };

  const safeIndex = targetScholars.length > 0 ? Math.min(previewScholarIndex, targetScholars.length - 1) : 0;
  const currentPreviewScholar = targetScholars[safeIndex] || scholars[0] || EXAMPLE_SCHOLAR;

  const renderPersonalized = (text: string, scholar?: Scholar | null) => {
    if (!scholar) return text;
    return personalizeEmailTemplate(text, scholar);
  };

  const handlePromptSend = () => {
    if (targetScholars.length === 0) {
      alert('No scholars selected to email.');
      return;
    }

    if (!currentUser || !accessToken) {
      // Prompt user to connect Google account first
      alert('Please connect your Google account first using the "Sign in with Google" button above.');
      return;
    }

    // Open the mandatory explicit confirmation modal
    setIsConfirmModalOpen(true);
  };

  const handleConfirmedSend = async () => {
    setIsConfirmModalOpen(false);
    setIsSending(true);
    setSendProgress(5);
    setCurrentSendingStatus('Preparing personalized QR passes and attachments...');
    setBatchResults(null);

    try {
      const results = await sendBatchScholarEmailPasses(
        targetScholars,
        {
          subject,
          body,
          senderName,
        },
        (current, total, lastResult) => {
          const pct = Math.round((current / total) * 100);
          setSendProgress(pct);
          setCurrentSendingStatus(
            `Delivered ${current} of ${total}: ${lastResult.email} ${lastResult.success ? '✓' : '✗'}`
          );
        }
      );

      setBatchResults(results);
      setSendProgress(100);

      // Also record the campaign to the SQLite database
      const scholarIds = targetScholars.map((s) => s.id);
      await api.sendBatchEmail({
        subject,
        body,
        sender_name: senderName,
        scholar_ids: scholarIds,
      }).catch((err) => console.warn('Local SQLite campaign log error:', err));

      onSuccess();
    } catch (err: any) {
      alert('Failed to dispatch emails: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const successfulSends = batchResults ? batchResults.filter((r) => r.success).length : 0;
  const failedSends = batchResults ? batchResults.filter((r) => !r.success) : [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#004ACD] text-[#00F7FF] flex items-center justify-center font-bold">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <span>Batch Email QR Passes to Scholars</span>
                  <span className="text-[10px] bg-cyan-100 text-[#004ACD] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Gmail API Delivery
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Send personalized emails with embedded QR code passes directly to scholars' inboxes.
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

          {/* Sender Google Account Banner */}
          <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-medium">Sending From:</span>
              {currentUser && accessToken ? (
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-mono font-bold text-[#004ACD] bg-white px-2 py-0.5 rounded border border-blue-200">
                    {currentUser.email}
                  </span>
                  <span className="text-slate-400 text-[11px]">({currentUser.displayName || 'Google Account'})</span>
                </div>
              ) : (
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> No Google account connected
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <GoogleAuthButton compact />
            </div>
          </div>

          {/* Modal Body: Two Tabs (Editor vs Live Scholar Preview) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Top Controls: Template Selector & Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {/* Template Selector */}
              <div className="flex items-center space-x-2 flex-1">
                <FileText className="w-4 h-4 text-[#004ACD] shrink-0" />
                <div className="flex-1">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Preset Template:</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                    <option value="new">+ Create Fresh Custom Template</option>
                  </select>
                </div>
              </div>

              {/* Recipient Filter */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#004ACD] shrink-0" />
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Recipients:</span>
                  <select
                    value={recipientFilter}
                    onChange={(e) => {
                      setRecipientFilter(e.target.value);
                      setPreviewScholarIndex(0);
                    }}
                    className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                  >
                    <option value="all">All Registered Scholars ({scholars.length})</option>
                    {colleges.map((c) => (
                      <option key={c} value={c}>
                        {c.replace('College of ', '')} ({scholars.filter((s) => s.college === c).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-200 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'editor'
                      ? 'bg-white text-[#004ACD] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'preview'
                      ? 'bg-white text-[#004ACD] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Template Editor */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                {/* Template Name & Sender Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Title
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sender Organization / Display Name
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                    />
                  </div>
                </div>

                {/* Subject Line */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                  />
                </div>

                {/* Dynamic Variables Pill Toolbar */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#004ACD]" />
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Insert Dynamic Personalization Tokens:
                      </span>
                    </div>
                    {currentPreviewScholar && (
                      <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                        Simulating values for: <strong className="text-[#004ACD]">{currentPreviewScholar.student_id}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EMAIL_PERSONALIZATION_TOKENS.map((v) => {
                      const liveVal = currentPreviewScholar ? v.example(currentPreviewScholar) : '';
                      return (
                        <button
                          key={v.tag}
                          type="button"
                          onClick={() => insertVariable(v.tag)}
                          title={`${v.description} - Current value: "${liveVal}"`}
                          className="group px-2 py-1 rounded-lg bg-white border border-slate-300 hover:border-[#004ACD] hover:bg-blue-50 text-[#004ACD] font-mono text-[11px] font-semibold transition-all shadow-2xs flex items-center space-x-1"
                        >
                          <span>+ {v.tag}</span>
                          <span className="text-slate-400 group-hover:text-slate-600 font-sans font-normal text-[10px]">
                            ({v.label})
                          </span>
                          {liveVal && (
                            <span className="max-w-[130px] truncate text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded ml-1 border border-emerald-200">
                              {liveVal}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Email Body Content
                    </label>
                    <span className="text-[11px] text-slate-400">
                      The official digital QR pass and instructions are automatically embedded below your text.
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#004ACD]"
                  />
                </div>

                {/* Save Template Button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saveSuccess ? 'Template Saved!' : 'Save Template Preset'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Live Scholar Preview */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                {/* Scholar Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/60 p-2.5 rounded-xl border border-[#0165CB]/20 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600 shrink-0">Simulating Recipient:</span>
                    {targetScholars.length > 0 ? (
                      <select
                        value={safeIndex}
                        onChange={(e) => setPreviewScholarIndex(Number(e.target.value))}
                        className="text-xs font-bold text-[#004ACD] bg-white border border-blue-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#004ACD] max-w-[280px] sm:max-w-[360px] truncate"
                      >
                        {targetScholars.map((s, idx) => (
                          <option key={s.id} value={idx}>
                            {formatScholarName(s)} ({s.student_id}) - {s.college.replace('College of ', '')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400 italic">No scholars in selected college</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      disabled={safeIndex === 0}
                      onClick={() => setPreviewScholarIndex((i) => Math.max(0, i - 1))}
                      className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-medium"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-slate-500 font-mono">
                      {targetScholars.length > 0 ? safeIndex + 1 : 0} / {targetScholars.length}
                    </span>
                    <button
                      disabled={safeIndex >= targetScholars.length - 1}
                      onClick={() => setPreviewScholarIndex((i) => Math.min(targetScholars.length - 1, i + 1))}
                      className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-medium"
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Email Client Simulated Window */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-xs space-y-1">
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-semibold">From:</span>
                      <span className="text-slate-800 font-medium">
                        {senderName} &lt;{currentUser?.email || 'midsa@g.msuiit.edu.ph'}&gt;
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-semibold">To:</span>
                      <span className="text-slate-800 font-medium">
                        {currentPreviewScholar ? formatScholarName(currentPreviewScholar) : 'La Cruz, Juan D.'} &lt;{currentPreviewScholar?.email || 'juan.lacruz@g.msuiit.edu.ph'}&gt;
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 text-slate-500 font-semibold">Subject:</span>
                      <span className="text-slate-900 font-bold">
                        {renderPersonalized(subject, currentPreviewScholar)}
                      </span>
                    </div>
                  </div>

                  {/* Rendered HTML Preview */}
                  <div className="p-6 space-y-4 text-xs text-slate-700 bg-white">
                    <div className="whitespace-pre-line leading-relaxed font-sans text-sm">
                      {renderPersonalized(body, currentPreviewScholar)}
                    </div>

                    {/* QR Code Pass Card in email */}
                    {currentPreviewScholar && (
                      <div className="bg-slate-50 border-2 border-[#004ACD]/30 rounded-xl p-5 text-center max-w-sm mx-auto my-4 shadow-xs">
                        <div className="text-xs font-bold text-[#004ACD] uppercase tracking-wider mb-2">
                          Official MIDSA Digital Attendance Pass
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-inner inline-block mx-auto border border-slate-200">
                          <QRCodeSVG
                            value={currentPreviewScholar.qr_code}
                            size={160}
                            fgColor="#004ACD"
                            bgColor="#FFFFFF"
                          />
                        </div>
                        <div className="mt-2.5 font-bold text-slate-800 text-sm">
                          {formatScholarName(currentPreviewScholar)}
                        </div>
                        <div className="font-mono text-xs font-bold text-[#004ACD]">
                          {currentPreviewScholar.student_id}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {currentPreviewScholar.qr_code}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-600 bg-white py-1 px-2.5 rounded border border-slate-200">
                          {currentPreviewScholar.year_program} • {currentPreviewScholar.college}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">
                          Present this QR code to the scanner station upon entering the venue.
                        </p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400">
                      MSU-IIT DOST-SEI Scholars' Association • Official Digital Attendance Pass
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sending Progress Bar */}
            {isSending && (
              <div className="p-4 bg-blue-50 border border-[#004ACD]/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-[#004ACD]">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-[#004ACD]" />
                    <span>{currentSendingStatus || `Sending emails to ${targetScholars.length} scholars...`}</span>
                  </span>
                  <span>{sendProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#004ACD] to-[#00F7FF] transition-all duration-300"
                    style={{ width: `${sendProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Sent Summary / Results */}
            {batchResults && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-3">
                <div className="flex items-center space-x-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>
                    Dispatched {successfulSends} of {batchResults.length} real email pass{batchResults.length > 1 ? 'es' : ''} via Gmail!
                  </span>
                </div>
                <p className="text-emerald-700">
                  Emails were transmitted directly from <strong className="font-mono">{currentUser?.email}</strong> with attached QR passes.
                </p>

                {failedSends.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                    <p className="font-bold">Notice: {failedSends.length} email(s) encountered delivery errors:</p>
                    {failedSends.map((f) => (
                      <p key={f.scholarId} className="font-mono">
                        • {f.email}: {f.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              Targeting <strong className="text-slate-800">{targetScholars.length}</strong> of{' '}
              <strong className="text-slate-800">{scholars.length}</strong> scholars
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>

              <button
                onClick={handlePromptSend}
                disabled={isSending || targetScholars.length === 0}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${
                  isSending || targetScholars.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[#004ACD] hover:bg-[#0165CB] shadow-md shadow-blue-500/20'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Transmitting Passes...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#00F7FF]" />
                    <span>Send Real Emails to {targetScholars.length} Scholars</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      <ConfirmEmailDispatchModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmedSend}
        scholars={targetScholars}
        senderEmail={currentUser?.email || ''}
        senderName={senderName}
        subject={renderPersonalized(subject, targetScholars[0])}
        isSending={isSending}
      />
    </>
  );
};
