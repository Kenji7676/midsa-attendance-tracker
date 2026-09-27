import React, { useState, useEffect } from 'react';
import { Scholar } from '../types';
import { Award, CheckCircle2, Sparkles, X, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatScholarName, resolveScholarScholarshipType } from '../utils/formatters';

interface GawadIskoCertModalProps {
  isOpen: boolean;
  scholar: Scholar | null;
  onProceed: (receivedCertificate: boolean) => Promise<void> | void;
}

export const GawadIskoCertModal: React.FC<GawadIskoCertModalProps> = ({
  isOpen,
  scholar,
  onProceed,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && scholar) {
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#EAB308', '#004ACD', '#00F7FF', '#FFFFFF'],
        });
      } catch {
        // Ignore confetti error
      }
    }
  }, [isOpen, scholar]);

  if (!isOpen || !scholar) return null;

  const handleAction = async (received: boolean) => {
    setIsSubmitting(true);
    try {
      await onProceed(received);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = formatScholarName(scholar);
  const scholarshipType = resolveScholarScholarshipType(scholar);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-2 border-amber-400/80 my-8 animate-in zoom-in-95 duration-200 text-center relative">
        {/* Top Celebration Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-6 text-slate-950 relative overflow-hidden">
          {/* Subtle sparkles background pattern */}
          <div className="absolute top-2 left-4 text-amber-200/40">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="absolute bottom-2 right-4 text-amber-200/40">
            <Sparkles className="w-10 h-10" />
          </div>

          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/90 shadow-lg flex items-center justify-center text-amber-600 border-2 border-amber-300">
            <Award className="w-9 h-9" />
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/80 text-amber-950 text-xs font-black uppercase tracking-wider mb-1 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sign-In Confirmed</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight mt-1">
            Congratulations, Gawad Isko Awardee!
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-amber-950/80 mt-1 max-w-sm mx-auto">
            Your attendance has been officially recorded for this event.
          </p>
        </div>

        {/* Scholar Identity Card */}
        <div className="p-6 space-y-5">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                Gawad Isko Honor
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {scholar.student_id}
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {displayName}
            </h4>
            <div className="text-xs text-slate-600 flex flex-wrap gap-x-2 gap-y-1">
              <span className="font-semibold text-[#004ACD]">{scholarshipType}</span>
              <span>•</span>
              <span>{scholar.year_program}</span>
              <span>•</span>
              <span>{scholar.college}</span>
            </div>
          </div>

          {/* Certificate Question Box */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl p-4 border border-slate-200 text-center space-y-2">
            <div className="text-sm sm:text-base font-extrabold text-slate-800">
              Have you received your certificate?
            </div>
            <p className="text-xs text-slate-500">
              Please confirm so we can record your Gawad Isko certificate status and proceed to sign in another student.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction(false)}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 active:scale-98 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              No / Not Yet
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction(true)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Yes, Received</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Clicking either option will immediately proceed to sign in another student.
          </div>
        </div>
      </div>
    </div>
  );
};
