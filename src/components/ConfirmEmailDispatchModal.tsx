import React from 'react';
import { Mail, AlertTriangle, Send, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Scholar } from '../types';
import { formatScholarName, personalizeEmailTemplate } from '../utils/formatters';

interface ConfirmEmailDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scholars: Scholar[];
  senderEmail: string;
  senderName: string;
  subject: string;
  isSending?: boolean;
}

export const ConfirmEmailDispatchModal: React.FC<ConfirmEmailDispatchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scholars,
  senderEmail,
  senderName,
  subject,
  isSending = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#004ACD] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Confirm Real Email Dispatch
              </h3>
              <p className="text-[11px] text-slate-500">Google Workspace Gmail API</p>
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

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start space-x-3 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Real Email Warning:</span>
              <p className="mt-0.5 text-amber-800">
                You are about to send real emails with official QR attendance passes directly from your connected Google account:
              </p>
              <p className="mt-1 font-mono font-bold text-[#004ACD] bg-white/80 py-1 px-2 rounded border border-amber-200 inline-block">
                {senderEmail} ({senderName})
              </p>
            </div>
          </div>

          {/* Operation Summary */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs bg-slate-50/50">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Total Recipients:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 bg-blue-100 text-[#004ACD] rounded-full">
                {scholars.length} scholar{scholars.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-col space-y-1 text-slate-600">
              <div className="flex justify-between items-center">
                <span className="font-medium">Subject Template:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[240px]" title={subject}>{subject}</span>
              </div>
              {scholars[0] && subject.includes('{{') && (
                <div className="text-[11px] text-[#004ACD] bg-blue-50/80 px-2 py-1 rounded border border-blue-100 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">1st Recipient Preview:</span>
                  <span className="font-bold truncate max-w-[210px]" title={personalizeEmailTemplate(subject, scholars[0])}>
                    {personalizeEmailTemplate(subject, scholars[0])}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Pass Attachment:</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Embedded QR Pass PNG
              </span>
            </div>
          </div>

          {/* Recipient Preview List */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Target Recipients ({scholars.length}):
            </span>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {scholars.map((s) => (
                <div key={s.id} className="p-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="truncate mr-2">
                    <span className="font-semibold text-slate-800 block truncate">{formatScholarName(s)}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{s.student_id}</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-mono shrink-0">{s.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-dispatch-btn"
            onClick={onConfirm}
            disabled={isSending}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#0165CB] hover:to-[#004ACD] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-[#00F7FF]" />
            <span>{isSending ? 'Sending Real Emails...' : `Confirm & Send to ${scholars.length} Scholar${scholars.length > 1 ? 's' : ''}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
