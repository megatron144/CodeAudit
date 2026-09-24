import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Header = () => {
  const location = useLocation();

  const navLinks = [
    { label: 'Repositories', path: '/repos' },
    { label: 'Latest Audit', path: '/analysis/latest' },
    { label: 'Trends', path: '/trends' },
    { label: 'Settings', path: '/settings' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface-container-lowest border-b border-outline-variant/30 select-none">
      <div className="w-full h-14 px-6 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
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

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1 font-body-sm text-xs">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    isActive
                      ? 'bg-surface-container text-primary font-medium border border-outline-variant/30'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action / System Status */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/30 font-code-sm text-[11px] text-outline">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
            <span>Enterprise Daemon v2.4</span>
          </span>
          <Link
            to="/repos"
            className="px-3 py-1.5 bg-primary text-on-primary hover:opacity-95 font-body-sm text-xs font-medium rounded transition-opacity"
          >
            + Link Repo
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
