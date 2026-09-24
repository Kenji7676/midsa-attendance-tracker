import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDanger = true,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDanger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-[#004ACD]'
              }`}
            >
              {isDanger ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3.5">
          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

          {detail && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800">
              {detail}
            </div>
          )}

          {isDanger && (
            <div className="flex items-center space-x-2 text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>This action is permanent and cannot be undone.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300'
                : 'bg-[#004ACD] hover:bg-[#0165CB] disabled:bg-blue-300'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                {isDanger && <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
