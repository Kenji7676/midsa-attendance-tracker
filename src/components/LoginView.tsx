import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { AdminUser } from '../types';
import midsaLogo from '../assets/midsa-logo.png';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  FastForward,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: AdminUser) => void;
}

type IntroPhase = 'init' | 'popping' | 'sliding' | 'text' | 'form' | 'complete';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Intro animation states
  const [phase, setPhase] = useState<IntroPhase>('init');
  const [centerOffsetY, setCenterOffsetY] = useState<number>(0);
  const logoRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Measure target logo position and orchestrate sequential intro
  useEffect(() => {
    // 1. Calculate offset from header position to exact viewport center
    const calculateCenter = () => {
      if (logoRef.current) {
        const rect = logoRef.current.getBoundingClientRect();
        const centerScreenY = window.innerHeight / 2;
        const logoCenterY = rect.top + rect.height / 2;
        setCenterOffsetY(centerScreenY - logoCenterY);
      }
    };

    calculateCenter();

    // 2. Timeline for intro animation sequence:
    // Step 1: Logo pops in at the center of the screen
    const popTimer = setTimeout(() => {
      setPhase('popping');
    }, 60);

    // Step 2: Logo slides smoothly upwards to the header position
    const slideTimer = setTimeout(() => {
      setPhase('sliding');
    }, 1100);

    // Step 3: MIDSA text appears
    const textTimer = setTimeout(() => {
      setPhase('text');
    }, 1850);

    // Step 4: Rest of the login page appears
    const formTimer = setTimeout(() => {
      setPhase('form');
    }, 2450);

    // Step 5: Complete & focus input
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      usernameInputRef.current?.focus();
    }, 3050);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(slideTimer);
      clearTimeout(textTimer);
      clearTimeout(formTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  // Quick skip function if user clicks skip or presses a key
  const handleSkipIntro = () => {
    setPhase('complete');
    setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.login(username.trim(), password);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine current visibility states for intro phases
  const isLogoPopped = phase !== 'init';
  const isLogoSlidUp = phase === 'sliding' || phase === 'text' || phase === 'form' || phase === 'complete';
  const isTextVisible = phase === 'text' || phase === 'form' || phase === 'complete';
  const isFormVisible = phase === 'form' || phase === 'complete';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#002266] to-[#004ACD] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden select-none">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00F7FF] rounded-full blur-3xl opacity-60"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Discreet skip intro button during initial intro */}
      {phase !== 'complete' && (
        <button
          onClick={handleSkipIntro}
          className="absolute top-5 right-5 z-50 text-xs font-semibold text-blue-200/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <span>Skip intro</span>
          <FastForward className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8 relative flex flex-col items-center">
          {/* Logo container that pops in at center, then slides upwards */}
          <div
            ref={logoRef}
            style={{
              transform: isLogoSlidUp
                ? 'translate3d(0, 0, 0) scale(1)'
                : isLogoPopped
                ? `translate3d(0, ${centerOffsetY}px, 0) scale(1.15)`
                : `translate3d(0, ${centerOffsetY}px, 0) scale(0)`,
              opacity: isLogoPopped ? 1 : 0,
              transition: isLogoSlidUp
                ? 'transform 750ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out'
                : 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 400ms ease-out',
            }}
            className="inline-flex items-center justify-center p-3.5 sm:p-4 bg-white rounded-3xl shadow-2xl border-2 border-white/40 mb-4 will-change-transform z-20 group relative"
          >
            {/* Soft luminous halo during intro */}
            {!isLogoSlidUp && (
              <div className="absolute -inset-2 bg-gradient-to-r from-[#00F7FF] to-blue-500 rounded-3xl blur-md opacity-70 animate-pulse pointer-events-none"></div>
            )}
            <img
              src={midsaLogo}
              alt="MIDSA Logo"
              className="w-16 h-16 sm:w-18 sm:h-18 object-contain relative z-10"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* MIDSA Title, Subtitle, and Badge (Appears after logo slides upwards) */}
          <div
            style={{
              opacity: isTextVisible ? 1 : 0,
              transform: isTextVisible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 500ms ease-out, transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="will-change-transform"
          >
            <h1 className="tracking-tight text-center">
              <span className="block text-2xl sm:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-white via-blue-50 to-[#00F7FF] bg-clip-text text-transparent">
                MIDSA
              </span>
              <span className="block text-3xl sm:text-4xl font-black text-white leading-tight mt-0.5">
                Attendance Portal
              </span>
            </h1>
            <p className="mt-1 text-xs text-blue-200 font-medium tracking-wider uppercase">
              MSU-IIT DOST-SEI Scholars' Association
            </p>
            <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-100 text-[11px] font-semibold backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00F7FF]" />
              <span>Encrypted Administrator Access</span>
            </div>
          </div>
        </div>

        {/* Login Card (Revealed after MIDSA text appears) */}
        <div
          style={{
            opacity: isFormVisible ? 1 : 0,
            transform: isFormVisible ? 'translateY(0)' : 'translateY(28px)',
            transition: 'opacity 600ms ease-out, transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: isFormVisible ? 'auto' : 'none',
          }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-7 sm:p-9 text-slate-800 will-change-transform"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-[#004ACD]" />
              <span>Admin Login</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Please enter your administrator credentials to access scholar records and attendance systems.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  ref={usernameInputRef}
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] transition-all bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#003da8] hover:to-[#0055b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#004ACD] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
