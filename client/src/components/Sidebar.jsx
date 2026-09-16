import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar = () => {
  const location = useLocation();

  const navLinks = [
    { label: 'Repositories', path: '/repos', icon: 'folder_open' },
    { label: 'Analysis view', path: '/analysis/latest', icon: 'terminal' },
    { label: 'History and trends', path: '/trends', icon: 'trending_up' },
    { label: 'Settings', path: '/settings', icon: 'settings' },
  ];

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-60 bg-surface-container-lowest border-r border-outline-variant/30 z-40 flex flex-col justify-between p-3 select-none">
      <div className="flex flex-col gap-1">
        <div className="px-2.5 py-1.5 font-label-sm text-xs text-outline font-medium">
          Workspace
        </div>
        <nav className="flex flex-col gap-0.5">
          {navLinks.map((link) => {
            const isActive = location.pathname.startsWith(link.path.split('/')[1]);
            return (
              <Link
                key={link.label}
                to={link.path}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded font-body-sm text-body-sm transition-none ${
                  isActive
                    ? 'bg-surface-container text-on-surface border-l-2 border-primary-container font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
