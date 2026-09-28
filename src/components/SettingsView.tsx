import React, { useState } from 'react';
import type { AdminUser } from '../types';
import { api } from '../services/api';
import {
  ShieldCheck,
  User,
  KeyRound,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SettingsViewProps {
  user: AdminUser | null;
  onUserUpdated: (user: AdminUser) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUserUpdated,
  onLogout,
}) => {
  // Change Account Details form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Logout confirmation modal/state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Old password is strictly required
    if (!currentPassword) {
      setErrorMessage('The old password must be entered to make changes to your account details.');
      return;
    }

    // If changing password, validate restrictions
    if (newPassword) {
      if (newPassword.length < 8) {
        setErrorMessage('New password must be at least 8 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('New password and confirmation password do not match.');
        return;
      }
    }

    // Check if any change was provided
    const isUsernameChanged = newUsername.trim() !== (user?.username || '');
    const isPasswordChanged = Boolean(newPassword);

    if (!isUsernameChanged && !isPasswordChanged) {
      setErrorMessage('Please provide a new username or new password to update.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.changeAccountDetails({
        current_password: currentPassword,
        new_username: isUsernameChanged ? newUsername.trim() : undefined,
        new_password: isPasswordChanged ? newPassword : undefined,
        confirm_password: isPasswordChanged ? confirmPassword : undefined,
      });

      setSuccessMessage('Account details successfully updated! Your new credentials are now active.');
      onUserUpdated(response.user);

      // Reset sensitive form fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update account details. Please check your old password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fadeIn">
      {/* Page Title Header */}
      <div className="border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
            <ShieldCheck className="w-7 h-7 text-[#004ACD]" />
            <span>Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage administrative credentials, security parameters, and portal access controls.
          </p>
        </div>
      </div>

      {/* Notice on Administrator Account vs Gmail Integration */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start space-x-3.5 shadow-sm">
        <div className="p-2 bg-[#004ACD] rounded-xl text-white shrink-0 mt-0.5 shadow-sm">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-[#004ACD] text-sm block mb-1">
            About the MIDSA Admin Account vs. Gmail Login
          </span>
          <p className="text-slate-600">
            The <strong className="text-slate-900">MIDSA Admin</strong> account is the master system credential that protects the entire attendance database, scholar records, and event scanner.
            This is <strong className="text-slate-900">independent of the Gmail login</strong> in the navigation header, which is solely an OAuth integration for dispatching emails and QR code passes to scholars. Logging into or out of Gmail does not alter or grant administrator rights.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Admin Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#004ACD] to-[#00F7FF]"></div>

            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#004ACD] to-[#0165CB] p-1 flex items-center justify-center shadow-lg border-2 border-white mb-4">
              <User className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {user?.displayName || 'MIDSA Admin'}
            </h2>
            <p className="text-xs font-semibold text-[#004ACD] bg-blue-50 px-2.5 py-1 rounded-full inline-block mt-1">
              @{user?.username || 'midsa2k26'}
            </p>

            <div className="mt-5 pt-5 border-t border-slate-100 text-left space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Role:</span>
                <span className="font-bold text-slate-700">Master Administrator</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Session Status:</span>
                <span className="inline-flex items-center space-x-1 font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active Session</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Encryption:</span>
                <span className="font-semibold text-slate-700">PBKDF2 SHA-512</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Auto-Logout:</span>
                <span className="font-semibold text-slate-700">On Window Close</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors border border-red-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-red-600" />
                <span>Log Out of MIDSA Admin</span>
              </button>
            </div>
          </div>

          {/* Session Lifecycle Card */}
          <div className="bg-slate-100/80 rounded-2xl border border-slate-200 p-5 text-xs text-slate-600 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-800">
              <Clock className="w-4 h-4 text-[#004ACD]" />
              <span>Browser Session Security</span>
            </div>
            <p className="leading-relaxed text-slate-500">
              When the website is closed or this tab is terminated, you are automatically logged out. You must enter your administrator username and password each time the portal is booted.
            </p>
          </div>
        </div>

        {/* Right Column: Change Account Details Form */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-[#004ACD] rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Change Account Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your admin username or password. The old password must be entered to authorize changes.
                  </p>
                </div>
              </div>
            </div>

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleUpdateAccount} className="space-y-5">
              {/* Old Password - Strictly Required */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Current (Old) Password <span className="text-red-500">*</span></span>
                  <span className="text-[11px] font-semibold text-amber-700">Verification Required</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-amber-600" />
                  </div>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="block w-full pl-10 pr-10 py-2.5 border border-amber-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-amber-800/80 mt-1.5">
                  You must confirm your old password to authorize any changes to your credentials.
                </p>
              </div>

              {/* Username Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Admin Username
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. midsa2k26"
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] bg-white transition-all"
                  />
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    New Password
                  </label>
                  <span className="text-[11px] text-slate-400">Leave blank if keeping current password</span>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (at least 8 characters)"
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Restriction Indicator */}
                {newPassword && (
                  <div className="mt-2 flex items-center space-x-2 text-xs">
                    <div
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        newPassword.length >= 8
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {newPassword.length >= 8 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      )}
                      <span>Must be at least 8 characters ({newPassword.length}/8)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    disabled={!newPassword}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004ACD] focus:border-[#004ACD] bg-white transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={!newPassword}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none disabled:opacity-50"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Match indicator */}
                {newPassword && confirmPassword && (
                  <div className="mt-2 text-xs">
                    {newPassword === confirmPassword ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Passwords match</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-red-600 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Passwords do not match</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-3 px-6 bg-gradient-to-r from-[#004ACD] to-[#0165CB] hover:from-[#003da8] hover:to-[#0055b3] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Save Account Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sign Out of MIDSA Admin?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Your active session will be invalidated and you will be returned to the administrator login screen.
            </p>
            <div className="mt-6 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md transition-colors cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
