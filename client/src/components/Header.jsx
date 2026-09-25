import React from 'react';
import { Link } from 'react-router-dom';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#1E1E2A] select-none">
      <div className="w-full h-14 px-6 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <img
            alt="CodeAudit Logo"
            className="w-7 h-7 object-contain"
            src="/favicon.png"
          />
          <span className="font-semibold text-[17px] tracking-tight text-[#EDEDF0]">
            CodeAudit
          </span>
        </Link>

        {/* Action Link */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg border border-[#1E1E2A] bg-[#111118] text-xs font-sans text-[#888896] hover:text-[#EDEDF0] hover:bg-[#161622] hover:border-[#2563eb]/40 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>New Audit</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
