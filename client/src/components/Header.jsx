import React from 'react';
import { Link } from 'react-router-dom';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface-container-lowest border-b border-outline-variant/30">
      <div className="w-full h-14 px-5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <img
              alt="CodeAudit Logo"
              className="w-7 h-7 object-contain"
              src="/favicon.png"
            />
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              CodeAudit
            </span>
          </Link>
        </div>

        {/* Navigation Link */}
        <div className="flex items-center gap-3">
          <Link
            to="/repos"
            className="text-xs font-medium text-outline hover:text-on-surface transition-colors"
          >
            Repositories
          </Link>
        </div>
      </div>
    </header>
  );
};
