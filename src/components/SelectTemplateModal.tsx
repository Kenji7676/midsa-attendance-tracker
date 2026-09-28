import React, { useState, useEffect } from 'react';
import { Scholar, EmailTemplate } from '../types';
import { api } from '../services/api';
import {
  Mail,
  Send,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import {
  subscribeAuth,
  getCurrentUser,
  getAccessToken,
} from '../services/googleAuth';
import { sendBatchScholarEmailPasses, SendResult } from '../services/gmail';
import { formatScholarName, personalizeEmailTemplate } from '../utils/formatters';
import { GoogleAuthButton } from './GoogleAuthButton';
import { User } from 'firebase/auth';

interface SelectTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholars: Scholar[];
  onSuccess?: () => void;
}

export const SelectTemplateModal: React.FC<SelectTemplateModalProps> = ({
  isOpen,
  onClose,
  scholars,
  onSuccess,
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Fallback default template if none exist in database
  const defaultTemplate: EmailTemplate = {
    id: 'default-template',
    name: 'Official Digital Attendance Pass',
    subject: 'Your Official MIDSA Digital QR Pass - {{name}} ({{student_id}})',
    body: 'Dear {{name}},\n\nWe are pleased to provide you with your official MIDSA Digital Scholar Attendance Pass.\n\nYour Scholar Profile:\n• Student ID: {{student_id}}\n• Program: {{program}}\n• College: {{college}}\n• Registered Email: {{email}}\n• Unique QR Code: {{qr_code}}\n\nYour unique QR code is attached below and ready for scanning at our attendance sign-in stations. You can display this email on your smartphone or print out your pass.\n\nThank you for your active participation!\n\nBest regards,\nMIDSA Executive Committee & Secretariat',
    created_at: new Date().toISOString(),
  };

  // Google Auth
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Sending status
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [currentProgressText, setCurrentProgressText] = useState('');
  const [sendResults, setSendResults] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth((state) => {
      setCurrentUser(state.user);
      setAccessToken(state.accessToken);
    });
    getAccessToken().then((token) => setAccessToken(token));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSendResults(null);
      setErrorMessage(null);
      setIsSending(false);
      setSendProgress(0);
      setCurrentProgressText('');
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await api.getEmailTemplates();
      setTemplates(data);
      if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
      } else {
        setSelectedTemplateId(defaultTemplate.id);
      }
    } catch (err) {
      console.error('Failed to load email templates:', err);
      setSelectedTemplateId(defaultTemplate.id);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  if (!isOpen || scholars.length === 0) return null;

  const allAvailableTemplates = templates.length > 0 ? templates : [defaultTemplate];
  const activeTemplate =
    allAvailableTemplates.find((t) => t.id === selectedTemplateId) || allAvailableTemplates[0];

  const primaryScholar = scholars[0];
  const previewSubject = activeTemplate
    ? personalizeEmailTemplate(activeTemplate.subject, primaryScholar)
    : '';
  const previewBody = activeTemplate
    ? personalizeEmailTemplate(activeTemplate.body, primaryScholar)
    : '';

  const handleSend = async () => {
    if (!currentUser || !accessToken) {
      setErrorMessage('Please connect your Google Workspace account with Gmail permissions.');
      return;
    }

    if (!activeTemplate) {
      setErrorMessage('Please select an email template first.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setSendProgress(0);
    setCurrentProgressText(`Preparing ${scholars.length} pass(es)...`);

    try {
      const results: SendResult[] = await sendBatchScholarEmailPasses(
        scholars,
        {
          subject: activeTemplate.subject,
          body: activeTemplate.body,
          senderName: 'MIDSA Attendance Office',
        },
        (current, total, lastResult) => {
          setSendProgress(Math.round((current / total) * 100));
          setCurrentProgressText(
            `Transmitted ${current} of ${total} (${lastResult.studentId}): ${
              lastResult.success ? 'Delivered' : 'Failed'
            }`
          );
        }
      );

      const successfulCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successfulCount;

      setSendResults({
        total: results.length,
        success: successfulCount,
        failed: failedCount,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch email passes.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSending) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="select-template-modal"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#004ACD] flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Select Email Template
              </h3>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {scholars.length === 1
                  ? `For ${formatScholarName(primaryScholar)} (${primaryScholar.student_id})`
                  : `For ${scholars.length} selected scholars`}
              </p>
            </div>
          </div>
          {!isSending && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Success state */}
          {sendResults ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Emails Successfully Dispatched</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Sent {sendResults.success} of {sendResults.total} QR passes directly to student inboxes via Gmail.
                </p>
                {sendResults.failed > 0 && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">
                    {sendResults.failed} recipient(s) failed delivery.
                  </p>
                )}
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#004ACD] hover:bg-[#0165CB] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Recipient Summary */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <Users className="w-4 h-4 text-[#004ACD] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 block truncate">
                      {scholars.length === 1
                        ? formatScholarName(primaryScholar)
                        : `${scholars.length} Scholars Selected`}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block">
                      {scholars.length === 1
                        ? `${primaryScholar.email} • ${primaryScholar.student_id}`
                        : `${scholars.map((s) => s.student_id).slice(0, 3).join(', ')}${
                            scholars.length > 3 ? ` +${scholars.length - 3} more` : ''
                          }`}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#004ACD]/10 text-[#004ACD] text-[10px] font-bold shrink-0 ml-2">
                  {scholars.length} recipient{scholars.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Template Selection Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Choose Email Template</span>
                  {isLoadingTemplates && (
                    <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                    </span>
                  )}
                </label>

                <div className="relative">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={isSending}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#004ACD] cursor-pointer appearance-none"
                  >
                    {allAvailableTemplates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Template Live Preview Card */}
              {activeTemplate && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 text-xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-slate-500 font-semibold text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-[#004ACD]" />
                    <span>Live Preview ({primaryScholar.student_id})</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Subject:</span>
                    <p className="font-bold text-slate-800 text-xs leading-snug line-clamp-2">
                      {previewSubject}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Body Preview:</span>
                    <p className="text-[11px] text-slate-600 line-clamp-3 whitespace-pre-line bg-white p-2 rounded-lg border border-slate-200/80 font-sans">
                      {previewBody}
                    </p>
                  </div>

                  <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Attached: Official QR Attendance Badge PNG</span>
                  </div>
                </div>
              )}

              {/* Google Account Connection Status */}
              <div>
                {!currentUser || !accessToken ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-start space-x-2 text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Google Workspace Required</span>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Sign in with Google to send official digital passes directly from your account via Gmail.
                        </p>
                      </div>
                    </div>
                    <div className="pt-1">
                      <GoogleAuthButton />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl text-xs border border-slate-200">
                    <div className="flex items-center space-x-2 truncate">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-600 truncate">
                        Sender: <strong className="text-slate-800">{currentUser.email}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 ml-1">
                      Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Sending Progress */}
              {isSending && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#004ACD]" />
                      <span>{currentProgressText}</span>
                    </span>
                    <span className="font-mono text-[#004ACD]">{sendProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#004ACD] to-[#00F7FF] transition-all duration-200"
                      style={{ width: `${sendProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || !currentUser || !accessToken}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#0165CB] hover:to-[#004ACD] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-[#00F7FF]" />
                      <span>
                        {scholars.length === 1
                          ? 'Send Email Pass'
                          : `Send to ${scholars.length} Scholars`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
