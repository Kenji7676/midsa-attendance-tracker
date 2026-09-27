import React, { useRef, useState, useEffect } from 'react';
import { Scholar } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import midsaLogo from '../assets/midsa-logo.png';
import { getAccessToken, getCurrentUser, googleSignIn } from '../services/googleAuth';
import { sendScholarEmailPass } from '../services/gmail';
import { ConfirmEmailDispatchModal } from './ConfirmEmailDispatchModal';
import { formatScholarName, resolveScholarScholarshipType } from '../utils/formatters';

interface QrBadgeModalProps {
  scholar: Scholar | null;
  onClose: () => void;
}

export const QrBadgeModal: React.FC<QrBadgeModalProps> = ({ scholar, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Esc to close pass
  useEffect(() => {
    if (!scholar) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scholar, onClose]);

  if (!scholar) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scholar.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePromptEmail = async () => {
    setEmailSuccess(null);
    setEmailError(null);

    const token = await getAccessToken();
    if (!token) {
      try {
        await googleSignIn();
      } catch (err: any) {
        if (err?.code !== 'auth/popup-closed-by-user') {
          setEmailError('Please connect your Google account to send real emails.');
        }
        return;
      }
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setIsConfirmOpen(false);
    setIsSendingEmail(true);
    setEmailSuccess(null);
    setEmailError(null);

    const user = getCurrentUser();
    const formattedName = formatScholarName(scholar);

    try {
      const subject = `Your Official MIDSA Digital QR Pass - ${formattedName} (${scholar.student_id})`;
      const body = `Dear ${formattedName},\n\nWe are pleased to provide you with your official MIDSA Digital Scholar Attendance Pass.\n\nYour Scholar Profile:\n• Student ID: ${scholar.student_id}\n• Year & Program: ${scholar.year_program}\n• College: ${scholar.college}\n• Registered Email: ${scholar.email}\n• Unique QR Code: ${scholar.qr_code}\n\nYour unique QR code is attached below and ready for scanning at our attendance check-in stations.\n\nThank you for your active participation!\n\nBest regards,\nMIDSA Executive Committee & Secretariat`;

      const result = await sendScholarEmailPass({
        scholar,
        subject,
        body,
        senderName: 'MIDSA Attendance Office',
        senderEmail: user?.email || undefined,
      });

      if (result.success) {
        setEmailSuccess(`Pass successfully delivered to ${scholar.email} via Gmail!`);
      } else {
        setEmailError(result.error || 'Failed to deliver email');
      }
    } catch (err: any) {
      setEmailError(err.message || 'Error transmitting email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const currentUser = getCurrentUser();

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div
          id="qr-badge-modal"
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200 my-auto"
        >
          {/* Modal Top Controls */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#004ACD]" />
              Official Scholar Attendance Pass
            </span>
            <button
              type="button"
              id="close-qr-badge-btn"
              onClick={onClose}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-rose-100 text-slate-700 hover:text-rose-600 border border-slate-300 hover:border-rose-300 transition-colors cursor-pointer font-bold text-xs"
              title="Close Pass (Esc)"
              aria-label="Close Official Scholar Attendance Pass"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          {/* The Printable Digital Badge */}
          <div className="p-6 flex flex-col items-center">
            <div
              ref={badgeRef}
              id={`badge-${scholar.id}`}
              className="w-full bg-gradient-to-b from-[#004ACD] via-[#0165CB] to-[#004ACD] text-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#00F7FF]/50 p-6 relative"
            >
              {/* Background Glow Accents */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00F7FF]/20 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#00F7FF]/15 rounded-full blur-2xl pointer-events-none"></div>

              {/* Pass Header */}
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center shadow overflow-hidden shrink-0">
                    <img
                      src={midsaLogo}
                      alt="MIDSA Logo"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight leading-none text-white">MIDSA</h3>
                    <p className="text-[10px] text-blue-100 font-semibold tracking-wider">
                      MSU-IIT DOST-SEI Scholars' Association
                    </p>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 border border-[#00F7FF]/40 text-[10px] font-bold text-[#00F7FF]">
                  VALID SCHOLAR
                </div>
              </div>

              {/* QR Code Container */}
              <div className="bg-white rounded-xl p-4 shadow-inner flex flex-col items-center justify-center my-3 mx-auto w-52 h-52 border-2 border-[#00F7FF]">
                <QRCodeSVG
                  value={scholar.qr_code}
                  size={170}
                  level="H"
                  includeMargin={false}
                  fgColor="#004ACD"
                  bgColor="#FFFFFF"
                />
              </div>

              <div className="text-center my-2">
                <div className="font-mono text-xs text-[#00F7FF] font-semibold tracking-wider select-all bg-black/25 py-1 px-3 rounded-full inline-block">
                  {scholar.qr_code}
                </div>
              </div>

              {/* Scholar Identity Section */}
              <div className="mt-4 pt-3 border-t border-white/15 text-center">
                <h4 className="font-bold text-lg text-white leading-tight">{formatScholarName(scholar)}</h4>
                <p className="text-xs text-[#00F7FF] font-mono font-medium mt-0.5">
                  ID: {scholar.student_id}
                </p>

                <div className="mt-2.5 grid grid-cols-1 gap-1 text-[11px] text-blue-100/90 text-left bg-black/20 p-2.5 rounded-lg">
                  <div>
                    <span className="text-white/60 font-medium">Scholarship: </span>
                    <span className="font-bold text-[#00F7FF]">{resolveScholarScholarshipType(scholar)}</span>
                  </div>
                  <div>
                    <span className="text-white/60 font-medium">Year & Program: </span>
                    <span className="font-semibold text-white">{scholar.year_program}</span>
                  </div>
                  <div>
                    <span className="text-white/60 font-medium">College: </span>
                    <span className="font-semibold text-white">{scholar.college}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-white/60 font-medium">Email: </span>
                    <span className="font-semibold text-white">{scholar.email}</span>
                  </div>
                </div>
              </div>

              {/* Security Footer */}
              <div className="mt-3 pt-2 text-center text-[10px] text-blue-200/70 font-medium flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-[#00F7FF]" />
                <span>Scan at attendance station for instant check-in</span>
              </div>
            </div>

            {/* Email dispatch feedback */}
            {emailSuccess && (
              <div className="w-full mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{emailSuccess}</span>
              </div>
            )}
            {emailError && (
              <div className="w-full mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{emailError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-2 mt-4">
              <button
                type="button"
                id="email-qr-pass-btn"
                onClick={handlePromptEmail}
                disabled={isSendingEmail}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#0165CB] hover:to-[#004ACD] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending Real Email to {scholar.email}...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 text-[#00F7FF]" />
                    <span>Email QR Pass to {scholar.email}</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Code Copied!' : 'Copy QR Token'}</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border border-[#004ACD] text-[#004ACD] hover:bg-blue-50 text-xs font-semibold transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Pass</span>
                </button>
              </div>

              <button
                type="button"
                id="close-qr-badge-bottom-btn"
                onClick={onClose}
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-700 hover:text-rose-600 text-xs font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                <span>Close Pass</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      <ConfirmEmailDispatchModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSend}
        scholars={[scholar]}
        senderEmail={currentUser?.email || ''}
        senderName="MIDSA Attendance Office"
        subject={`Your Official MIDSA Digital QR Pass - ${scholar.name} (${scholar.student_id})`}
        isSending={isSendingEmail}
      />
    </>
  );
};
