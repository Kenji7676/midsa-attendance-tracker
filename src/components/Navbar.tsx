import React from 'react';
import type { TabType, AdminUser } from '../types';
import { LayoutDashboard, Calendar, Users, QrCode, Settings, ShieldCheck } from 'lucide-react';
import midsaLogo from '../assets/midsa-logo.png';
import { GoogleAuthButton } from './GoogleAuthButton';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  totalEventsCount: number;
  totalScholarsCount: number;
  adminUser?: AdminUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  totalEventsCount,
  totalScholarsCount,
  adminUser,
}) => {
  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'events' as TabType,
      label: 'Events',
      icon: Calendar,
      badge: totalEventsCount > 0 ? `${totalEventsCount}` : null,
    },
    {
      id: 'scholars' as TabType,
      label: 'Scholars',
      icon: Users,
      badge: totalScholarsCount > 0 ? `${totalScholarsCount}` : null,
    },
    {
      id: 'attendance' as TabType,
      label: 'Attendance Scanner',
      icon: QrCode,
      badge: null,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#004ACD] text-white shadow-md border-b border-[#0165CB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & Name */}
          <div 
            id="brand-header"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center space-x-3 cursor-pointer select-none group"
          >
            <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-white/30 transform group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              <img
                src={midsaLogo}
                alt="MIDSA Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white leading-tight">
                  MIDSA
                </span>
                <span className="hidden xl:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold text-white border border-white/20">
                  <ShieldCheck className="w-3 h-3 text-[#00F7FF]" />
                  <span>{adminUser?.displayName || 'MIDSA Admin'}</span>
                </span>
              </div>
              <p className="text-[11px] text-blue-100/90 font-medium hidden sm:block tracking-wide">
                MSU-IIT DOST-SEI Scholars' Association
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs & Integrations */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <nav className="hidden md:flex items-center space-x-1 sm:space-x-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => onSelectTab(tab.id)}
                    className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#004ACD] shadow-sm'
                        : 'text-blue-50 hover:bg-[#0165CB] hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#004ACD]' : 'text-blue-200'}`} />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#004ACD] text-[#00F7FF]'
                            : 'bg-[#0165CB] text-white'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Google Account / Sign in for Gmail (Explicitly noted as separate for emails) */}
            <div className="pl-1 sm:pl-2 border-l border-white/20 flex items-center space-x-2">
              <GoogleAuthButton />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden border-t border-[#0165CB] bg-[#0042B3] px-2 py-1.5 flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`mobile-nav-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#00F7FF] font-bold bg-[#0165CB]/60'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{tab.label === 'Attendance Scanner' ? 'Scanner' : tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
