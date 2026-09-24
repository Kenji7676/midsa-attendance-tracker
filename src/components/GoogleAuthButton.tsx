import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  subscribeAuth,
  googleSignIn,
  googleSignOut,
  getCurrentUser,
  getAccessToken,
} from '../services/googleAuth';
import { CheckCircle2, ChevronDown, LogOut, Mail, RefreshCw, UserCheck } from 'lucide-react';

interface GoogleAuthButtonProps {
  onAuthChange?: (user: User | null, token: string | null) => void;
  compact?: boolean;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onAuthChange,
  compact = false,
}) => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuth(async (state) => {
      setUser(state.user);
      setToken(state.accessToken);
      if (onAuthChange) {
        onAuthChange(state.user, state.accessToken);
      }
    });

    getAccessToken().then((t) => setToken(t));

    return () => unsubscribe();
  }, [onAuthChange]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setToken(res.accessToken);
      setMenuOpen(false);
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request'
      ) {
        if (err?.code === 'auth/popup-blocked') {
          setErrorMessage('Sign-in popup was blocked by browser. Please allow popups for this site.');
        } else {
          setErrorMessage(err.message || 'Failed to sign in with Google');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    // googleSignIn uses prompt: 'select_account' to allow picking any other email
    await handleSignIn();
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setMenuOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  if (user && token) {
    return (
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-xs"
          title={`Signed in as ${user.email}`}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google Profile'}
              className="w-6 h-6 rounded-full border border-white/40 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-[10px]">
              {user.email ? user.email[0].toUpperCase() : 'G'}
            </div>
          )}

          <div className="flex flex-col text-left max-w-[130px] sm:max-w-[170px] truncate">
            <span className="font-semibold text-white truncate text-[11px] leading-tight flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
              {user.displayName || 'Google Account'}
            </span>
            <span className="text-[10px] text-blue-200 truncate leading-tight">{user.email}</span>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-blue-200 shrink-0 ml-0.5" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Gmail Connected</p>
                    <p className="text-[11px] text-slate-500">Ready to dispatch real QR passes</p>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 font-mono break-all">
                  {user.email}
                </div>
              </div>

              <div className="p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  disabled={isLoading}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-[#004ACD] rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Use / Switch to another email</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Disconnect Google Account</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Official "Sign in with Google" standard button
  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        id="google-signin-btn"
        onClick={handleSignIn}
        disabled={isLoading}
        className={`inline-flex items-center justify-center space-x-2.5 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-medium text-xs shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : ''
        }`}
        aria-label="Sign in with Google"
      >
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          className="w-4 h-4 shrink-0"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
        <span className="font-semibold text-slate-800">
          {isLoading ? 'Connecting Google...' : 'Sign in with Google'}
        </span>
      </button>

      {errorMessage && (
        <span className="text-[10px] text-rose-500 mt-1">{errorMessage}</span>
      )}
    </div>
  );
};
